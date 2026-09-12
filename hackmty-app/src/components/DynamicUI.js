import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import StarRating from "./StarRating";
import {
  colors,
  fontFamily,
  formatDate,
  formatMoney,
  radii,
  shadow,
  spacing,
} from "../theme";

export default function DynamicUI({
  message,
  onConfirmTransfer,
  onSendMessage,
  onRate,
  savedRating,
}) {
  if (!message) return null;

  if (message.type === "error") {
    return <ErrorCard message={message.message} code={message.code} />;
  }

  if (message.type === "text") {
    return (
      <A2UICard icon="chatbubble-ellipses-outline" title="Asistente Banorte">
        <Text style={styles.body}>{message.text}</Text>
      </A2UICard>
    );
  }

  if (message.type !== "ui") return null;

  const data = message.props || {};
  const interactionId =
    message.interaction_id || message.interactionId;
  const rating = (
    <StarRating
      interactionId={interactionId}
      onRate={onRate}
      savedRating={savedRating}
    />
  );

  switch (message.component) {
    case "balance_card":
      return <BalanceCard data={data} rating={rating} />;
    case "contacts_list":
      return (
        <ContactsList
          data={data}
          onSendMessage={onSendMessage}
          rating={rating}
        />
      );
    case "transfer_form":
      return (
        <TransferForm
          data={data}
          onConfirm={onConfirmTransfer}
          rating={rating}
        />
      );
    case "transfer_success":
      return <TransferSuccess data={data} rating={rating} />;
    case "credit_plan_table":
      return <CreditPlanTable data={data} rating={rating} />;
    case "clarification_card":
      return (
        <ClarificationCard
          data={data}
          onSendMessage={onSendMessage}
          rating={rating}
        />
      );
    case "quick_actions":
      return (
        <QuickActions
          data={data}
          onSendMessage={onSendMessage}
          rating={rating}
        />
      );
    default:
      return (
        <ErrorCard
          message={`La interfaz “${message.component}” todavía no está disponible.`}
          code="UNKNOWN_COMPONENT"
        />
      );
  }
}

