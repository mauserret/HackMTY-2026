import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  resolveSpanishRecognitionConfig,
  SpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "../services/speechRecognition";

export default function LiveVoiceModal({
  visible,
  onClose,
  onTranscript,
  assistantStatus,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const finalSentRef = useRef(false);
  const startingRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const restartCountRef = useRef(0);
  const [statusText, setStatusText] = useState("Escuchando...");

  const stopRecognition = useCallback(() => {
    try {
      SpeechRecognitionModule?.abort();
    } catch {
      // El módulo puede no estar activo.
    }
  }, []);

  const finishWithTranscript = useCallback(
    (transcript) => {
      const clean = String(transcript || "").trim();
      if (!clean || finalSentRef.current) return;
      finalSentRef.current = true;
      stopRecognition();
      onTranscript?.(clean);
      onClose?.();
    },
    [onClose, onTranscript, stopRecognition],
  );

  const startRecognition = useCallback(async () => {
    if (startingRef.current || finalSentRef.current) return;
    startingRef.current = true;
    setStatusText("Escuchando...");

    try {
      if (!SpeechRecognitionModule) {
        setStatusText("Dictado no disponible en este dispositivo");
        return;
      }
      if (!SpeechRecognitionModule.isRecognitionAvailable()) {
        setStatusText("Sin servicio de reconocimiento de voz");
        return;
      }

      const permission =
        await SpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusText("Necesitamos permiso al micrófono");
        return;
      }

      const speechConfig = await resolveSpanishRecognitionConfig();
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
    } catch (error) {
      setStatusText(
        error?.message || "No pudimos iniciar el reconocimiento de voz",
      );
    } finally {
      startingRef.current = false;
    }
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (!visible) return;
    setStatusText("Escuchando...");
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!visible || finalSentRef.current) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    lastTranscriptRef.current = transcript;
    if (event.isFinal) {
      finishWithTranscript(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!visible || finalSentRef.current || event.error === "aborted") return;
    if (event.error === "no-speech" || event.error === "speech-timeout") {
      setStatusText("No detectamos voz. Intenta de nuevo…");
      if (restartCountRef.current < 3) {
        restartCountRef.current += 1;
        setTimeout(() => {
          if (visible && !finalSentRef.current) startRecognition();
        }, 400);
      }
      return;
    }
    setStatusText(event.message || "No pudimos convertir tu voz en texto");
  });

  useSpeechRecognitionEvent("end", () => {
    if (!visible || finalSentRef.current) return;
    if (lastTranscriptRef.current) {
      finishWithTranscript(lastTranscriptRef.current);
      return;
    }
    if (restartCountRef.current < 3) {
      restartCountRef.current += 1;
      setTimeout(() => {
        if (visible && !finalSentRef.current) startRecognition();
      }, 250);
    }
  });

  useEffect(() => {
    if (visible) {
      finalSentRef.current = false;
      lastTranscriptRef.current = "";
      restartCountRef.current = 0;
      startRecognition();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      stopRecognition();
      finalSentRef.current = false;
      startingRef.current = false;
      lastTranscriptRef.current = "";
      restartCountRef.current = 0;
      setStatusText("Escuchando...");
      pulseAnim.setValue(1);
    }

    return () => {
      stopRecognition();
    };
  }, [visible, pulseAnim, startRecognition, stopRecognition]);

  const handleClose = () => {
    finalSentRef.current = true;
    stopRecognition();
    onClose?.();
  };

  const label =
    assistantStatus === "thinking" || assistantStatus === "transferring"
      ? "pensando..."
      : statusText;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <StatusBar backgroundColor="#050B14" barStyle="light-content" />

        {/* CENTRO PERFECTAMENTE ALINEADO: CÁPSULA OVALADA Y TEXTO */}
        <View style={styles.centerArea}>
          <View style={styles.animationWrapper}>
            <Animated.View
              style={[
                styles.pulseOvalRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.centralCapsule} />
          </View>

          <Text style={styles.statusLabel}>{label}</Text>
        </View>

        {/* BARRA INFERIOR CON EL BOTÓN CIRCULAR DE CIERRE (X) */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.closeCircleButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050B14", // Fondo oscuro nocturno elegante
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  centerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  animationWrapper: {
    width: 200,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseOvalRing: {
    position: "absolute",
    width: 160,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(235, 0, 41, 0.22)", // Aura de pulso en Rojo Banorte
  },
  centralCapsule: {
    width: 110,
    height: 56,
    borderRadius: 28, // Forma ovalada / cápsula horizontal idéntica a tu referencia
    backgroundColor: "#EB0029", // Rojo Banorte institucional
    shadowColor: "#EB0029",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 10,
  },
  statusLabel: {
    color: "#E2E8F0",
    fontFamily: "Gotham-Bold",
    fontSize: 15,
    marginTop: 30,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  bottomBar: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  closeCircleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EB0029", // Botón inferior en Rojo Banorte con la X
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EB0029",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
