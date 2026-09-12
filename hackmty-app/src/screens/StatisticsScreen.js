import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AppHeader from "../components/AppHeader";
import { useBanking } from "../context/BankingContext";
import {
  colors,
  fontFamily,
  formatMoney,
  radii,
  shadow,
  spacing,
} from "../theme";

export default function StatisticsScreen() {
  const { messages, overview } = useBanking();
  const metrics = useMemo(() => {
    const movements = overview?.movements || [];
    const accounts = overview?.accounts || [];
    const checking = accounts.find((account) => account.type === "checking");
    const credit = accounts.find((account) => account.type === "credit_card");
    const incoming = movements
      .filter((movement) => movement.direction === "incoming")
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const outgoing = movements
      .filter((movement) => movement.direction === "outgoing")
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const generated = messages.filter(
      (message) => message.role === "assistant" && message.data.type === "ui",
    );
    const ratings = generated
      .map((message) => message.rating)
      .filter((rating) => Number.isFinite(rating));

    return {
      balance: Number(checking?.balance || 0),
      creditUsed: Number(credit?.balance_owed ?? credit?.balance ?? 0),
      incoming,
      outgoing,
      movementCount: movements.length,
      generatedCount: generated.length,
      averageRating: ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) /
          ratings.length /
          2
        : null,
    };
  }, [messages, overview]);

  const flowMax = Math.max(metrics.incoming, metrics.outgoing, 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>RESUMEN PERSONAL</Text>
        <Text style={styles.title}>Estadísticas</Text>
        <Text style={styles.subtitle}>
          Métricas calculadas con tu sesión y movimientos más recientes.
        </Text>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="wallet-outline"
            label="Saldo disponible"
            value={formatMoney(metrics.balance)}
            tone="dark"
          />
          <MetricCard
            icon="card-outline"
            label="Crédito utilizado"
            value={formatMoney(metrics.creditUsed)}
          />
          <MetricCard
            icon="sparkles-outline"
            label="Interfaces creadas"
            value={String(metrics.generatedCount)}
          />
          <MetricCard
            icon="star-outline"
            label="Utilidad promedio"
            value={
              metrics.averageRating === null
                ? "Sin evaluar"
                : `${metrics.averageRating.toFixed(1)} / 5`
            }
          />
        </View>

        <View style={[styles.chartCard, shadow]}>
          <View style={styles.chartHeading}>
            <View>
              <Text style={styles.chartEyebrow}>FLUJO RECIENTE</Text>
              <Text style={styles.chartTitle}>Entradas y salidas</Text>
            </View>
            <View style={styles.movementBadge}>
              <Text style={styles.movementBadgeText}>
                {metrics.movementCount} movimientos
              </Text>
            </View>
          </View>

          <FlowBar
            label="Entradas"
            value={metrics.incoming}
            max={flowMax}
            color={colors.success}
          />
          <FlowBar
            label="Salidas"
            value={metrics.outgoing}
            max={flowMax}
            color={colors.red}
          />
        </View>

        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.slate}
          />
          <Text style={styles.noteText}>
            Los valores se actualizan automáticamente después de cada
            transferencia confirmada.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value, tone = "light" }) {
  const dark = tone === "dark";
  return (
    <View style={[styles.metricCard, dark && styles.metricCardDark, shadow]}>
      <View style={[styles.metricIcon, dark && styles.metricIconDark]}>
        <Ionicons
          name={icon}
          size={18}
          color={dark ? colors.red : colors.charcoal}
        />
      </View>
      <Text style={[styles.metricLabel, dark && styles.metricTextMuted]}>
        {label}
      </Text>
      <Text
        style={[styles.metricValue, dark && styles.metricTextLight]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function FlowBar({ label, value, max, color }) {
  const width = value ? Math.max(7, (value / max) * 100) : 0;
  return (
    <View style={styles.flowRow}>
      <View style={styles.flowLabels}>
        <Text style={styles.flowLabel}>{label}</Text>
        <Text style={styles.flowValue}>{formatMoney(value)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, { backgroundColor: color, width: `${width}%` }]} />
      </View>
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
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    color: colors.red,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 27,
    fontWeight: "700",
    marginTop: 2,
  },
  subtitle: {
    color: colors.slate,
    fontFamily,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    width: "48.4%",
    minHeight: 125,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  metricCardDark: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.canvasStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  metricIconDark: {
    backgroundColor: colors.surface,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "600",
  },
  metricValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  metricTextMuted: {
    color: "#DDE2E5",
  },
  metricTextLight: {
    color: colors.surface,
  },
  chartCard: {
    marginTop: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  chartHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  chartEyebrow: {
    color: colors.red,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chartTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  movementBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.canvasStrong,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  movementBadgeText: {
    color: colors.slate,
    fontFamily,
    fontSize: 8,
    fontWeight: "700",
  },
  flowRow: {
    marginBottom: spacing.md,
  },
  flowLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  flowLabel: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  flowValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 11,
    fontWeight: "800",
  },
  track: {
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 5,
  },
  note: {
    marginTop: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.infoSoft,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteText: {
    flex: 1,
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: 7,
  },
});
