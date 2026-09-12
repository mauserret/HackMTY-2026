import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { colors, fontFamily, radii } from "../theme";

const labels = {
  connected: "En línea",
  connecting: "Conectando",
  disconnected: "Reconectando",
  error: "Sin conexión",
  idle: "Sin conexión",
};

export default function ConnectionPill({ state, inverse = false }) {
  const online = state === "connected";
  return (
    <View
      style={[
        styles.pill,
        inverse ? styles.inversePill : styles.defaultPill,
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: online
              ? inverse
                ? "#8FF0CB"
                : colors.success
              : inverse
                ? "#FFD0D8"
                : colors.red,
          },
        ]}
      />
      <Text
        style={[
          styles.label,
          { color: inverse ? colors.surface : colors.slate },
        ]}
      >
        {labels[state] || labels.idle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  defaultPill: {
    backgroundColor: colors.canvasStrong,
  },
  inversePill: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
});
