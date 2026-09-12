import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fontFamily, spacing } from "../theme";

export default function StarRating({
  interactionId,
  onRate,
  savedRating,
}) {
  const [rating, setRating] = useState(savedRating || 0);
  const [submitted, setSubmitted] = useState(Boolean(savedRating));
  const longPressed = useRef(false);

  useEffect(() => {
    if (savedRating) {
      setRating(savedRating);
      setSubmitted(true);
    }
  }, [savedRating]);

  if (!interactionId) return null;

  const submit = (value) => {
    if (submitted) return;
    const sent = onRate(interactionId, value);
    if (sent !== false) {
      setRating(value);
      setSubmitted(true);
    }
  };

  const label = rating
    ? `${Math.floor(rating / 2)}${rating % 2 ? "½" : ""} de 5`
    : "";

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.question}>
          {submitted ? "Gracias por tu opinión" : "¿Te resultó útil?"}
        </Text>
        <Text style={styles.hint}>
          {submitted ? label : "Mantén presionado para media estrella"}
        </Text>
      </View>
      <View
        style={styles.stars}
        accessibilityRole="radiogroup"
        accessibilityLabel="Califica esta interfaz"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const unit = star * 2;
          const icon =
            rating >= unit
              ? "star"
              : rating === unit - 1
                ? "star-half"
                : "star-outline";
          return (
            <Pressable
              key={star}
              disabled={submitted}
              delayLongPress={450}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`${star} estrellas`}
              accessibilityState={{ disabled: submitted }}
              onLongPress={() => {
                longPressed.current = true;
                submit(unit - 1);
              }}
              onPress={() => {
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                submit(unit);
              }}
              style={({ pressed }) => pressed && styles.starPressed}
            >
              <Ionicons
                name={icon}
                size={19}
                color={submitted ? colors.red : colors.slate}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  question: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  hint: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    marginTop: 1,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starPressed: {
    transform: [{ scale: 0.88 }],
  },
});
