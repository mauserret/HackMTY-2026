import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AccountOverview from "../components/AccountOverview";
import AppHeader from "../components/AppHeader";
import { useBanking } from "../context/BankingContext";
import {
  colors,
  fontFamily,
  formatDate,
  formatMoney,
  radii,
  shadow,
  spacing,
} from "../theme";

export default function DashboardScreen({ navigation }) {
  const { overview, session } = useBanking();
  const movements = overview?.movements || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AccountOverview overview={overview} user={session} />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>ACTIVIDAD RECIENTE</Text>
            <Text style={styles.sectionTitle}>Movimientos</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{movements.length}</Text>
          </View>
        </View>

        <View style={[styles.movementCard, shadow]}>
          {movements.length ? (
            movements.map((movement, index) => (
              <MovementRow
                key={movement.transaction_id}
                movement={movement}
                divided={index < movements.length - 1}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={25}
                  color={colors.slate}
                />
              </View>
              <Text style={styles.emptyTitle}>Sin movimientos recientes</Text>
              <Text style={styles.emptyBody}>
                Tus transferencias aparecerán aquí en cuanto realices la
                primera.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate("Chat")}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Hacer una operación
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.charcoal}
                />
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MovementRow({ movement, divided }) {
  const incoming = movement.direction === "incoming";
  return (
    <View style={[styles.movementRow, divided && styles.divider]}>
      <View
        style={[
          styles.movementIcon,
          incoming ? styles.incomingIcon : styles.outgoingIcon,
        ]}
      >
        <Ionicons
          name={incoming ? "arrow-down" : "arrow-up"}
          size={17}
          color={incoming ? colors.success : colors.red}
        />
      </View>
      <View style={styles.movementCopy}>
        <Text style={styles.movementName}>
          {incoming ? "De " : "A "}
          {movement.counterparty}
        </Text>
        <Text style={styles.movementDate}>
          {formatDate(movement.created_at)}
        </Text>
      </View>
      <Text
        style={[
          styles.movementAmount,
          incoming && styles.incomingAmount,
        ]}
      >
        {incoming ? "+" : "−"}
        {formatMoney(movement.amount, movement.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.red,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  sectionHeading: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: colors.red,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.errorSoft,
  },
  countText: {
    color: colors.red,
    fontFamily,
    fontSize: 11,
    fontWeight: "800",
  },
  movementCard: {
    marginHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  movementRow: {
    minHeight: 68,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  movementIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  incomingIcon: {
    backgroundColor: colors.successSoft,
  },
  outgoingIcon: {
    backgroundColor: colors.errorSoft,
  },
  movementCopy: {
    flex: 1,
  },
  movementName: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  movementDate: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    marginTop: 2,
  },
  movementAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "800",
  },
  incomingAmount: {
    color: colors.success,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasStrong,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBody: {
    maxWidth: 280,
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.62,
  },
});
