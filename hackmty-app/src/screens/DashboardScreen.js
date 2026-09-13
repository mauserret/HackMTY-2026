import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
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
  const { overview, session, logout } = useBanking();
  const accounts = overview?.accounts || [];
  const checking =
    accounts.find((account) => account.type === "checking") || null;
  const credit =
    accounts.find((account) => account.type === "credit_card") || null;
  const movements = overview?.movements || [];

  const userName = session?.name || overview?.user?.name || "Usuario";
  const balance = Number(
    overview?.available_balance ?? checking?.balance ?? 0,
  );
  const creditBalance = Number(
    overview?.credit_balance_owed ?? credit?.balance_owed ?? credit?.balance ?? 0,
  );
  const creditLimit = Number(credit?.credit_limit || 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      
      {/* HEADER SUPERIOR INSTITUCIONAL CON LOGOTIPO */}
      <View style={styles.appHeader}>
        <Image 
          source={require("../assets/logo.png")} 
          style={styles.headerLogoImage} 
          resizeMode="contain" 
        />
        <View style={styles.headerRightActions}>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En línea</Text>
          </View>
          <View style={styles.badgeIconButton}>
            <Text style={styles.badgeIconLetter}>
            {userName ? userName.charAt(0).toUpperCase() : "B"}
          </Text>
        </View>
          <Pressable onPress={logout} style={styles.logoutButton} accessibilityRole="button">
            <Feather name="log-out" size={18} color="#EB0029" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* SECCIÓN PANORAMA / SALUDO */}
        <View style={styles.panoramaHeader}>
          <View>
            <Text style={styles.eyebrow}>TU PANORAMA</Text>
            <Text style={styles.panoramaTitle}>Hola, {userName}</Text>
          </View>
          <Pressable style={styles.eyeToggle}>
            <Feather name="eye" size={18} color="#323648" />
          </Pressable>
        </View>

        {/* TARJETAS DE CUENTAS (ESTILO BANORTE DUAL) */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.cardsContainer}
        >
          {/* Tarjeta de Cuenta Principal (Débito) con Gris Banorte #5B6670 */}
          <View style={[styles.accountCardPrimary, shadow]}>
            <View style={styles.cardIconBox}>
              <Feather name="briefcase" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.accountCardType}>
                {checking?.name || "Cuenta Banorte"}
              </Text>
              <Text style={styles.accountCardBalance}>
                {formatMoney(balance, overview?.currency || "MXN")}
              </Text>
              <Text style={styles.accountCardSubtitle}>Saldo disponible</Text>
            </View>
          </View>

          {/* Tarjeta de Crédito Secundaria */}
          <View style={[styles.accountCardSecondary, shadow]}>
            <View style={styles.cardHeaderSecondary}>
              <Feather name="credit-card" size={16} color="#323648" />
              <Text style={styles.cardTypeLabel}>CRÉDITO</Text>
            </View>
            <View style={styles.cardBodySecondary}>
              {credit ? (
                <>
                  <Text style={styles.accountCardTypeDark}>
                    {credit.name || "Tarjeta Banorte"}
                  </Text>
                  <Text style={styles.creditBalance}>
                    {formatMoney(creditBalance, credit.currency || "MXN")}
                  </Text>
                  <Text style={styles.noCardText}>
                    {creditLimit
                      ? `Límite ${formatMoney(creditLimit, credit.currency || "MXN")}`
                      : "Saldo utilizado"}
                  </Text>
                </>
              ) : (
                <Text style={styles.noCardText}>Sin tarjeta asociada</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* SECCIÓN ACTIVIDAD RECIENTE */}
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
                key={movement.transaction_id || index}
                movement={movement}
                divided={index < movements.length - 1}
              />
            ))
          ) : (
            <Text style={styles.emptyMovements}>
              Aún no hay movimientos recientes.
            </Text>
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
          size={16}
          color={incoming ? colors.success : colors.red}
        />
      </View>
      <View style={styles.movementCopy}>
        <Text style={styles.movementName}>
          {incoming ? "De " : "A "}
          {movement.counterparty}
        </Text>
        <Text style={styles.movementDate}>
          {formatDate ? formatDate(movement.created_at) : "12 sep 2026, 9:33 p.m."}
        </Text>
      </View>
      <Text
        style={[
          styles.movementAmount,
          incoming && styles.incomingAmount,
        ]}
      >
        {incoming ? "+" : "−"}
        {formatMoney ? formatMoney(movement.amount, movement.currency) : `$${movement.amount}.00`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EB0029',
  },
  appHeader: {
    height: 56,
    backgroundColor: '#EB0029',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#D30024'
  },
  headerLogoImage: {
    width: 130,
    height: 32,
    tintColor: '#FFFFFF',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
  },
  onlineText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconLetter: {
    color: '#EB0029',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logoutButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  panoramaHeader: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: colors.red,
    fontFamily: 'Gotham-Bold',
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  panoramaTitle: {
    color: colors.charcoal,
    fontFamily: 'Gotham-Bold',
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  eyeToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  accountCardPrimary: {
    width: 270,
    height: 135,
    borderRadius: radii.card,
    backgroundColor: '#5B6670', // <--- Color Gris Banorte aplicado aquí
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCardType: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
  accountCardBalance: {
    color: '#FFFFFF',
    fontFamily: 'Gotham-Bold',
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 2,
  },
  accountCardSubtitle: {
    color: '#D1D5DB',
    fontSize: 10,
  },
  accountCardSecondary: {
    width: 210,
    height: 135,
    borderRadius: radii.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardHeaderSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTypeLabel: {
    color: '#323648',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardBodySecondary: {
    justifyContent: 'center',
    flex: 1,
  },
  noCardText: {
    color: '#7F8C8D',
    fontSize: 12,
  },
  accountCardTypeDark: {
    color: '#5B6670',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  creditBalance: {
    color: '#323648',
    fontFamily: 'Gotham-Bold',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyMovements: {
    color: '#7F8C8D',
    fontSize: 13,
    paddingVertical: 8,
  },
  sectionHeading: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.charcoal,
    fontFamily: 'Gotham-Bold',
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorSoft,
  },
  countText: {
    color: colors.red,
    fontFamily: 'Gotham-Bold',
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
    minHeight: 65,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  movementIcon: {
    width: 36,
    height: 36,
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
    fontFamily: 'Gotham-Bold',
    fontSize: 13,
    fontWeight: "700",
  },
  movementDate: {
    color: colors.muted,
    fontFamily: 'Gotham-Bold',
    fontSize: 10,
    marginTop: 2,
  },
  movementAmount: {
    color: colors.charcoal,
    fontFamily: 'Gotham-Bold',
    fontSize: 13,
    fontWeight: "800",
  },
  incomingAmount: {
    color: colors.success,
  },
});