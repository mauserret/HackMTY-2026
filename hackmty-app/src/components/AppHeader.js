import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import BrandMark from "./BrandMark";
import ConnectionPill from "./ConnectionPill";
import { useBanking } from "../context/BankingContext";
import { colors, fontFamily, spacing } from "../theme";

export default function AppHeader() {
  const { connection, logout, session } = useBanking();

  return (
    <View style={styles.header}>
      <BrandMark inverse compact />
      <View style={styles.actions}>
        <ConnectionPill state={connection} inverse />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={logout}
          style={({ pressed }) => [
            styles.profileButton,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {session?.name?.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Ionicons
            name="log-out-outline"
            size={17}
            color={colors.surface}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    backgroundColor: colors.red,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  profileButton: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 5,
    paddingRight: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.62,
  },
});
