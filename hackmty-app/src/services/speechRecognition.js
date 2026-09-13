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
      recognition.lang = options.lang || "es-US";
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

const SPANISH_LOCALE_PREFERENCES = [
  "es-US",
  "es-MX",
  "es-419",
  "es-ES",
  "es",
];

function normalizeLocale(locale) {
  return String(locale || "").replaceAll("_", "-").toLowerCase();
}

function isSpanishLocale(locale) {
  const normalized = normalizeLocale(locale);
  return normalized === "es" || normalized.startsWith("es-");
}

function preferredSpanishLocale() {
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  return isSpanishLocale(deviceLocale) ? deviceLocale : "es-US";
}

export function selectSpanishLocale(locales = []) {
  const spanishLocales = locales.filter(isSpanishLocale);
  const byNormalized = new Map(
    spanishLocales.map((locale) => [normalizeLocale(locale), locale]),
  );
  const preferences = [
    preferredSpanishLocale(),
    ...SPANISH_LOCALE_PREFERENCES,
  ];
  for (const locale of preferences) {
    const exact = byNormalized.get(normalizeLocale(locale));
    if (exact) return exact;
  }
  return spanishLocales[0] || null;
}

function recognitionServiceCandidates() {
  const services =
    SpeechRecognitionModule?.getSpeechRecognitionServices?.() || [];
  const defaultPackage =
    SpeechRecognitionModule?.getDefaultRecognitionService?.()?.packageName ||
    "";
  const candidates = [
    defaultPackage !== "com.google.android.as" ? defaultPackage : "",
    "com.google.android.googlequicksearchbox",
    "com.google.android.tts",
    defaultPackage,
    "com.google.android.as",
  ].filter(
    (service, index, values) =>
      service &&
      services.includes(service) &&
      values.indexOf(service) === index,
  );
  return candidates.length ? candidates : [undefined];
}

export async function resolveSpanishRecognitionConfig() {
  const fallbackLocale = preferredSpanishLocale();
  if (!SpeechRecognitionModule) {
    return {
      lang: fallbackLocale,
      androidRecognitionServicePackage: undefined,
      requiresLanguageDownload: false,
    };
  }

  if (Platform.OS !== "android") {
    try {
      const support = await SpeechRecognitionModule.getSupportedLocales?.({});
      const lang =
        selectSpanishLocale(support?.installedLocales) ||
        selectSpanishLocale(support?.locales) ||
        fallbackLocale;
      return {
        lang,
        androidRecognitionServicePackage: undefined,
        requiresLanguageDownload: false,
      };
    } catch {
      return {
        lang: fallbackLocale,
        androidRecognitionServicePackage: undefined,
        requiresLanguageDownload: false,
      };
    }
  }

  let downloadableConfig = null;
  for (const packageName of recognitionServiceCandidates()) {
    try {
      const support = await SpeechRecognitionModule.getSupportedLocales?.({
        androidRecognitionServicePackage: packageName,
      });
      if (!support || support.locales.length === 0) {
        return {
          lang: fallbackLocale,
          androidRecognitionServicePackage: packageName,
          requiresLanguageDownload: false,
        };
      }
      const installedLang = selectSpanishLocale(support.installedLocales);
      const lang = installedLang || selectSpanishLocale(support.locales);
      if (!lang) continue;
      const requiresLanguageDownload =
        !installedLang && packageName === "com.google.android.as";
      const config = {
        lang,
        androidRecognitionServicePackage: packageName,
        requiresLanguageDownload,
      };
      if (!requiresLanguageDownload) return config;
      downloadableConfig ||= config;
    } catch {
      // Algunos servicios no implementan la consulta de idiomas.
    }
  }

  return (
    downloadableConfig || {
      lang: fallbackLocale,
      androidRecognitionServicePackage: undefined,
      requiresLanguageDownload: Number(Platform.Version) >= 33,
    }
  );
}

export async function downloadSpanishRecognitionModel(locale = "es-US") {
  if (
    Platform.OS !== "android" ||
    Number(Platform.Version) < 33 ||
    !SpeechRecognitionModule?.androidTriggerOfflineModelDownload
  ) {
    return {
      status: "unsupported",
      message: "La descarga automática requiere Android 13 o posterior.",
    };
  }
  return SpeechRecognitionModule.androidTriggerOfflineModelDownload({
    locale,
  });
}

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
