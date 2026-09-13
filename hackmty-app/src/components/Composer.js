import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  downloadSpanishRecognitionModel,
  resolveSpanishRecognitionConfig,
  SpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "../services/speechRecognition";

import {
  colors,
  fontFamily,
  radii,
  shadow,
  spacing,
} from "../theme";

const ERROR_MESSAGES = {
  "not-allowed": "Necesitamos permiso al micrófono para escuchar tu solicitud.",
  "service-not-allowed":
    "El reconocimiento de voz no está habilitado en este dispositivo.",
  "language-not-supported":
    "El servicio de voz necesita instalar el modelo de español.",
  network: "El servicio de voz de Google no tiene conexión.",
  "no-speech": "No detectamos voz. Intenta hablar un poco más cerca.",
  "speech-timeout": "No detectamos voz a tiempo. Intenta de nuevo.",
  "audio-capture": "No fue posible acceder al micrófono.",
  busy: "El reconocimiento de voz está ocupado. Espera un momento.",
};

export default function Composer({
  onSend,
  disabled = false,
  assistantStatus,
  bottomInset = 0,
  onPressVoice, // <--- Prop añadida para recibir la función del Modo Live
}) {
  const [text, setText] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState(false);
  const [error, setError] = useState("");
  const [languageSetupRequired, setLanguageSetupRequired] = useState(false);
  const [installingLanguage, setInstallingLanguage] = useState(false);
  const speechConfigRef = useRef({ lang: "es-US" });
  const downloadAttemptedRef = useRef(false);

  useSpeechRecognitionEvent("start", () => {
    setRecognizing(true);
    setError("");
  });
  useSpeechRecognitionEvent("end", () => setRecognizing(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) {
      setText(transcript);
      setVoiceDraft(true);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setRecognizing(false);
    if (event.error === "aborted") return;
    const languageUnavailable =
      event.error === "language-not-supported" ||
      /idioma|language|locale|paquete/i.test(event.message || "");
    if (languageUnavailable && Platform.OS === "android") {
      setLanguageSetupRequired(true);
      setError(ERROR_MESSAGES["language-not-supported"]);
      if (!downloadAttemptedRef.current) {
        downloadAttemptedRef.current = true;
        installSpanishLanguage();
      }
      return;
    }
    setError(
      ERROR_MESSAGES[event.error] ||
        event.message ||
        "No pudimos convertir tu voz en texto.",
    );
  });

  useEffect(
    () => () => {
      try {
        SpeechRecognitionModule?.abort();
      } catch {
        // El módulo puede no estar activo al desmontar el compositor.
      }
    },
    [],
  );

  async function installSpanishLanguage() {
    if (installingLanguage) return;
    setInstallingLanguage(true);
    setError("Preparando el reconocimiento en español…");
    try {
      const result = await downloadSpanishRecognitionModel(
        speechConfigRef.current.lang,
      );
      if (result.status === "download_success") {
        setLanguageSetupRequired(false);
        setError("Español instalado. Vuelve a tocar el micrófono.");
      } else if (result.status === "download_scheduled") {
        setError(
          "La descarga de español quedó programada. Conéctate a Wi-Fi y vuelve a intentarlo.",
        );
      } else if (result.status === "opened_dialog") {
        setError(
          "Completa la descarga de Español en la ventana del sistema y vuelve a tocar el micrófono.",
        );
      } else {
        setError(
          "Instala Español desde Ajustes > Sistema > Idiomas > Reconocimiento de voz.",
        );
      }
    } catch (languageError) {
      setError(
        languageError?.message ||
          "No fue posible abrir la descarga. Actualiza la app de Google e instala Español en sus ajustes de voz.",
      );
    } finally {
      setInstallingLanguage(false);
    }
  }

  const submitText = () => {
    const clean = text.trim();
    if (!clean || disabled) return;
    if (
      onSend(clean, { inputMode: voiceDraft ? "voice" : "text" }) !== false
    ) {
      setText("");
      setVoiceDraft(false);
    }
  };

  const startRecognition = async () => {
    if (disabled) return;
    Keyboard.dismiss();
    setError("");
    try {
      if (!SpeechRecognitionModule) {
        setError(
          "Expo Go no incluye dictado nativo. Usa npx expo run:ios o npx expo run:android para habilitar el micrófono.",
        );
        return;
      }
      if (!SpeechRecognitionModule.isRecognitionAvailable()) {
        setError(
          "Este dispositivo no tiene un servicio de reconocimiento de voz disponible.",
        );
        return;
      }
      const permission =
        await SpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError(ERROR_MESSAGES["not-allowed"]);
        return;
      }

      const speechConfig = await resolveSpanishRecognitionConfig();
      speechConfigRef.current = speechConfig;
      if (speechConfig.requiresLanguageDownload) {
        setLanguageSetupRequired(true);
        await installSpanishLanguage();
        return;
      }

      setLanguageSetupRequired(false);
      SpeechRecognitionModule.start({
        lang: speechConfig.lang,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
        contextualStrings: [
          "Banorte",
          "saldo",
          "transferencia",
          "pesos",
          "mensualidad",
          "crédito",
          "CAT",
        ],
        androidRecognitionServicePackage:
          speechConfig.androidRecognitionServicePackage,
      });
    } catch (recognitionError) {
      setRecognizing(false);
      setError(
        recognitionError?.message ||
          "No pudimos iniciar el reconocimiento de voz.",
      );
    }
  };

  const toggleRecognition = () => {
    // Si nos pasan una función externa para el Modo Live, la ejecutamos prioritariamente
    if (onPressVoice) {
      Keyboard.dismiss();
      onPressVoice();
      return;
    }

    // Comportamiento anterior por defecto si no hay modal live
    if (recognizing) {
      SpeechRecognitionModule?.stop();
    } else {
      startRecognition();
    }
  };

  const hasText = Boolean(text.trim());

  return (
    <View
      style={[
        styles.shell,
        shadow,
        { paddingBottom: Math.max(spacing.sm, bottomInset) },
      ]}
    >
      {assistantStatus ? (
        <View style={styles.statusRow}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>{assistantStatus}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            setVoiceDraft(false);
          }}
          editable={!disabled}
          placeholder={
            recognizing
              ? "Escuchando…"
              : SpeechRecognitionModule
              ? "Escribe o dicta tu solicitud…"
              : "Escribe tu solicitud…"
          }
          placeholderTextColor={
            recognizing ? colors.red : colors.muted
          }
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submitText}
          style={[styles.input, recognizing && styles.inputRecognizing]}
          accessibilityLabel="Escribe tu solicitud financiera"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recognizing
              ? "Detener reconocimiento de voz"
              : "Abrir asistente de voz Ban-IA Live"
          }
          disabled={disabled}
          onPress={toggleRecognition}
          style={({ pressed }) => [
            styles.micButton,
            recognizing && styles.micButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={recognizing ? "stop" : "mic-outline"}
            size={21}
            color={recognizing ? colors.surface : colors.charcoal}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar solicitud"
          disabled={!hasText || disabled || recognizing}
          onPress={submitText}
          style={({ pressed }) => [
            styles.sendButton,
            (!hasText || disabled || recognizing) && styles.sendDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-up" size={21} color={colors.surface} />
        </Pressable>
      </View>

      <View style={styles.hintRow}>
        <Ionicons
          name={recognizing ? "radio-outline" : "shield-checkmark-outline"}
          size={13}
          color={recognizing ? colors.red : colors.success}
        />
        <Text
          style={[
            styles.modeHint,
            recognizing && styles.recognizingHint,
          ]}
        >
          {recognizing
            ? "Dictando con el servicio nativo del dispositivo"
            : SpeechRecognitionModule
            ? "Toca el micrófono para abrir Ban-IA Live"
            : "Dictado disponible en una development build"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
          {languageSetupRequired && Platform.OS === "android" ? (
            <Pressable
              accessibilityRole="button"
              disabled={installingLanguage}
              onPress={installSpanishLanguage}
              style={({ pressed }) => [
                styles.languageButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.languageButtonText}>
                {installingLanguage ? "Preparando…" : "Instalar español"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 92,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.canvasStrong,
    backgroundColor: colors.canvas,
    color: colors.charcoal,
    fontFamily,
    fontSize: 14,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
  },
  inputRecognizing: {
    borderColor: colors.red,
    backgroundColor: colors.errorSoft,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    backgroundColor: colors.disabled,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  hintRow: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 5,
  },
  modeHint: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    marginLeft: 5,
  },
  recognizingHint: {
    color: colors.red,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  pulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginRight: 6,
  },
  statusText: {
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    fontWeight: "600",
  },
  error: {
    flex: 1,
    color: colors.red,
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    paddingBottom: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  languageButtonText: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
  },
});