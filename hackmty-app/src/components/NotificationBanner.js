import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  colors,
  fontFamily,
  radii,
  shadow,
  spacing,
} from "../theme";

export default function NotificationBanner({ notification, onDismiss }) {
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!notification) return;
    translateY.setValue(-120);
    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [notification, translateY]);

  if (!notification) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.banner,
        shadow,
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.icon}>
        <Ionicons
          name="arrow-down"
          size={18}
          color={colors.surface}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {notification.title || "Movimiento recibido"}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body || notification.message}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar notificación"
        hitSlop={8}
        onPress={onDismiss}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="close" size={19} color={colors.slate} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    zIndex: 50,
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    minHeight: 70,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "#CDE7DC",
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.45,
  },
});
