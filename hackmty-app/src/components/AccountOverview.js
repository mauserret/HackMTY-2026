import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  colors,
  fontFamily,
  formatMoney,
  radii,
  shadow,
  spacing,
} from "../theme";

function hiddenMoney(hidden, value) {
  return hidden ? "$ ••••••" : formatMoney(value);
}

export default function AccountOverview({ overview, user }) {
  const [hidden, setHidden] = useState(false);
  const accounts = overview?.accounts || user?.accounts || [];

  const { checking, credit } = useMemo(
    () => ({
      checking: accounts.find((account) => account.type === "checking"),
      credit: accounts.find((account) => account.type === "credit_card"),
    }),
    [accounts]
  );

  const availableCredit =
    Number(credit?.credit_limit || 0) -
    Number(credit?.balance_owed ?? credit?.balance ?? 0);

  return (
    <View style={styles.shell}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>TU PANORAMA</Text>
          <Text style={styles.greeting}>
            Hola, {(overview?.name || user?.name || "").split(" ")[0]}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Mostrar saldos" : "Ocultar saldos"}
          hitSlop={10}
          onPress={() => setHidden((value) => !value)}
          style={({ pressed }) => [
            styles.eyeButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={hidden ? "eye-off-outline" : "eye-outline"}
            size={19}
            color={colors.slate}
          />
        </Pressable>
      </View>

      <View style={styles.cardsRow}>
        <View style={[styles.balanceCard, shadow]}>
          <View style={styles.cardIcon}>
            <Ionicons name="wallet-outline" size={18} color={colors.red} />
          </View>
          <Text style={styles.accountLabel}>Cuenta Banorte</Text>
          <Text
            style={styles.primaryAmount}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {hiddenMoney(hidden, checking?.balance)}
          </Text>
          <Text style={styles.caption}>Saldo disponible</Text>
        </View>

        <View style={[styles.creditCard, shadow]}>
          <View style={styles.creditTopRow}>
            <Ionicons name="card-outline" size={18} color={colors.charcoal} />
            <Text style={styles.creditTag}>CRÉDITO</Text>
          </View>
          {credit ? (
            <>
              <Text style={styles.creditAmount}>
                {hiddenMoney(
                  hidden,
                  credit.balance_owed ?? credit.balance
                )}
              </Text>
              <Text style={styles.caption}>Saldo utilizado</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressValue,
                    {
                      width: `${Math.min(
                        100,
                        (Number(credit.balance_owed ?? credit.balance ?? 0) /
                          Number(credit.credit_limit || 1)) *
                          100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.available}>
                {hidden
                  ? "Disponible: ••••"
                  : `Disponible: ${formatMoney(availableCredit)}`}
              </Text>
            </>
          ) : (
            <View style={styles.noCredit}>
              <Text style={styles.noCreditText}>Sin tarjeta asociada</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  greeting: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.65,
  },
  cardsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  balanceCard: {
    flex: 1.12,
    minHeight: 137,
    borderRadius: radii.card,
    backgroundColor: colors.charcoal,
    padding: spacing.md,
  },
  creditCard: {
    flex: 0.88,
    minHeight: 137,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  accountLabel: {
    color: "#DDE2E5",
    fontFamily,
    fontSize: 11,
    fontWeight: "600",
  },
  primaryAmount: {
    color: colors.surface,
    fontFamily,
    fontSize: 23,
    fontWeight: "700",
    marginTop: 2,
  },
  caption: {
    color: colors.muted,
    fontFamily,
    fontSize: 10,
    marginTop: 2,
  },
  creditTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creditTag: {
    color: colors.slate,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  creditAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 9,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.canvasStrong,
    marginTop: 9,
    overflow: "hidden",
  },
  progressValue: {
    height: "100%",
    backgroundColor: colors.red,
    borderRadius: 2,
  },
  available: {
    color: colors.slate,
    fontFamily,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 6,
  },
  noCredit: {
    flex: 1,
    justifyContent: "center",
  },
  noCreditText: {
    color: colors.muted,
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
  },
});
