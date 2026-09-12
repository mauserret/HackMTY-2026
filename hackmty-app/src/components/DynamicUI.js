import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
} from "react-native-svg";

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
      <GeneratedCard icon="chatbubble-ellipses-outline" title="Asistente Banorte">
        <Text style={styles.body}>{message.text}</Text>
      </GeneratedCard>
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
    case "financial_chart":
      return <FinancialChart data={data} rating={rating} />;
    case "transactions_summary":
      return (
        <TransactionsSummary
          data={data}
          onSendMessage={onSendMessage}
          rating={rating}
        />
      );
    case "transaction_detail":
      return <TransactionDetail data={data} rating={rating} />;
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

function GeneratedCard({
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
    <GeneratedCard
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
    </GeneratedCard>
  );
}

function FinancialChart({ data, rating }) {
  const series = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.series)
      ? data.series
      : [];
  const maxValue = Math.max(
    ...series.map((item) => Number(item.value) || 0),
    1,
  );
  const chartType = ["bar", "pie", "line"].includes(data.chartType)
    ? data.chartType
    : "bar";

  return (
    <GeneratedCard
      icon="bar-chart-outline"
      title={data.title || "Actividad financiera"}
      eyebrow="ANÁLISIS GENERADO"
    >
      {data.message ? <Text style={styles.body}>{data.message}</Text> : null}
      <View style={styles.chart}>
        {chartType === "pie" ? (
          <PieChart series={series} currency={data.currency} />
        ) : chartType === "line" ? (
          <LineChart
            series={series}
            maxValue={maxValue}
            currency={data.currency}
          />
        ) : (
          <BarChart
            series={series}
            maxValue={maxValue}
            currency={data.currency}
          />
        )}
      </View>
      {rating}
    </GeneratedCard>
  );
}

const CHART_COLORS = [
  colors.red,
  colors.charcoal,
  colors.success,
  colors.warning,
  "#547AA5",
  "#8D6A9F",
];

