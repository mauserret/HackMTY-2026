import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

function createWebSpeechModule() {
  const SpeechRecognitionClass =
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (typeof SpeechRecognitionClass !== "function") return null;

  let recognition = null;
  const listeners = new Map();

  const emit = (eventName, payload) => {
    const set = listeners.get(eventName);
    if (!set) return;
    for (const listener of set) listener(payload);
  };

  return {
    isRecognitionAvailable: () => true,
    getSpeechRecognitionServices: () => [],
    requestPermissionsAsync: async () => ({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    }),
    start(options = {}) {
      recognition = new SpeechRecognitionClass();
      recognition.lang = options.lang || "es-MX";
      recognition.interimResults = options.interimResults ?? true;
      recognition.continuous = options.continuous ?? false;
      recognition.maxAlternatives = options.maxAlternatives ?? 1;
      recognition.onstart = () => emit("start", null);
      recognition.onend = () => emit("end", null);
      recognition.onerror = (event) =>
        emit("error", {
          error: event.error,
          message: event.message || "",
        });
      recognition.onresult = (event) => {
        const result = event.results?.[event.resultIndex];
        emit("result", {
          isFinal: Boolean(result?.isFinal),
          results: [
            {
              transcript: result?.[0]?.transcript || "",
              confidence: result?.[0]?.confidence ?? 0,
              segments: [],
            },
          ],
        });
      };
      recognition.start();
    },
    stop() {
      recognition?.stop();
    },
    abort() {
      recognition?.abort();
    },
    addListener(eventName, listener) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(listener);
      return {
        remove() {
          listeners.get(eventName)?.delete(listener);
        },
      };
    },
  };
}

const nativeSpeechModule =
  Platform.OS === "web"
    ? null
    : requireOptionalNativeModule("ExpoSpeechRecognition");

if (
  typeof __DEV__ !== "undefined" &&
  __DEV__ &&
  Platform.OS !== "web" &&
  !nativeSpeechModule
) {
  console.info(
    "[compat] ExpoSpeechRecognition no está incluido en Expo Go; el dictado queda deshabilitado.",
  );
}

export const SpeechRecognitionModule =
  nativeSpeechModule ||
  (Platform.OS === "web" ? createWebSpeechModule() : null);

export function useSpeechRecognitionEvent(eventName, listener) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!SpeechRecognitionModule?.addListener) return undefined;
    const subscription = SpeechRecognitionModule.addListener(
      eventName,
      (event) => listenerRef.current(event),
    );
    return () => subscription?.remove?.();
  }, [eventName]);
}
