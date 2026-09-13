import { formatMoney } from "../theme";

function joinSentences(parts) {
  return parts
    .map((part) => String(part || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function describeBalance(message) {
  const data = message.props || {};
  const accounts = data.accounts || [];
  const checking = accounts.find((account) => account.type === "checking");
  const credit = accounts.find((account) => account.type === "credit_card");
  const checkingBalance =
    data.checking_balance ?? checking?.balance ?? data.balance;
  const creditBalance =
    data.credit_balance ?? credit?.balance_owed ?? credit?.balance;
  const owner = data.name || data.user?.name;
  return joinSentences([
    owner ? `Saldos de ${owner}` : "Estos son tus saldos",
    Number.isFinite(Number(checkingBalance))
      ? `Disponible en cuenta: ${formatMoney(checkingBalance)}`
      : "",
    Number.isFinite(Number(creditBalance))
      ? `Saldo utilizado en tarjeta: ${formatMoney(creditBalance)}`
      : "",
  ]);
}

function describeTransferForm(message) {
  const data = message.props || {};
  const recipient =
    data.registered_name ||
    data.recipient_name ||
    data.to_alias ||
    data.initialValues?.recipient ||
    "";
  const amount = data.amount ?? data.initialValues?.amount;
  const concept = data.concept || data.initialValues?.concept || "";
  const missing = Array.isArray(data.missing_fields)
    ? data.missing_fields
    : [];
  return joinSentences([
    data.title || "Revisa tu transferencia",
    recipient ? `Destinatario: ${recipient}` : "Falta el destinatario",
    amount ? `Monto: ${formatMoney(amount)}` : "Falta el monto",
    concept ? `Concepto: ${concept}` : "",
    missing.length
      ? `Completa ${missing.join(" y ")} antes de confirmar`
      : "Puedes confirmarla desde el formulario",
  ]);
}

function describeTransferSuccess(message) {
  const data = message.props || {};
  const recipient =
    data.registered_name ||
    data.recipient_name ||
    data.to_alias ||
    "el destinatario";
  return joinSentences([
    data.title || "Transferencia exitosa",
    Number.isFinite(Number(data.amount))
      ? `Se enviaron ${formatMoney(data.amount)} a ${recipient}`
      : `Se envió la transferencia a ${recipient}`,
    data.concept ? `Concepto: ${data.concept}` : "",
  ]);
}

function describeContacts(message) {
  const data = message.props || {};
  const contacts = data.contacts || [];
  const names = contacts
    .slice(0, 5)
    .map((contact) => contact.name || contact.alias || contact.display_name)
    .filter(Boolean);
  return joinSentences([
    data.title || "Tus cuentas registradas",
    data.message || "",
    names.length
      ? `Tienes ${contacts.length} contactos, entre ellos ${names.join(", ")}`
      : "Aún no tienes contactos registrados",
  ]);
}

function describeRegisterForm(message) {
  const data = message.props || {};
  return joinSentences([
    data.title || "Registrar cuenta",
    data.message ||
      "Completa el nombre y la CLABE para guardar una cuenta destino",
    data.initialValues?.name
      ? `Nombre detectado: ${data.initialValues.name}`
      : "",
    data.initialValues?.clabe
      ? `CLABE detectada: ${data.initialValues.clabe}`
      : "",
  ]);
}

function describeChart(message) {
  const data = message.props || {};
  const series = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.series)
      ? data.series
      : [];
  const highlights = series
    .slice(0, 4)
    .map((item) => {
      const label = item.label || item.name || item.category || "";
      const value = Number(item.value);
      if (!label || !Number.isFinite(value)) return "";
      return `${label}: ${formatMoney(value)}`;
    })
    .filter(Boolean);
  return joinSentences([
    data.title || "Actividad financiera",
    data.message || "",
    highlights.length ? highlights.join(". ") : "",
  ]);
}

function describeSummary(message) {
  const data = message.props || {};
  const totals = data.totals || {};
  return joinSentences([
    data.title || "Resumen de operaciones",
    Number.isFinite(Number(totals.incoming))
      ? `Entradas: ${formatMoney(totals.incoming)}`
      : "",
    Number.isFinite(Number(totals.outgoing))
      ? `Salidas: ${formatMoney(totals.outgoing)}`
      : "",
  ]);
}

function describeCredit(message) {
  const data = message.props || {};
  const options = data.options || data.plans || [];
  const first = options[0];
  return joinSentences([
    data.title || "Opciones de crédito",
    data.message || "",
    first
      ? `Una opción es ${first.months || first.term || "varios"} pagos de ${formatMoney(
          first.monthly_payment || first.payment || 0,
        )}`
      : "",
  ]);
}

/**
 * Convierte la respuesta del asistente (texto, error o UI) en narración corta.
 */
export function buildSpeakableText(message) {
  if (!message || typeof message !== "object") return "";

  if (message.type === "error") {
    return String(message.message || "Ocurrió un error").trim();
  }

  if (message.type === "text") {
    return String(message.text || "").trim();
  }

  if (message.type !== "ui") return "";

  const data = message.props || {};
  switch (message.component) {
    case "balance_card":
      return describeBalance(message);
    case "transfer_form":
      return describeTransferForm(message);
    case "transfer_success":
      return describeTransferSuccess(message);
    case "contacts_list":
      return describeContacts(message);
    case "register_account_form":
      return describeRegisterForm(message);
    case "register_account_success":
      return joinSentences([
        data.title || "Cuenta registrada",
        data.message ||
          `Guardamos ${data.account?.name || data.name || "la cuenta"} correctamente`,
      ]);
    case "financial_chart":
      return describeChart(message);
    case "transactions_summary":
      return describeSummary(message);
    case "transaction_detail":
      return joinSentences([
        data.title || "Detalle de operación",
        data.transaction?.concept
          ? `Concepto: ${data.transaction.concept}`
          : "",
        Number.isFinite(Number(data.transaction?.amount))
          ? `Monto: ${formatMoney(data.transaction.amount)}`
          : "",
      ]);
    case "credit_plan_table":
      return describeCredit(message);
    case "quick_actions":
    case "clarification_card":
    default:
      return joinSentences([data.title, data.message]);
  }
}
