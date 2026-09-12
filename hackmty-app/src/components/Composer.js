import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import {
  colors,
  fontFamily,
  radii,
  shadow,
  spacing,
} from "../theme";

const MAX_RECORDING_MS = 15000;

export default function Composer({
  onSend,
  onSendAudio,
  disabled = false,
  assistantStatus,
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [audioBusy, setAudioBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const startedAtRef = useRef(0);
  const recordingRef = useRef(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(
    () => () => {
      clearTimers();
      if (recordingRef.current) recorder.stop().catch(() => {});
    },
    [recorder]
  );

  const submitText = () => {
    const clean = text.trim();
    if (!clean || disabled) return;
    if (onSend(clean) !== false) setText("");
  };

  const stopRecording = async () => {
    if (!recordingRef.current || audioBusy) return;
    clearTimers();
    recordingRef.current = false;
    setAudioBusy(true);
    setError("");

    try {
      await recorder.stop();
      const durationMs = Date.now() - startedAtRef.current;
      const uri = recorder.uri;
      setRecording(false);
      setRecordingMs(durationMs);
      await setAudioModeAsync({ allowsRecording: false });

      if (!uri) throw new Error("No se generó el archivo de audio.");
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (onSendAudio(audioBase64, "audio/mp4", durationMs) === false) {
        throw new Error("No hay conexión con el servidor.");
      }
    } catch (recordingError) {
      setRecording(false);
      setError(
        recordingError?.message ||
          "No pudimos procesar la grabación. Intenta de nuevo."
      );
    } finally {
      setAudioBusy(false);
    }
  };

  const startRecording = async () => {
    if (disabled || audioBusy) return;
    setError("");
    try {
      const permission =
        await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Necesitamos permiso al micrófono para escuchar tu solicitud.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();

      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setRecordingMs(0);
      setRecording(true);
      intervalRef.current = setInterval(
        () => setRecordingMs(Date.now() - startedAtRef.current),
        250
      );
      timeoutRef.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (recordingError) {
      setError(
        recordingError?.message ||
          "No pudimos iniciar el micrófono. Revisa los permisos."
      );
    }
  };

  const seconds = Math.max(0, Math.ceil(recordingMs / 1000));
  const hasText = Boolean(text.trim());

  return (
    <View style={[styles.shell, shadow]}>
      {assistantStatus ? (
        <View style={styles.statusRow}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>{assistantStatus}</Text>
        </View>
      ) : null}

      {recording ? (
        <View style={styles.recordingRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Escuchando</Text>
          <View style={styles.waveform}>
            {[8, 15, 11, 19, 13, 7, 16].map((height, index) => (
              <View
                key={`${height}-${index}`}
                style={[styles.waveBar, { height }]}
              />
            ))}
          </View>
          <Text style={styles.timer}>0:{String(seconds).padStart(2, "0")}</Text>
        </View>
      ) : (
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!disabled && !audioBusy}
          placeholder="Pide una transferencia, saldo o plan…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submitText}
          style={styles.input}
          accessibilityLabel="Escribe tu solicitud financiera"
        />
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? "Detener grabación" : "Grabar solicitud por voz"
          }
          disabled={disabled || audioBusy}
          onPress={recording ? stopRecording : startRecording}
          style={({ pressed }) => [
            styles.micButton,
            recording && styles.micButtonActive,
            pressed && styles.pressed,
          ]}
        >
          {audioBusy ? (
            <ActivityIndicator size="small" color={colors.red} />
          ) : (
            <Ionicons
              name={recording ? "stop" : "mic-outline"}
              size={21}
              color={recording ? colors.surface : colors.charcoal}
            />
          )}
        </Pressable>

        <Text style={styles.modeHint}>
          {recording ? "Toca para enviar" : "Texto o voz"}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar solicitud"
          disabled={!hasText || disabled || recording}
          onPress={submitText}
          style={({ pressed }) => [
            styles.sendButton,
            (!hasText || disabled || recording) && styles.sendDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={21}
            color={colors.surface}
          />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    paddingBottom: spacing.sm,
  },
  input: {
    minHeight: 43,
    maxHeight: 92,
    borderRadius: radii.input,
    backgroundColor: colors.canvas,
    color: colors.charcoal,
    fontFamily,
    fontSize: 14,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
  },
  actions: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  modeHint: {
    flex: 1,
    color: colors.muted,
    fontFamily,
    fontSize: 10,
    marginLeft: 8,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  recordingRow: {
    minHeight: 43,
    borderRadius: radii.input,
    backgroundColor: colors.errorSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginRight: 7,
  },
  recordingText: {
    color: colors.red,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  waveform: {
    flex: 1,
    height: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.red,
  },
  timer: {
    color: colors.red,
    fontFamily,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  error: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
});
