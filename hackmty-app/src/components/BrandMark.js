import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { colors, fontFamily } from "../theme";

export default function BrandMark({ inverse = false, compact = false }) {
  const color = inverse ? colors.surface : colors.red;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="Banorte"
      style={styles.row}
    >
      <Text
        style={[
          styles.wordmark,
          { color, fontSize: compact ? 20 : 26 },
        ]}
      >
        BANORTE
      </Text>
      {!compact && (
        <View style={[styles.divider, { backgroundColor: color }]} />
      )}
      {!compact && (
        <Text style={[styles.tagline, { color }]}>INTELIGENTE</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordmark: {
    fontFamily,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 10,
    opacity: 0.65,
  },
  tagline: {
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
});