function A2UICard({
  icon,
  eyebrow = "INTERFAZ GENERADA",
  title,
  children,
  accent = colors.red,
}) {
  return (
    <View style={[styles.card, shadow]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${accent}12` }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function BalanceCard({ data, rating }) {
  const accounts = data.accounts || [];
  const checking = accounts.find((account) => account.type === "checking");
  const credit = accounts.find((account) => account.type === "credit_card");
  const checkingBalance =
    data.checking_balance ?? checking?.balance ?? data.balance;
  const creditBalance =
    data.credit_balance ??
    credit?.balance_owed ??
    credit?.balance;
  const creditLimit = data.credit_limit ?? credit?.credit_limit;
  const ownerName = data.name || data.user?.name;

  return (
    <A2UICard
      icon="wallet-outline"
      title={
        ownerName ? `Saldos de ${ownerName.split(" ")[0]}` : "Tus saldos"
      }
    >
      <View style={styles.balanceHero}>
        <Text style={styles.metricLabel}>DISPONIBLE EN CUENTA</Text>
        <Text style={styles.balanceValue}>
          {formatMoney(checkingBalance)}
        </Text>
      </View>
      {creditBalance !== undefined && (
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons
              name="card-outline"
              size={17}
              color={colors.charcoal}
            />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Tarjeta de crédito</Text>
            <Text style={styles.detailHint}>
              {creditLimit
                ? `Límite ${formatMoney(creditLimit)}`
                : "Saldo utilizado"}
            </Text>
          </View>
          <Text style={styles.detailValue}>
            {formatMoney(creditBalance)}
          </Text>
        </View>
      )}
      {rating}
    </A2UICard>
  );
}

function ContactsList({ data, onSendMessage, rating }) {
  const contacts = Array.isArray(data) ? data : data.contacts || [];
  return (
    <A2UICard
      icon="people-outline"
      title="¿A quién le enviamos?"
      eyebrow={`${contacts.length} CONTACTOS DISPONIBLES`}
    >
      <View style={styles.contactList}>
        {contacts.map((contact, index) => {
          const alias = contact.alias || contact.name;
          const displayName =
            contact.display_name || contact.name || contact.alias;
          return (
            <Pressable
              key={contact.contact_user_id || contact.account_id || alias}
              accessibilityRole="button"
              accessibilityLabel={`Transferir a ${alias}`}
              onPress={() => onSendMessage(`Quiero transferirle a ${alias}`)}
              style={({ pressed }) => [
                styles.contactRow,
                index < contacts.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName?.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.contactName}>{displayName}</Text>
                <Text style={styles.detailHint}>
                  Cuenta ••••{" "}
                  {(contact.account_id || contact.account || "").slice(-4)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.disabled}
              />
            </Pressable>
          );
        })}
      </View>
      {rating}
    </A2UICard>
  );
}

function TransferForm({ data, onConfirm, rating }) {
  const [status, setStatus] = useState("ready");
  const recipient =
    data.recipient_name ||
    data.suggested_contact ||
    data.to_alias ||
    data.recipient ||
    data.alias ||
    "contacto";
  const amount = Number(data.amount) || 0;

  const handleConfirm = () => {
    if (status !== "ready") return;
    const sent = onConfirm(data);
    if (sent !== false) setStatus("pending");
  };

  return (
    <A2UICard
      icon="paper-plane-outline"
      title="Confirma tu transferencia"
      eyebrow="REVISIÓN OBLIGATORIA"
    >
      <View style={styles.transferAmountBlock}>
        <Text style={styles.metricLabel}>Vas a enviar</Text>
        <Text style={styles.transferAmount}>{formatMoney(amount)}</Text>
        <View style={styles.recipientPill}>
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>
              {recipient.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.recipientText}>a {recipient}</Text>
        </View>
      </View>

      <View style={styles.securityNote}>
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color={colors.success}
        />
        <Text style={styles.securityText}>
          El dinero no se moverá hasta que confirmes esta operación.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={status !== "ready" || !amount}
        onPress={handleConfirm}
        style={({ pressed }) => [
          styles.primaryButton,
          (status !== "ready" || !amount) && styles.disabledButton,
          pressed && styles.primaryPressed,
        ]}
      >
        {status === "pending" ? (
          <>
            <Ionicons name="time-outline" size={18} color={colors.surface} />
            <Text style={styles.primaryButtonText}>Procesando…</Text>
          </>
        ) : (
          <>
            <Ionicons
              name="lock-closed-outline"
              size={17}
              color={colors.surface}
            />
            <Text style={styles.primaryButtonText}>
              Confirmar {formatMoney(amount)}
            </Text>
          </>
        )}
      </Pressable>
      {rating}
    </A2UICard>
  );
}

function TransferSuccess({ data, rating }) {
  const amount = data.amount;
  const recipient =
    data.recipient ||
    data.to_alias ||
    data.toAlias ||
    data.to_account ||
    "destinatario";
  const transactionId =
    data.transaction_id || data.transactionId || data._id || data.id;
  const date = data.date || data.created_at || data.createdAt;

  return (
    <View style={[styles.successCard, shadow]}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={31} color={colors.surface} />
      </View>
      <Text style={styles.successEyebrow}>OPERACIÓN COMPLETADA</Text>
      <Text style={styles.successTitle}>Transferencia exitosa</Text>
      <Text style={styles.successAmount}>{formatMoney(amount)}</Text>
      <Text style={styles.successRecipient}>Enviados a {recipient}</Text>

      <View style={styles.receipt}>
        {date ? (
          <ReceiptRow label="Fecha" value={formatDate(date)} />
        ) : null}
        {transactionId ? (
          <ReceiptRow
            label="Folio"
            value={String(transactionId).slice(-12).toUpperCase()}
          />
        ) : null}
        <ReceiptRow label="Estado" value="Completada" success />
      </View>
      {rating}
    </View>
  );
}

function ReceiptRow({ label, value, success = false }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[styles.receiptValue, success && styles.successText]}>
        {value}
      </Text>
    </View>
  );
}

function CreditPlanTable({ data, rating }) {
  const options = data.options || [];
  const recommendedIndex =
    Number.isInteger(data.recommended_index)
      ? data.recommended_index
      : Math.min(1, Math.max(0, options.length - 1));
  const [selectedIndex, setSelectedIndex] = useState(recommendedIndex);
  const selected = options[selectedIndex];
  const totalDebt =
    data.total_debt ?? data.balance ?? data.current_balance;

  return (
    <A2UICard
      icon="trending-down-outline"
      title="Opciones para pagar mejor"
      eyebrow="COMPARATIVA PERSONALIZADA"
    >
      <View style={styles.debtSummary}>
        <Text style={styles.metricLabel}>SALDO A REESTRUCTURAR</Text>
        <Text style={styles.debtValue}>{formatMoney(totalDebt)}</Text>
        <Text style={styles.debtHint}>
          Selecciona un plazo para comparar su mensualidad y CAT.
        </Text>
      </View>

      <View style={styles.planList}>
        {options.map((option, index) => {
          const selectedOption = index === selectedIndex;
          return (
            <Pressable
              key={option.months}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedOption }}
              onPress={() => setSelectedIndex(index)}
              style={[
                styles.planRow,
                selectedOption && styles.planRowSelected,
              ]}
            >
              <View
                style={[
                  styles.radio,
                  selectedOption && styles.radioSelected,
                ]}
              >
                {selectedOption && <View style={styles.radioDot} />}
              </View>
              <View style={styles.planMonths}>
                <Text
                  style={[
                    styles.planMonthValue,
                    selectedOption && styles.planSelectedText,
                  ]}
                >
                  {option.months}
                </Text>
                <Text style={styles.planMonthLabel}>meses</Text>
              </View>
              <View style={styles.planPayment}>
                <Text style={styles.planPaymentValue}>
                  {formatMoney(option.monthly_payment)}
                </Text>
                <Text style={styles.detailHint}>al mes</Text>
              </View>
              <View style={styles.catBlock}>
                <Text style={styles.catValue}>{option.cat}%</Text>
                <Text style={styles.detailHint}>CAT</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <View style={styles.planInsight}>
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={colors.red}
          />
          <Text style={styles.planInsightText}>
            {selectedIndex === recommendedIndex
              ? "Opción equilibrada: menor mensualidad sin extender al máximo el plazo."
              : `${selected.months} pagos estimados de ${formatMoney(
                  selected.monthly_payment
                )}.`}
          </Text>
        </View>
      )}
      {rating}
    </A2UICard>
  );
}

function ClarificationCard({ data, onSendMessage, rating }) {
  const choices =
    data.choices || data.options || data.quick_actions || [];
  return (
    <A2UICard
      icon="help-circle-outline"
      title={data.title || "Solo necesito un dato más"}
      eyebrow="CONFIRMEMOS CONTIGO"
      accent={colors.warning}
    >
      <Text style={styles.body}>
        {data.message ||
          data.description ||
          "Elige una opción para continuar de forma segura."}
      </Text>
      {choices.length > 0 && (
        <View style={styles.choiceList}>
          {choices.map((choice, index) => {
            const label =
              typeof choice === "string" ? choice : choice.label;
            const prompt =
              typeof choice === "string"
                ? choice
                : choice.prompt || choice.value || label;
            return (
              <Pressable
                key={`${label}-${index}`}
                accessibilityRole="button"
                onPress={() => onSendMessage(String(prompt))}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{label}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.charcoal}
                />
              </Pressable>
            );
          })}
        </View>
      )}
      {rating}
    </A2UICard>
  );
}

function QuickActions({ data, onSendMessage, rating }) {
  const defaultActions = [
    {
      label: "Consultar mi saldo",
      prompt: "¿Cuál es mi saldo disponible?",
      icon: "wallet-outline",
    },
    {
      label: "Hacer una transferencia",
      prompt: "Quiero hacer una transferencia",
      icon: "paper-plane-outline",
    },
    {
      label: "Pagar menos intereses",
      prompt: "Quiero pagar menos intereses de mi tarjeta",
      icon: "trending-down-outline",
    },
  ];
  const actions = data.actions?.length ? data.actions : defaultActions;

  return (
    <A2UICard
      icon="sparkles-outline"
      title={data.title || "¿Qué quieres resolver hoy?"}
      eyebrow="ATAJOS INTELIGENTES"
    >
      {data.message ? <Text style={styles.body}>{data.message}</Text> : null}
      <View style={styles.actionGrid}>
        {actions.map((action, index) => {
          const normalized =
            typeof action === "string"
              ? { label: action, prompt: action }
              : action;
          return (
            <Pressable
              key={`${normalized.label}-${index}`}
              accessibilityRole="button"
              onPress={() =>
                onSendMessage(normalized.prompt || normalized.label)
              }
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name={normalized.icon || "arrow-forward-circle-outline"}
                  size={20}
                  color={colors.red}
                />
              </View>
              <Text style={styles.actionLabel}>{normalized.label}</Text>
              <Ionicons
                name="chevron-forward"
                size={17}
                color={colors.disabled}
              />
            </Pressable>
          );
        })}
      </View>
      {rating}
    </A2UICard>
  );
}

function ErrorCard({ message, code }) {
  return (
    <View style={[styles.errorCard, shadow]}>
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle-outline" size={21} color={colors.red} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.errorTitle}>No pudimos completar eso</Text>
        <Text style={styles.errorMessage}>
          {message || "Intenta nuevamente en unos segundos."}
        </Text>
        {code ? <Text style={styles.errorCode}>{code}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    color: colors.slate,
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  balanceHero: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  balanceValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 3,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.canvasStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  detailHint: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    marginTop: 2,
  },
  detailValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
  },
  contactList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.58,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.surface,
    fontFamily,
    fontSize: 14,
    fontWeight: "700",
  },
  contactName: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
  },
  transferAmountBlock: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  transferAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 34,
    fontWeight: "700",
    marginTop: 4,
  },
  recipientPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallAvatar: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.charcoal,
    marginRight: 7,
  },
  smallAvatarText: {
    color: colors.surface,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
  },
  recipientText: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  securityText: {
    flex: 1,
    color: colors.success,
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    marginLeft: 7,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 45,
    borderRadius: radii.button,
    backgroundColor: colors.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  primaryPressed: {
    backgroundColor: colors.redDark,
  },
  disabledButton: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily,
    fontSize: 15,
    fontWeight: "700",
  },
  successCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CEEADD",
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  successEyebrow: {
    color: colors.success,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  successTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 3,
  },
  successAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 34,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  successRecipient: {
    color: colors.slate,
    fontFamily,
    fontSize: 12,
    marginTop: 2,
  },
  receipt: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
  },
  receiptRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  receiptLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 10,
  },
  receiptValue: {
    maxWidth: "70%",
    color: colors.charcoal,
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "right",
  },
  successText: {
    color: colors.success,
  },
  debtSummary: {
    marginBottom: spacing.md,
  },
  debtValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 26,
    fontWeight: "700",
    marginTop: 2,
  },
  debtHint: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  planList: {
    gap: 7,
  },
  planRow: {
    minHeight: 62,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  planRowSelected: {
    borderColor: colors.red,
    backgroundColor: "#FFF6F7",
  },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.disabled,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  radioSelected: {
    borderColor: colors.red,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  planMonths: {
    width: 48,
  },
  planMonthValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 16,
    fontWeight: "700",
  },
  planSelectedText: {
    color: colors.red,
  },
  planMonthLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
  },
  planPayment: {
    flex: 1,
  },
  planPaymentValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  catBlock: {
    alignItems: "flex-end",
  },
  catValue: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  planInsight: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.errorSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  planInsightText: {
    flex: 1,
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: 7,
  },
  choiceList: {
    gap: 7,
    marginTop: spacing.md,
  },
  secondaryButton: {
    minHeight: 45,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  secondaryButtonText: {
    flex: 1,
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
  },
  actionGrid: {
    gap: 7,
    marginTop: spacing.sm,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.errorSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  actionLabel: {
    flex: 1,
    color: colors.charcoal,
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
  },
  errorCard: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#F4BEC8",
  },
  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.errorSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  errorTitle: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
  },
  errorMessage: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  errorCode: {
    color: colors.muted,
    fontFamily,
    fontSize: 8,
    marginTop: 5,
  },
});
