"use strict";

const { MODEL, getApiKey, getGoogleClient } = require("./llm");

const DEFAULT_MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const configuredLimit = Number(process.env.MAX_AUDIO_BYTES);
const MAX_AUDIO_BYTES =
  Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_AUDIO_BYTES;

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/x-wav",
]);

class AudioError extends Error {
  constructor(code, message, recoverable = true) {
    super(message);
    this.name = "AudioError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

function normalizeMimeType(value) {
  return String(value).toLocaleLowerCase("en-US").replace(/\s+/g, "");
}

function normalizeBase64(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new AudioError("AUDIO_INVALID", "El audio base64 está vacío");
  }
  if (value.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 4) {
    throw new AudioError("AUDIO_TOO_LARGE", "El audio excede el límite permitido");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new AudioError("AUDIO_INVALID", "El audio no contiene base64 válido");
  }
  return value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
}

function validateAudio({ data, mimeType }) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
    throw new AudioError(
      "AUDIO_MIME_NOT_ALLOWED",
      `Formato de audio no permitido: ${normalizedMimeType || "desconocido"}`,
    );
  }
  const normalizedData = normalizeBase64(data);
  const bytes = Buffer.from(normalizedData, "base64");
  if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
    throw new AudioError("AUDIO_TOO_LARGE", "El audio excede el límite permitido");
  }
  return { data: normalizedData, mimeType: normalizedMimeType, bytes: bytes.length };
}

async function transcribeAudio(audio) {
  if (!getApiKey()) {
    throw new AudioError(
      "AUDIO_API_KEY_MISSING",
      "La transcripción requiere GEMINI_API_KEY o LLM_API_KEY",
      true,
    );
  }
  const validated = validateAudio(audio);
  const ai = await getGoogleClient();
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TRANSCRIPTION_MODEL || MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: validated.data,
                mimeType: validated.mimeType,
              },
            },
            {
              text:
                "Transcribe literalmente este audio en español. " +
                "Devuelve solo la transcripción, sin comillas ni comentarios.",
            },
          ],
        },
      ],
      config: { temperature: 0 },
    });
    const text = String(response.text || "").trim();
    if (!text) {
      throw new AudioError("AUDIO_TRANSCRIPTION_EMPTY", "No se detectó voz en el audio");
    }
    return text.slice(0, 4000);
  } catch (error) {
    if (error instanceof AudioError) throw error;
    throw new AudioError(
      "AUDIO_TRANSCRIPTION_FAILED",
      "No fue posible transcribir el audio",
      true,
    );
  }
}

module.exports = {
  ALLOWED_AUDIO_MIME_TYPES,
  AudioError,
  MAX_AUDIO_BYTES,
  normalizeBase64,
  normalizeMimeType,
  transcribeAudio,
  validateAudio,
};
