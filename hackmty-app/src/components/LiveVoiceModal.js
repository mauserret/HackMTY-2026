import React, { useEffect, useRef } from "react";
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

export default function LiveVoiceModal({ visible, onClose, assistantStatus }) {
  // Animación de pulso fluida para la cápsula central
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
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
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, pulseAnim]);

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
          
          <Text style={styles.statusLabel}>
            {assistantStatus === "thinking" ? "pensando..." : "Escuchando..."}
          </Text>
        </View>

        {/* BARRA INFERIOR CON EL BOTÓN CIRCULAR DE CIERRE (X) */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.closeCircleButton} onPress={onClose}>
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