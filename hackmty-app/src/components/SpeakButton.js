import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii } from "../theme";
import {
  getSpeakingMessageId,
  speakMessage,
  stopSpeaking,
} from "../services/tts";
import { buildSpeakableText } from "../services/speakableText";

export default function SpeakButton({ message, messageId }) {
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(
    () => getSpeakingMessageId() === messageId,
  );
  const speakableText = buildSpeakableText(message);
  const canSpeak = Boolean(speakableText);

  useEffect(() => {
    const timer = setInterval(() => {
      setSpeaking(getSpeakingMessageId() === messageId);
    }, 350);
    return () => clearInterval(timer);
  }, [messageId]);

  if (!canSpeak) return null;

  const onPress = async () => {
    if (loading) return;
    if (getSpeakingMessageId() === messageId) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }

    setLoading(true);
    try {
      const result = await speakMessage(message, messageId);
      setSpeaking(!result?.stopped && !result?.cancelled);
    } catch (error) {
      setSpeaking(false);
      Alert.alert(
        "No se pudo narrar",
        error?.message || "Revisa la configuración de ElevenLabs y que el backend esté corriendo.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      accessibilityLabel={speaking ? "Detener narración" : "Escuchar respuesta"}
      accessibilityRole="button"
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        speaking && styles.buttonActive,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.red} />
      ) : (
        <View>
          <Ionicons
            name={speaking ? "stop-circle" : "volume-high-outline"}
            size={16}
            color={speaking ? colors.surface : colors.red}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 26,
    height: 26,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: "#F3C5CD",
    backgroundColor: "#FFF5F7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    zIndex: 2,
  },
  buttonActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