function BarChart({ series, maxValue, currency }) {
  return (
    <View style={styles.barChart}>
      {series.map((item, index) => {
        const value = Number(item.value) || 0;
        const height = value ? Math.max(8, (value / maxValue) * 105) : 2;
        return (
          <View key={`${item.label}-${index}`} style={styles.barColumn}>
            <Text style={styles.barValue} numberOfLines={1}>
              {formatMoney(value, currency)}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.verticalBar,
                  {
                    height,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PieChart({ series, currency }) {
  const total = series.reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  );
  const circumference = 2 * Math.PI * 44;
  let consumed = 0;
  return (
    <View style={styles.pieLayout}>
      <View style={styles.pieShell}>
        <Svg width="150" height="150" viewBox="0 0 120 120">
          <G rotation="-90" origin="60, 60">
            <Circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke={colors.canvasStrong}
              strokeWidth="18"
            />
            {series.map((item, index) => {
              const fraction = total ? (Number(item.value) || 0) / total : 0;
              const dash = fraction * circumference;
              const offset = consumed * circumference;
              consumed += fraction;
              return (
                <Circle
                  key={`${item.label}-${index}`}
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.pieCenter}>
          <Text style={styles.pieTotalLabel}>TOTAL</Text>
          <Text style={styles.pieTotal} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(total, currency)}
          </Text>
        </View>
      </View>
      <View style={styles.pieLegend}>
        {series.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.legendRow}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    CHART_COLORS[index % CHART_COLORS.length],
                },
              ]}
            />
            <View style={styles.detailCopy}>
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>
                {formatMoney(item.value, currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function LineChart({ series, maxValue, currency }) {
  const width = 300;
  const height = 145;
  const left = 18;
  const right = 12;
  const top = 15;
  const bottom = 27;
  const points = series.map((item, index) => {
    const x =
      left +
      (series.length <= 1
        ? (width - left - right) / 2
        : (index * (width - left - right)) / (series.length - 1));
    const y =
      height -
      bottom -
      ((Number(item.value) || 0) / maxValue) *
        (height - top - bottom);
    return { x, y, item };
  });

  return (
    <View>
      <Svg width="100%" height="160" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          return (
            <Line
              key={ratio}
              x1={left}
              y1={y}
              x2={width - right}
              y2={y}
              stroke={colors.border}
              strokeWidth="1"
            />
          );
        })}
        <Polyline
          points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={colors.red}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map(({ x, y, item }, index) => (
          <Circle
            key={`${item.label}-${index}`}
            cx={x}
            cy={y}
            r="4.5"
            fill={colors.surface}
            stroke={colors.red}
            strokeWidth="3"
          />
        ))}
      </Svg>
      <View style={styles.lineFooter}>
        <Text style={styles.lineLabel}>{series[0]?.label || ""}</Text>
        <Text style={styles.lineTotal}>
          {formatMoney(series.at(-1)?.value || 0, currency)}
        </Text>
        <Text style={[styles.lineLabel, styles.lineLabelRight]}>
          {series.at(-1)?.label || ""}
        </Text>
      </View>
    </View>
  );
}

function ContactsList({ data, onSendMessage, rating }) {
  const contacts = Array.isArray(data) ? data : data.contacts || [];
  return (
    <GeneratedCard
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
    </GeneratedCard>
  );
}

function normalizeComparable(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function parseEditableAmount(value) {
  let clean = String(value || "")
    .replace(/[^\d.,]/g, "")
    .trim();
  if (!clean) return null;
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    clean = clean.replaceAll(thousands, "").replace(decimal, ".");
  } else {
    const separator = comma >= 0 ? "," : dot >= 0 ? "." : null;
    if (separator) {
      const parts = clean.split(separator);
      const fraction = parts.at(-1);
      clean =
        parts.length === 2 && fraction.length <= 2
          ? `${parts[0]}.${fraction}`
          : parts.join("");
    }
  }
  const amount = Number(clean);
  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100) / 100
    : null;
}

function matchContact(recipient, contacts) {
  const target = normalizeComparable(recipient);
  if (!target) return null;
  return (
    contacts.find((contact) =>
      [
        contact.alias,
        contact.display_name,
        contact.fullName,
        contact.display_name?.split(/\s+/)[0],
        contact.fullName?.split(/\s+/)[0],
        contact.accountNumber,
      ]
        .filter(Boolean)
        .some((value) => normalizeComparable(value) === target),
    ) || null
  );
}

function TransferForm({ data, onConfirm, rating }) {
  const initial = data.initialValues || {};
  const contacts = data.available_contacts || [];
  const [status, setStatus] = useState("ready");
  const [recipient, setRecipient] = useState(
    String(
      initial.recipient ??
        data.recipient_name ??
        data.to_alias ??
        "",
    ),
  );
  const [amountText, setAmountText] = useState(
    String(initial.amount ?? data.amount ?? ""),
  );
  const [concept, setConcept] = useState(
    String(initial.concept ?? data.concept ?? ""),
  );
  const [validationError, setValidationError] = useState("");
  const amount = parseEditableAmount(amountText);
  const selectedContact = matchContact(recipient, contacts);
  const keepsInitialContact =
    normalizeComparable(recipient) ===
    normalizeComparable(initial.recipient || data.recipient_name);
  const accountNumber =
    selectedContact?.accountNumber ||
    selectedContact?.account_number ||
    (keepsInitialContact
      ? initial.accountNumber || data.account_number
      : "") ||
    "";
  const bank =
    selectedContact?.bank ||
    (keepsInitialContact ? initial.bank || data.bank : "") ||
    "";
  const canSubmit =
    status === "ready" && Boolean(recipient.trim()) && Boolean(amount);

  const handleConfirm = () => {
    if (status !== "ready") return;
    if (!recipient.trim() || !amount) {
      setValidationError("Completa la persona y escribe un monto válido.");
      return;
    }
    const contact = matchContact(recipient, contacts);
    const sent = onConfirm({
      ...data,
      contact_id: contact?.contact_id || contact?.id || "",
      to_alias: contact?.alias || recipient.trim(),
      recipient_name:
        contact?.fullName || contact?.display_name || recipient.trim(),
      account_number:
        contact?.accountNumber || contact?.account_number || "",
      bank: contact?.bank || "",
      amount,
      concept: concept.trim(),
      initialValues: {
        recipient:
          contact?.fullName || contact?.display_name || recipient.trim(),
        amount: String(amount),
        concept: concept.trim(),
        accountNumber:
          contact?.accountNumber || contact?.account_number || "",
        bank: contact?.bank || "",
      },
    });
    if (sent !== false) {
      setValidationError("");
      setStatus("pending");
    }
  };

  return (
    <GeneratedCard
      icon="paper-plane-outline"
      title={data.title || "Revisa tu transferencia"}
      eyebrow="FORMULARIO INTERACTIVO"
    >
      <View style={styles.extractionNote}>
        <Ionicons name="sparkles-outline" size={17} color={colors.red} />
        <Text style={styles.extractionText}>
          Precargamos lo que entendimos. Puedes corregir cualquier campo.
        </Text>
      </View>

      <View style={styles.formField}>
        <View style={styles.formLabelRow}>
          <Text style={styles.formLabel}>Persona</Text>
          {initial.recipient ? (
            <Text style={styles.detectedLabel}>DETECTADO</Text>
          ) : null}
        </View>
        <View style={styles.formInputShell}>
          <Ionicons name="person-outline" size={18} color={colors.slate} />
          <TextInput
            value={recipient}
            onChangeText={(value) => {
              setRecipient(value);
              setValidationError("");
            }}
            editable={status === "ready"}
            placeholder="Nombre o alias"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            maxLength={64}
            style={styles.formInput}
            accessibilityLabel="Persona destinataria"
          />
        </View>
        {contacts.length ? (
          <View style={styles.contactSuggestions}>
            {contacts.map((contact) => (
              <Pressable
                key={contact.alias}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar a ${contact.display_name}`}
                disabled={status !== "ready"}
                onPress={() => {
                  setRecipient(
                    contact.fullName || contact.display_name,
                  );
                  setValidationError("");
                }}
                style={({ pressed }) => [
                  styles.contactSuggestion,
                  matchContact(recipient, [contact]) &&
                    styles.contactSuggestionSelected,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text
                  style={[
                    styles.contactSuggestionText,
                    matchContact(recipient, [contact]) &&
                      styles.contactSuggestionTextSelected,
                  ]}
                >
                  {(contact.fullName || contact.display_name).split(/\s+/)[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.canonicalAccount}>
        <View style={styles.canonicalAccountIcon}>
          <Ionicons name="business-outline" size={17} color={colors.slate} />
        </View>
        <View style={styles.detailCopy}>
          <Text style={styles.canonicalAccountLabel}>CUENTA VALIDADA</Text>
          <Text style={styles.canonicalAccountValue}>
            {accountNumber || "Selecciona un contacto guardado"}
          </Text>
        </View>
        {bank ? <Text style={styles.bankLabel}>{bank}</Text> : null}
      </View>

      <View style={styles.formField}>
        <View style={styles.formLabelRow}>
          <Text style={styles.formLabel}>Monto</Text>
          {initial.amount !== "" && initial.amount !== undefined ? (
            <Text style={styles.detectedLabel}>DETECTADO</Text>
          ) : null}
        </View>
        <View style={styles.formInputShell}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            value={amountText}
            onChangeText={(value) => {
              setAmountText(value);
              setValidationError("");
            }}
            editable={status === "ready"}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            maxLength={18}
            style={styles.formInput}
            accessibilityLabel="Monto de la transferencia"
          />
          <Text style={styles.currencySuffix}>MXN</Text>
        </View>
      </View>

      <View style={styles.formField}>
        <View style={styles.formLabelRow}>
          <Text style={styles.formLabel}>Concepto</Text>
          <Text style={styles.optionalLabel}>
            {initial.concept ? "DETECTADO" : "OPCIONAL"}
          </Text>
        </View>
        <View style={styles.formInputShell}>
          <Ionicons
            name="document-text-outline"
            size={18}
            color={colors.slate}
          />
          <TextInput
            value={concept}
            onChangeText={setConcept}
            editable={status === "ready"}
            placeholder="Ej. Cena"
            placeholderTextColor={colors.muted}
            maxLength={120}
            style={styles.formInput}
            accessibilityLabel="Concepto de la transferencia"
          />
        </View>
      </View>

      {validationError ? (
        <Text style={styles.formError} accessibilityRole="alert">
          {validationError}
        </Text>
      ) : null}

      <View style={styles.securityNote}>
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color={colors.success}
        />
        <Text style={styles.securityText}>
          El dinero no se moverá hasta que confirmes estos datos.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={handleConfirm}
        style={({ pressed }) => [
          styles.primaryButton,
          !canSubmit && styles.disabledButton,
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
              {amount
                ? `Confirmar ${formatMoney(amount)}`
                : "Confirmar transferencia"}
            </Text>
          </>
        )}
      </Pressable>
      {rating}
    </GeneratedCard>
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
        {data.concept ? (
          <ReceiptRow label="Concepto" value={data.concept} />
        ) : null}
        <ReceiptRow label="Estado" value="Completada" success />
      </View>
      {rating}
    </View>
  );
}

function TransactionsSummary({ data, onSendMessage, rating }) {
  const groups = data.groups || [];
  const totals = data.totals || {};
  return (
    <GeneratedCard
      icon="receipt-outline"
      title={data.title || "Resumen de operaciones"}
      eyebrow="HISTORIAL FINANCIERO"
    >
      <View style={styles.summaryTotals}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryMetricLabel}>ENTRADAS</Text>
          <Text style={[styles.summaryMetricValue, styles.incomingText]}>
            {formatMoney(totals.incoming)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryMetricLabel}>SALIDAS</Text>
          <Text style={[styles.summaryMetricValue, styles.outgoingText]}>
            {formatMoney(totals.outgoing)}
          </Text>
        </View>
      </View>

      {groups.length ? (
        groups.map((group) => (
          <View key={group.date} style={styles.transactionGroup}>
            <Text style={styles.transactionDate}>
              {formatDate(`${group.date}T12:00:00`)}
            </Text>
            {group.transactions.map((transaction) => {
              const incoming = transaction.direction === "incoming";
              const counterparty = incoming
                ? transaction.sender
                : transaction.recipient;
              return (
                <Pressable
                  key={transaction.transactionId}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalle de ${counterparty}`}
                  onPress={() =>
                    onSendMessage(
                      `Detalle de la operación ${transaction.transactionId}`,
                    )
                  }
                  style={({ pressed }) => [
                    styles.transactionRow,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.transactionIcon,
                      incoming
                        ? styles.transactionIconIncoming
                        : styles.transactionIconOutgoing,
                    ]}
                  >
                    <Ionicons
                      name={incoming ? "arrow-down" : "arrow-up"}
                      size={16}
                      color={incoming ? colors.success : colors.red}
                    />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={styles.transactionName}>{counterparty}</Text>
                    <Text style={styles.transactionConcept}>
                      {transaction.concept || transaction.category}
                    </Text>
                  </View>
                  <View style={styles.transactionAmountBlock}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        incoming && styles.incomingText,
                      ]}
                    >
                      {incoming ? "+" : "−"}
                      {formatMoney(transaction.amount)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={colors.disabled}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      ) : (
        <Text style={styles.emptySummary}>
          {data.empty_message || "No hay operaciones para mostrar."}
        </Text>
      )}
      {rating}
    </GeneratedCard>
  );
}

function TransactionDetail({ data, rating }) {
  const transaction = data.transaction || data;
  const incoming = transaction.direction === "incoming";
  return (
    <GeneratedCard
      icon="document-text-outline"
      title={data.title || "Detalle de operación"}
      eyebrow="COMPROBANTE"
      accent={incoming ? colors.success : colors.red}
    >
      <View style={styles.detailHero}>
        <Text style={styles.metricLabel}>
          {incoming ? "TRANSFERENCIA RECIBIDA" : "TRANSFERENCIA ENVIADA"}
        </Text>
        <Text style={styles.detailHeroAmount}>
          {formatMoney(transaction.amount, transaction.currency)}
        </Text>
        <Text style={styles.detailHeroPerson}>
          {incoming
            ? `De ${transaction.sender}`
            : `A ${transaction.recipient}`}
        </Text>
      </View>
      <View style={styles.receipt}>
        <ReceiptRow
          label="Fecha"
          value={formatDate(transaction.timestamp)}
        />
        <ReceiptRow
          label="Concepto"
          value={transaction.concept || "Sin concepto"}
        />
        <ReceiptRow
          label="Categoría"
          value={transaction.category || "Transferencias"}
        />
        {transaction.accountNumber ? (
          <ReceiptRow
            label="Cuenta"
            value={`•••• ${transaction.accountNumber.slice(-4)}`}
          />
        ) : null}
        {transaction.bank ? (
          <ReceiptRow label="Banco" value={transaction.bank} />
        ) : null}
        <ReceiptRow
          label="Folio"
          value={String(transaction.transactionId || "").toUpperCase()}
        />
        <ReceiptRow
          label="Estado"
          value={
            transaction.status === "completed"
              ? "Completada"
              : transaction.status
          }
          success={transaction.status === "completed"}
        />
      </View>
      {rating}
    </GeneratedCard>
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
    <GeneratedCard
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
    </GeneratedCard>
  );
}

function ClarificationCard({ data, onSendMessage, rating }) {
  const choices =
    data.choices || data.options || data.quick_actions || [];
  return (
    <GeneratedCard
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
    </GeneratedCard>
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
    {
      label: "Ver gráfica de movimientos",
      prompt: "Muéstrame una gráfica de mis movimientos",
      icon: "bar-chart-outline",
    },
    {
      label: "Resumen de operaciones",
      prompt: "Muéstrame el resumen de transferencias",
      icon: "receipt-outline",
    },
  ];
  const actions = data.actions?.length ? data.actions : defaultActions;

  return (
    <GeneratedCard
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
    </GeneratedCard>
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
  chart: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  chartRow: {
    width: "100%",
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chartLabel: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  chartValue: {
    fontFamily,
    fontSize: 11,
    fontWeight: "800",
  },
  chartTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
  },
  chartBar: {
    height: "100%",
    borderRadius: 5,
  },
  barChart: {
    minHeight: 160,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  barColumn: {
    flex: 1,
    minWidth: 18,
    alignItems: "center",
  },
  barValue: {
    width: "100%",
    color: colors.slate,
    fontFamily,
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  barTrack: {
    height: 105,
    width: "70%",
    borderRadius: 5,
    backgroundColor: colors.canvasStrong,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  verticalBar: {
    width: "100%",
    borderRadius: 5,
  },
  barLabel: {
    width: "100%",
    color: colors.muted,
    fontFamily,
    fontSize: 7,
    textAlign: "center",
    marginTop: 5,
  },
  pieLayout: {
    flexDirection: "row",
    alignItems: "center",
  },
  pieShell: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenter: {
    position: "absolute",
    width: 80,
    alignItems: "center",
  },
  pieTotalLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  pieTotal: {
    width: 78,
    color: colors.charcoal,
    fontFamily,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },
  pieLegend: {
    flex: 1,
    gap: 7,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 7,
  },
  legendLabel: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 9,
    fontWeight: "700",
  },
  legendValue: {
    color: colors.muted,
    fontFamily,
    fontSize: 8,
    marginTop: 1,
  },
  lineFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -18,
    paddingHorizontal: 17,
  },
  lineLabel: {
    flex: 1,
    color: colors.muted,
    fontFamily,
    fontSize: 8,
  },
  lineLabelRight: {
    textAlign: "right",
  },
  lineTotal: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
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
  extractionNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  extractionText: {
    flex: 1,
    color: colors.slate,
    fontFamily,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: 7,
  },
  formField: {
    marginBottom: spacing.md,
  },
  formLabelRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formLabel: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  detectedLabel: {
    color: colors.red,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  optionalLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  formInputShell: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.canvasStrong,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  formInput: {
    flex: 1,
    color: colors.charcoal,
    fontFamily,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  currencyPrefix: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 18,
    fontWeight: "700",
  },
  currencySuffix: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
  },
  contactSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },
  contactSuggestion: {
    minHeight: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contactSuggestionSelected: {
    borderColor: colors.red,
    backgroundColor: colors.errorSoft,
  },
  contactSuggestionText: {
    color: colors.slate,
    fontFamily,
    fontSize: 9,
    fontWeight: "700",
  },
  contactSuggestionTextSelected: {
    color: colors.red,
  },
  canonicalAccount: {
    minHeight: 53,
    borderRadius: 10,
    backgroundColor: colors.infoSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    marginTop: -5,
    marginBottom: spacing.md,
  },
  canonicalAccountIcon: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  canonicalAccountLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  canonicalAccountValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  bankLabel: {
    color: colors.slate,
    fontFamily,
    fontSize: 9,
    fontWeight: "700",
  },
  formError: {
    color: colors.red,
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    marginTop: -5,
    marginBottom: spacing.sm,
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
  summaryTotals: {
    minHeight: 72,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  summaryMetric: {
    flex: 1,
    alignItems: "center",
  },
  summaryMetricLabel: {
    color: colors.muted,
    fontFamily,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summaryMetricValue: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 35,
    backgroundColor: colors.border,
  },
  incomingText: {
    color: colors.success,
  },
  outgoingText: {
    color: colors.red,
  },
  transactionGroup: {
    marginBottom: spacing.md,
  },
  transactionDate: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  transactionRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  transactionIconIncoming: {
    backgroundColor: colors.successSoft,
  },
  transactionIconOutgoing: {
    backgroundColor: colors.errorSoft,
  },
  transactionName: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
  },
  transactionConcept: {
    color: colors.muted,
    fontFamily,
    fontSize: 9,
    marginTop: 2,
  },
  transactionAmountBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  transactionAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 10,
    fontWeight: "800",
  },
  emptySummary: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  detailHero: {
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: "center",
    padding: spacing.lg,
  },
  detailHeroAmount: {
    color: colors.charcoal,
    fontFamily,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  detailHeroPerson: {
    color: colors.slate,
    fontFamily,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
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
