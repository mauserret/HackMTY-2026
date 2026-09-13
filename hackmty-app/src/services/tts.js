import {
  cacheDirectory,
  deleteAsync,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system/legacy";

import { getHttpServerUrl } from "./socket";
import { buildSpeakableText } from "./speakableText";

let audioModeReady = false;
let activePlayer = null;
let activeMessageId = null;
let activeGeneration = 0;
let activeFileUri = null;
let audioModulePromise = null;

function loadAudioModule() {
  if (!audioModulePromise) {
    audioModulePromise = import("expo-audio");
  }
  return audioModulePromise;
}

async function ensureAudioMode() {
  if (audioModeReady) return;
  const { setAudioModeAsync } = await loadAudioModule();
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "duckOthers",
    shouldPlayInBackground: false,
  });
  audioModeReady = true;
}

async function removeCachedAudio(uri) {
  if (!uri) return;
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

function releasePlayer() {
  if (!activePlayer) {
    activeMessageId = null;
    return;
  }
  try {
    activePlayer.pause();
  } catch {
    // ignore
  }
  try {
    activePlayer.release();
  } catch {
    // ignore
  }
  activePlayer = null;
  activeMessageId = null;
  const staleFile = activeFileUri;
  activeFileUri = null;
  removeCachedAudio(staleFile);
}

export function stopSpeaking() {
  activeGeneration += 1;
  releasePlayer();
}

export function getSpeakingMessageId() {
  return activeMessageId;
}

async function waitUntilPlayable(player, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (player?.isLoaded && !player?.isBuffering) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function requestSpeechAudio(text) {
  const endpoint = `${getHttpServerUrl()}/api/tts`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  } catch (networkError) {
    const error = new Error(
      `No se pudo conectar a ${endpoint}. Verifica que el backend esté en línea y EXPO_PUBLIC_WS_URL apunte a tu IP.`,
    );
    error.code = "TTS_NETWORK_ERROR";
    error.cause = networkError;
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      "No se pudo generar la narración. Revisa ELEVENLABS_API_KEY.";
    const error = new Error(message);
    error.code = payload?.error?.code || "TTS_REQUEST_FAILED";
    throw error;
  }

  if (!payload?.audioBase64) {
    throw new Error("El servidor no devolvió audio para narrar");
  }

  if (!cacheDirectory) {
    throw new Error("No hay almacenamiento temporal para reproducir el audio");
  }

  const fileUri = `${cacheDirectory}banai-tts-${Date.now()}.mp3`;
  await writeAsStringAsync(fileUri, payload.audioBase64, {
    encoding: EncodingType.Base64,
  });
  return { uri: fileUri };
}

/**
 * Habla el resultado de una acción solo cuando el usuario lo solicita.
 * Si se vuelve a tocar el mismo mensaje mientras suena, se detiene.
 */
export async function speakMessage(message, messageId) {
  const text = buildSpeakableText(message);
  if (!text) {
    const error = new Error("No hay texto para narrar en esta respuesta");
    error.code = "TTS_EMPTY_TEXT";
    throw error;
  }

  if (activeMessageId === messageId && activePlayer) {
    stopSpeaking();
    return { stopped: true };
  }

  const generation = activeGeneration + 1;
  activeGeneration = generation;
  releasePlayer();
  await ensureAudioMode();

  const source = await requestSpeechAudio(text);
  if (generation !== activeGeneration) {
    await removeCachedAudio(source.uri);
    return { cancelled: true };
  }

  const { createAudioPlayer } = await loadAudioModule();
  const player = createAudioPlayer(source, { updateInterval: 200 });
  activePlayer = player;
  activeMessageId = messageId;
  activeFileUri = source.uri;

  player.addListener?.("playbackStatusUpdate", (status) => {
    if (
      status?.didJustFinish &&
      activePlayer === player &&
      generation === activeGeneration
    ) {
      releasePlayer();
    }
  });

  await waitUntilPlayable(player);
  if (generation !== activeGeneration || activePlayer !== player) {
    return { cancelled: true };
  }

  player.play();
  return { playing: true, text };
}
