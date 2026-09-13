"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");

const ENV_PATH = path.join(__dirname, ".env");
const MAX_TTS_CHARS = 2_500;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

const ttsBodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
});

function loadEnvFile({ override = true } = {}) {
  return dotenv.config({ path: ENV_PATH, override });
}

// Asegura que ELEVENLABS_* del .env ganen sobre variables vacías del shell.
loadEnvFile({ override: true });

function readEnvFileValue(key) {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));
    if (!line) return "";
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}

function getElevenLabsConfig(env = process.env) {
  const usingProcessEnv = env === process.env;
  if (usingProcessEnv) {
    loadEnvFile({ override: true });
  }

  let apiKey = String(env.ELEVENLABS_API_KEY || "").trim();
  let voiceId = String(env.ELEVENLABS_VOICE_ID || "").trim();
  let modelId = String(env.ELEVENLABS_MODEL_ID || "").trim();

  // Fallback directo al archivo si el proceso arrancó con la variable vacía.
  if (usingProcessEnv && !apiKey) {
    apiKey = readEnvFileValue("ELEVENLABS_API_KEY");
  }
  if (usingProcessEnv && !voiceId) {
    voiceId = readEnvFileValue("ELEVENLABS_VOICE_ID");
  }
  if (usingProcessEnv && !modelId) {
    modelId = readEnvFileValue("ELEVENLABS_MODEL_ID");
  }

  voiceId = voiceId || DEFAULT_VOICE_ID;
  modelId = modelId || DEFAULT_MODEL_ID;

  return { apiKey, voiceId, modelId, configured: Boolean(apiKey) };
}

function normalizeSpeakText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

async function synthesizeSpeech(
  text,
  { fetchImpl = fetch, env = process.env } = {},
) {
  const cleaned = normalizeSpeakText(text);
  if (!cleaned) {
    const error = new Error("El texto para narrar está vacío");
    error.code = "TTS_EMPTY_TEXT";
    error.status = 400;
    throw error;
  }

  const config = getElevenLabsConfig(env);
  if (!config.configured) {
    const error = new Error(
      "ElevenLabs no está configurado. Agrega ELEVENLABS_API_KEY en hackmty-backend/.env y reinicia el servidor.",
    );
    error.code = "TTS_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    config.voiceId,
  )}?output_format=mp3_44100_128`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: cleaned,
      model_id: config.modelId,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    const error = new Error(
      detail
        ? `ElevenLabs respondió ${response.status}: ${detail.slice(0, 240)}`
        : `ElevenLabs respondió ${response.status}`,
    );
    error.code = "TTS_PROVIDER_ERROR";
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: "audio/mpeg",
    audioBase64: buffer.toString("base64"),
    bytes: buffer.length,
    voiceId: config.voiceId,
    modelId: config.modelId,
  };
}

function createTtsRouter({ synthesize = synthesizeSpeech } = {}) {
  const { Router } = require("express");
  const router = Router();

  router.get("/status", (_request, response) => {
    const config = getElevenLabsConfig();
    return response.status(200).json({
      configured: config.configured,
      voice_id: config.voiceId,
      model_id: config.modelId,
      env_path: ENV_PATH,
    });
  });

  router.post("/", async (request, response) => {
    const parsed = ttsBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "TTS_INVALID_TEXT",
          message: "Envía un texto válido para narrar (máximo 2500 caracteres)",
        },
      });
    }

    try {
      const audio = await synthesize(parsed.data.text);
      return response.status(200).json({
        mimeType: audio.mimeType,
        audioBase64: audio.audioBase64,
        bytes: audio.bytes,
      });
    } catch (error) {
      const status = Number(error.status) || 500;
      return response.status(status).json({
        error: {
          code: error.code || "TTS_FAILED",
          message: error.message || "No se pudo generar el audio",
        },
      });
    }
  });

  return router;
}

module.exports = {
  ENV_PATH,
  MAX_TTS_CHARS,
  createTtsRouter,
  getElevenLabsConfig,
  loadEnvFile,
  normalizeSpeakText,
  synthesizeSpeech,
  ttsBodySchema,
};
