"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const {
  createTtsRouter,
  getElevenLabsConfig,
  normalizeSpeakText,
  synthesizeSpeech,
} = require("../tts");

test("normaliza y recorta el texto a narrar", () => {
  assert.equal(normalizeSpeakText("  Hola   mundo  "), "Hola mundo");
  assert.equal(normalizeSpeakText("x".repeat(3000)).length, 2500);
});

test("detecta cuando falta la API key de ElevenLabs", () => {
  const config = getElevenLabsConfig({ ELEVENLABS_API_KEY: "" });
  assert.equal(config.configured, false);
  assert.ok(config.voiceId);
  assert.ok(config.modelId);
});

test("synthesizeSpeech falla claro sin API key", async () => {
  await assert.rejects(
    () =>
      synthesizeSpeech("Hola", {
        env: { ELEVENLABS_API_KEY: "" },
        fetchImpl: async () => {
          throw new Error("no debe llamarse");
        },
      }),
    (error) => error.code === "TTS_NOT_CONFIGURED",
  );
});

test("synthesizeSpeech convierte la respuesta de ElevenLabs a base64", async () => {
  const audio = await synthesizeSpeech("Saldo disponible", {
    env: {
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID: "voice-demo",
      ELEVENLABS_MODEL_ID: "eleven_multilingual_v2",
    },
    fetchImpl: async (url, options) => {
      assert.match(url, /voice-demo/);
      assert.equal(options.headers["xi-api-key"], "test-key");
      const body = JSON.parse(options.body);
      assert.equal(body.text, "Saldo disponible");
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from("fake-mp3"),
      };
    },
  });

  assert.equal(audio.mimeType, "audio/mpeg");
  assert.equal(audio.audioBase64, Buffer.from("fake-mp3").toString("base64"));
});

test("POST /api/tts valida el body y responde error sin configuración", async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/tts",
    createTtsRouter({
      synthesize: async () => {
        const error = new Error("ElevenLabs no está configurado");
        error.code = "TTS_NOT_CONFIGURED";
        error.status = 503;
        throw error;
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const { port } = server.address();

  try {
    const invalid = await fetch(`http://127.0.0.1:${port}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    assert.equal(invalid.status, 400);

    const missingKey = await fetch(`http://127.0.0.1:${port}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hola Banorte" }),
    });
    assert.equal(missingKey.status, 503);
    const payload = await missingKey.json();
    assert.equal(payload.error.code, "TTS_NOT_CONFIGURED");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
