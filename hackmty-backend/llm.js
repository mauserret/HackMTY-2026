"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { z } = require("zod");
const {
  canonicalContact,
  resolveContact,
} = require("./contactResolver");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const READ_ONLY_TOOL_NAMES = new Set([
  "getBalance",
  "getContacts",
  "getCreditPlans",
  "get_contacts",
  "get_financial_summary",
  "get_transaction_detail",
]);
const UI_COMPONENTS = [
  "balance_card",
  "contacts_list",
  "credit_plan_table",
  "transfer_form",
  "clarification_card",
  "quick_actions",
  "financial_chart",
  "transactions_summary",
  "transaction_detail",
];

const a2uiSchema = z
  .object({
    type: z.literal("ui"),
    component: z.enum(UI_COMPONENTS),
    props: z.record(z.unknown()),
  })
  .strict();

const transferInitialValuesSchema = z.object({
  recipient: z.string().max(120),
  amount: z.string().max(32),
  concept: z.string().max(120),
  accountNumber: z.string().max(40),
  bank: z.string().max(80),
});

const transferPropsSchema = z.object({
  contact_id: z.string().max(128),
  to_alias: z.string().max(120),
  recipient_name: z.string().max(120),
  account_number: z.string().max(40),
  bank: z.string().max(80),
  amount: z.number().finite().positive().max(1_000_000).nullable(),
  concept: z.string().max(120),
  currency: z.literal("MXN"),
  requires_confirmation: z.literal(true),
  initialValues: transferInitialValuesSchema,
  missing_fields: z.array(z.enum(["recipient", "amount"])),
  available_contacts: z.array(
    z.object({
      alias: z.string(),
      display_name: z.string(),
      contact_id: z.string(),
      fullName: z.string(),
      accountNumber: z.string(),
      bank: z.string(),
    }),
  ),
});

const chatSessions = new Map();
const localMemories = new Map();
let aiPromise = null;

const SYSTEM_INSTRUCTION = `
Eres el orquestador de una interfaz bancaria A2UI. Identifica la intención,
consulta exclusivamente las tools disponibles y responde SIEMPRE con un único
objeto JSON válido, sin Markdown ni texto fuera del JSON.

Forma obligatoria:
{"type":"ui","component":"nombre_del_componente","props":{...}}

Componentes permitidos: balance_card, contacts_list, credit_plan_table,
transfer_form, clarification_card, quick_actions y financial_chart. Usa
financial_chart cuando el usuario pida gráficas, actividad o comparación de
movimientos; chartType debe ser bar, pie o line. Usa transactions_summary para
un historial general y transaction_detail para una sola operación. Nunca
respondas con texto suelto o con type="text". Los datos financieros deben venir
de tools.

Reglas de seguridad:
- La identidad indicada por el contexto del sistema es la única válida.
- No solicites ni uses datos de otro usuario.
- createTransaction no está disponible. Una solicitud de transferencia solo
  produce transfer_form; incluso "confirmo" debe pedir usar el botón de
  confirmación de la interfaz.
- En transferencias extrae persona, monto y concepto. Produce transfer_form
  incluso si falta algún dato: usa initialValues con cadenas vacías para que
  el usuario pueda completar o corregir todos los campos.
- Para solicitudes fuera de alcance, usa quick_actions.
`.trim();

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "";
}

async function getGoogleClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!aiPromise) {
    aiPromise = import("@google/genai").then(
      ({ GoogleGenAI }) => new GoogleGenAI({ apiKey }),
    );
  }
  return aiPromise;
}

function normalizeText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[¿?¡!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLocalizedNumber(rawValue) {
  let value = rawValue.replace(/\s/g, "");
  const commaCount = (value.match(/,/g) || []).length;
  const dotCount = (value.match(/\./g) || []).length;

  if (commaCount && dotCount) {
    const decimalSeparator = value.lastIndexOf(",") > value.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const decimalDigits = value.length - value.lastIndexOf(decimalSeparator) - 1;
    value = value.replaceAll(thousandsSeparator, "");
    value =
      decimalDigits <= 2
        ? value.replace(decimalSeparator, ".")
        : value.replaceAll(decimalSeparator, "");
  } else {
    const separator = commaCount ? "," : dotCount ? "." : null;
    const count = commaCount || dotCount;
    if (separator && count > 1) {
      const groups = value.split(separator);
      const last = groups.at(-1);
      value =
        last.length <= 2
          ? `${groups.slice(0, -1).join("")}.${last}`
          : groups.join("");
    } else if (separator) {
      const [whole, fraction] = value.split(separator);
      value = fraction.length === 3 ? `${whole}${fraction}` : `${whole}.${fraction}`;
    }
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  return Math.round(amount * 100) / 100;
}

const NUMBER_WORDS = Object.freeze({
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
});

function parseSpanishNumberWords(text) {
  const tokens = normalizeText(text).split(/[^a-z]+/).filter(Boolean);
  let best = null;
  let current = 0;
  let total = 0;
  let active = false;

  function commit() {
    if (active) {
      const candidate = total + current;
      if (candidate > 0 && candidate <= 1_000_000) {
        best = best === null ? candidate : Math.max(best, candidate);
      }
    }
    current = 0;
    total = 0;
    active = false;
  }

  for (const token of tokens) {
    if (Object.hasOwn(NUMBER_WORDS, token)) {
      current += NUMBER_WORDS[token];
      active = true;
    } else if (token === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      active = true;
    } else if (token === "y" && active) {
      continue;
    } else {
      commit();
    }
  }
  commit();
  return best;
}

function parseAmount(text) {
  const pattern =
    /(?:\$|mxn\s*)?(\d+(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:mxn|pesos?)?/giu;
  for (const match of text.matchAll(pattern)) {
    const numberOffset = match[0].indexOf(match[1]);
    const numberStart = match.index + numberOffset;
    const numberEnd = numberStart + match[1].length;
    const before = numberStart > 0 ? text[numberStart - 1] : "";
    const beforeMatch = match.index > 0 ? text[match.index - 1] : "";
    const after = numberEnd < text.length ? text[numberEnd] : "";
    const suffix = match[0].slice(numberOffset + match[1].length).trim();
    if (
      before === "-" ||
      before === "−" ||
      beforeMatch === "-" ||
      beforeMatch === "−" ||
      /[\p{L}\p{N}_]/u.test(before) ||
      (/[\p{L}_]/u.test(after) && !/^(?:mxn|pesos?)$/i.test(suffix))
    ) {
      continue;
    }
    const amount = parseLocalizedNumber(match[1]);
    if (amount !== null) return amount;
  }
  const withoutNumericArticles = normalizeText(text).replace(
    /\b(?:un|una|uno)\s+(?=transferencia|cuenta|persona|contacto|operacion|solicitud)\b/g,
    "",
  );
  return parseSpanishNumberWords(withoutNumericArticles);
}

function contactTerms(contact) {
  const terms = [
    contact.alias,
    contact.display_name,
    contact.display_name?.split(/\s+/)[0],
  ]
    .filter(Boolean)
    .map(normalizeText);
  return [...new Set(terms)].sort((left, right) => right.length - left.length);
}

function containsTerm(text, term) {
  const paddedText = ` ${normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const paddedTerm = ` ${term.replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return paddedText.includes(paddedTerm);
}

function extractContact(text, contacts) {
  const candidates = contacts
    .flatMap((contact) => contactTerms(contact).map((term) => ({ contact, term })))
    .sort((left, right) => right.term.length - left.term.length);
  return candidates.find(({ term }) => containsTerm(text, term))?.contact || null;
}

function cleanEntityText(value, { dropArticle = false } = {}) {
  let cleaned = String(value || "")
    .replace(/\s*(?:,|;)?\s*(?:por favor|gracias)\s*$/iu, "")
    .replace(/^[\s:,-]+|[\s,.;:!?-]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (dropArticle) {
    cleaned = cleaned.replace(/^(?:el|la|los|las)\s+/iu, "");
  }
  if (!cleaned) return "";
  return `${cleaned.charAt(0).toLocaleUpperCase("es-MX")}${cleaned.slice(1)}`.slice(
    0,
    120,
  );
}

function extractRecipientName(text) {
  const match = String(text).match(
    /\b(a|para)\s+([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3}?)(?=\s+(?:por|con\s+(?:el\s+)?concepto|concepto|para\s+(?:el|la|los|las))\b|\s+\$?\d|[,.;!?]|$)/iu,
  );
  if (!match) return "";
  const recipient = cleanEntityText(match[2]);
  if (
    !recipient ||
    /^(?:alguien|persona|un contacto|contacto|destinatario)$/iu.test(recipient) ||
    (normalizeText(match[1]) === "para" &&
      /^(?:el|la|los|las)\b/iu.test(recipient))
  ) {
    return "";
  }
  return recipient;
}

function extractConcept(text) {
  const input = String(text);
  const patterns = [
    /\b(?:con\s+(?:el\s+)?concepto|concepto|descripci[oó]n)(?:\s+de)?\s*[:=-]?\s+(.+)$/iu,
    /\bpor\s+(?!favor\b)(.+)$/iu,
    /\bpara\s+((?:el|la|los|las)\s+.+)$/iu,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const concept = cleanEntityText(match?.[1], { dropArticle: true });
    if (concept && normalizeText(concept) !== "favor") return concept;
  }
  return "";
}

function positiveHintedAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 1_000_000
    ? Math.round(numeric * 100) / 100
    : null;
}

function extractTransferEntities(text, contacts, hints = {}, previous = {}) {
  const initialValues = hints.initialValues || {};
  const hintedRecipient =
    initialValues.recipient ||
    hints.recipient_name ||
    hints.recipient ||
    hints.person ||
    hints.to_alias ||
    "";
  const extractedRecipient = extractRecipientName(text);
  const contactFromText =
    extractContact(text, contacts) ||
    resolveContact(extractedRecipient, contacts)?.record ||
    null;
  const contactFromHint =
    resolveContact(hintedRecipient, contacts)?.record ||
    extractContact(hintedRecipient, contacts);
  const knownContact =
    contactFromText ||
    (!extractedRecipient &&
      (contactFromHint ||
        contacts.find(
          (contact) =>
            String(contact.contact_id || contact.id) ===
              String(previous.contactId || "") ||
            normalizeText(contact.alias) ===
              normalizeText(previous.toAlias || ""),
        ))) ||
    null;
  const canonical = knownContact ? canonicalContact(knownContact) : null;
  const recipient =
    canonical?.fullName ||
    extractedRecipient ||
    cleanEntityText(hintedRecipient) ||
    previous.recipientName ||
    previous.toAlias ||
    "";
  const amount =
    parseAmount(text) ??
    positiveHintedAmount(initialValues.amount ?? hints.amount) ??
    previous.amount ??
    null;
  const concept =
    extractConcept(text) ||
    cleanEntityText(
      initialValues.concept || hints.concept || hints.description || "",
      { dropArticle: true },
    ) ||
    previous.concept ||
    "";

  return {
    contact: knownContact,
    contactId: canonical?.id || "",
    toAlias: canonical?.alias || recipient,
    recipient,
    accountNumber: canonical?.accountNumber || "",
    bank: canonical?.bank || "",
    amount,
    concept,
  };
}

function getMemory(userId) {
  if (!localMemories.has(userId)) {
    localMemories.set(userId, { transferDraft: null, turns: [] });
  }
  return localMemories.get(userId);
}

function remember(userId, text, ui) {
  const memory = getMemory(userId);
  memory.turns.push({ text, component: ui.component });
  if (memory.turns.length > 12) memory.turns.shift();
  if (ui.component === "transfer_form") {
    memory.transferDraft = {
      contactId: ui.props.contact_id,
      toAlias: ui.props.to_alias,
      recipientName: ui.props.recipient_name,
      accountNumber: ui.props.account_number,
      bank: ui.props.bank,
      amount: ui.props.amount,
      concept: ui.props.concept,
    };
  } else if (ui.component !== "clarification_card") {
    memory.transferDraft = null;
  }
}

function quickActions(message = "¿Qué operación quieres realizar?") {
  return {
    type: "ui",
    component: "quick_actions",
    props: {
      title: "Asistente financiero",
      message,
      actions: [
        { id: "balance", label: "Consultar saldo", prompt: "¿Cuál es mi saldo?" },
        { id: "contacts", label: "Ver contactos", prompt: "Muéstrame mis contactos" },
        {
          id: "credit",
          label: "Pagar menos intereses",
          prompt: "Quiero opciones para pagar menos intereses",
        },
        {
          id: "transfer",
          label: "Hacer transferencia",
          prompt: "Quiero hacer una transferencia",
        },
        {
          id: "chart",
          label: "Ver actividad",
          prompt: "Muéstrame una gráfica de mis movimientos",
        },
        {
          id: "history",
          label: "Resumen de operaciones",
          prompt: "Muéstrame el resumen de transferencias",
        },
      ],
    },
  };
}

function confirmationCard() {
  return {
    type: "ui",
    component: "clarification_card",
    props: {
      title: "Confirma desde la interfaz",
      message:
        "Por seguridad, revisa el formulario y usa su botón Confirmar transferencia.",
      missing_fields: [],
      quick_actions: [{ label: "Volver al formulario", action: "show_pending_transfer" }],
    },
  };
}

async function balanceUI(userId, mcp) {
  const balance = await mcp.callTool("getBalance", { userId });
  return {
    type: "ui",
    component: "balance_card",
    props: {
      title: "Tus cuentas",
      ...balance,
      quick_actions: [
        { label: "Ver contactos", prompt: "Muéstrame mis contactos" },
        { label: "Transferir", prompt: "Quiero hacer una transferencia" },
      ],
    },
  };
}

async function contactsUI(userId, mcp) {
  const result = await mcp.callTool("getContacts", { userId });
  return {
    type: "ui",
    component: "contacts_list",
    props: {
      title: "Contactos para transferir",
      ...result,
      quick_actions: result.contacts.map((contact) => ({
        label: `Transferir a ${contact.alias}`,
        prompt: `Quiero transferir a ${contact.alias}`,
      })),
    },
  };
}

async function creditUI(userId, mcp) {
  const balance = await mcp.callTool("getBalance", { userId });
  const creditAccount = balance.accounts.find((account) => account.type === "credit_card");
  if (!creditAccount) {
    return {
      type: "ui",
      component: "clarification_card",
      props: {
        title: "Sin crédito elegible",
        message: "Este usuario no tiene una cuenta de crédito con opciones de reestructura.",
        missing_fields: [],
        quick_actions: [{ label: "Consultar saldo", prompt: "¿Cuál es mi saldo?" }],
      },
    };
  }
  const plan = await mcp.callTool("getCreditPlans", {
    accountId: creditAccount.account_id,
  });
  return {
    type: "ui",
    component: "credit_plan_table",
    props: {
      title: "Opciones para pagar menos intereses",
      account: creditAccount,
      ...plan,
      disclaimer: "Montos informativos sujetos a aprobación y condiciones del producto.",
    },
  };
}

function requestedChartType(text, hints = {}) {
  const requested = normalizeText(
    hints.chartType || hints.chart_type || text,
  );
  if (/\b(pastel|pie|circular|dona|donut)\b/.test(requested)) return "pie";
  if (/\b(linea|lineal|line|tendencia|evolucion|tiempo)\b/.test(requested)) {
    return "line";
  }
  return "bar";
}

async function financialChartUI(userId, mcp, text = "", hints = {}) {
  const chartType = requestedChartType(text, hints);
  const summary = await mcp.callTool("get_financial_summary", {
    userId,
    groupBy: chartType === "pie" ? "category" : "day",
  });
  const wantsExpenses = /\b(gasto|gastos|salida|salidas)\b/.test(
    normalizeText(text),
  );
  let data;
  if (chartType === "pie") {
    data = summary.categories.map((category) => ({
      label: category.category,
      value: category.total,
      count: category.count,
    }));
  } else {
    data = summary.groups.slice(-12).map((group) => ({
      label: group.label,
      value: wantsExpenses
        ? group.outgoing
        : group.total,
      incoming: group.incoming,
      outgoing: group.outgoing,
      count: group.count,
    }));
  }
  if (!data.length) {
    data = [
      { label: "Entradas", value: summary.totals.incoming },
      { label: "Salidas", value: summary.totals.outgoing },
    ];
  }
  return {
    type: "ui",
    component: "financial_chart",
    props: {
      title:
        chartType === "pie"
          ? "Distribución de gastos"
          : wantsExpenses
            ? "Evolución de gastos"
            : "Actividad financiera",
      message: `${summary.totals.count} operaciones analizadas.`,
      chartType,
      data,
      currency: "MXN",
      totals: summary.totals,
    },
  };
}

async function transactionsSummaryUI(userId, mcp) {
  const summary = await mcp.callTool("get_financial_summary", {
    userId,
    groupBy: "day",
  });
  const grouped = new Map();
  for (const transaction of summary.transactions) {
    const key = transaction.timestamp.slice(0, 10);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(transaction);
  }
  return {
    type: "ui",
    component: "transactions_summary",
    props: {
      title: "Resumen de operaciones",
      totals: summary.totals,
      groups: [...grouped.entries()].map(([date, transactions]) => ({
        date,
        transactions,
      })),
      empty_message: "Todavía no hay operaciones en este periodo.",
    },
  };
}

function transactionIdFromText(text) {
  return String(text).match(/\b(tx_[A-Za-z0-9_-]+|[a-fA-F0-9]{24})\b/)?.[1] || "";
}

async function transactionDetailUI(userId, text, mcp) {
  const summary = await mcp.callTool("get_financial_summary", {
    userId,
    groupBy: "day",
  });
  const explicitId = transactionIdFromText(text);
  const target = extractRecipientName(text);
  const normalizedTarget = normalizeText(target);
  const candidate =
    summary.transactions.find(
      (transaction) => transaction.transactionId === explicitId,
    ) ||
    (normalizedTarget
      ? summary.transactions.find((transaction) =>
          [
            transaction.recipient,
            transaction.recipientAlias,
            transaction.sender,
          ].some((value) => {
            const normalized = normalizeText(value);
            return (
              normalized === normalizedTarget ||
              normalized.startsWith(`${normalizedTarget} `) ||
              normalizedTarget === normalized.split(" ")[0]
            );
          }),
        )
      : summary.transactions[0]);

  if (!candidate) {
    return {
      type: "ui",
      component: "clarification_card",
      props: {
        title: "No encontré esa operación",
        message:
          "Indica el destinatario o abre el resumen para elegir una transferencia.",
        choices: [
          {
            label: "Ver resumen de operaciones",
            prompt: "Muéstrame el resumen de transferencias",
          },
        ],
      },
    };
  }
  const detail = await mcp.callTool("get_transaction_detail", {
    userId,
    transactionId: candidate.transactionId,
  });
  return {
    type: "ui",
    component: "transaction_detail",
    props: {
      title: "Detalle de operación",
      transaction: detail.transaction,
    },
  };
}

async function transferUI(userId, text, mcp, hints = {}) {
  const result = await mcp.callTool("getContacts", { userId });
  const memory = getMemory(userId);
  const previous = memory.transferDraft || {};
  const entities = extractTransferEntities(
    text,
    result.contacts,
    hints,
    previous,
  );

  memory.transferDraft = {
    contactId: entities.contactId,
    toAlias: entities.toAlias,
    recipientName: entities.recipient,
    accountNumber: entities.accountNumber,
    bank: entities.bank,
    amount: entities.amount,
    concept: entities.concept,
  };

  const missingFields = [];
  if (!entities.recipient) missingFields.push("recipient");
  if (!entities.amount) missingFields.push("amount");

  const props = transferPropsSchema.parse({
    contact_id: entities.contactId,
    to_alias: entities.toAlias,
    recipient_name: entities.recipient,
    account_number: entities.accountNumber,
    bank: entities.bank,
    amount: entities.amount,
    concept: entities.concept,
    currency: "MXN",
    requires_confirmation: true,
    initialValues: {
      recipient: entities.recipient,
      amount: entities.amount === null ? "" : String(entities.amount),
      concept: entities.concept,
      accountNumber: entities.accountNumber,
      bank: entities.bank,
    },
    missing_fields: missingFields,
    available_contacts: result.contacts.map((contact) => {
      const canonical = canonicalContact(contact);
      return {
        alias: canonical.alias,
        display_name: canonical.fullName,
        contact_id: canonical.id,
        fullName: canonical.fullName,
        accountNumber: canonical.accountNumber,
        bank: canonical.bank,
      };
    }),
  });
  return {
    type: "ui",
    component: "transfer_form",
    props: {
      title: missingFields.length
        ? "Completa tu transferencia"
        : "Revisa tu transferencia",
      ...props,
    },
  };
}

function isCreditIntent(text) {
  return /\b(interes|intereses|reestructur|credito|deuda|mensualidad|cat)\b/.test(text);
}

function isBalanceIntent(text) {
  return /\b(saldo|balance|cuenta|cuentas|disponible|dinero tengo)\b/.test(text);
}

function isContactsIntent(text) {
  return /\b(contacto|contactos|beneficiario|beneficiarios|destinatario)\b/.test(text);
}

function isTransferIntent(text) {
  return /\b(transf|transfer|envia|enviar|manda|mandar|deposit|pasale|pagale)\w*/.test(text);
}

function isChartIntent(text) {
  return /\b(grafic|grafiqu|chart|visualiz|pastel|pie|linea|barras?|estadistic)\w*/.test(
    text,
  );
}

function isTransactionDetailIntent(text) {
  return (
    /\b(detalle|recibo|comprobante)\b/.test(text) &&
    /\b(pago|transferencia|operacion|movimiento)\b/.test(text)
  );
}

function isTransactionsSummaryIntent(text) {
  return (
    /\b(resumen|historial|lista|ultim[oa]s?)\b/.test(text) &&
    /\b(transferencias?|operaciones?|pagos?|movimientos?)\b/.test(text)
  );
}

function isConfirmationIntent(text) {
  return /\b(confirmo|confirmar|confirmado|hazlo|adelante|si acepto|si,? procede)\b/.test(text);
}

async function localFallback(userId, text, mcp) {
  const normalized = normalizeText(text);
  const memory = getMemory(userId);

  if (isConfirmationIntent(normalized) && memory.transferDraft) {
    return confirmationCard();
  }
  if (isTransactionDetailIntent(normalized)) {
    return transactionDetailUI(userId, text, mcp);
  }
  if (isChartIntent(normalized)) {
    return financialChartUI(userId, mcp, text);
  }
  if (isTransactionsSummaryIntent(normalized)) {
    return transactionsSummaryUI(userId, mcp);
  }
  if (isCreditIntent(normalized)) {
    return creditUI(userId, mcp);
  }
  if (isTransferIntent(normalized)) {
    return transferUI(userId, text, mcp);
  }
  if (isBalanceIntent(normalized)) {
    return balanceUI(userId, mcp);
  }
  if (isContactsIntent(normalized)) {
    return contactsUI(userId, mcp);
  }
  if (memory.transferDraft) {
    return transferUI(userId, text, mcp);
  }
  return quickActions("Puedo ayudarte con saldos, contactos, crédito y transferencias.");
}

function parseModelJson(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return a2uiSchema.parse(JSON.parse(cleaned));
}

async function executeModelTool(userId, call, mcp) {
  if (!READ_ONLY_TOOL_NAMES.has(call.name)) {
    return { error: { code: "TOOL_NOT_ALLOWED", message: "Tool no permitida" } };
  }
  try {
    if (call.name === "getBalance" || call.name === "getContacts") {
      return await mcp.callTool(call.name, { userId });
    }
    if (
      call.name === "get_contacts" ||
      call.name === "get_financial_summary" ||
      call.name === "get_transaction_detail"
    ) {
      return await mcp.callTool(call.name, {
        ...call.args,
        userId,
      });
    }
    const ownBalance = await mcp.callTool("getBalance", { userId });
    const ownAccountIds = new Set(ownBalance.accounts.map((account) => account.account_id));
    if (!ownAccountIds.has(call.args?.accountId)) {
      return {
        error: {
          code: "ACCOUNT_NOT_OWNED",
          message: "La cuenta solicitada no pertenece al usuario autenticado",
        },
      };
    }
    return await mcp.callTool("getCreditPlans", { accountId: call.args.accountId });
  } catch (error) {
    return {
      error: {
        code: error.code || "TOOL_ERROR",
        message: error.message || "No se pudo consultar la información",
      },
    };
  }
}

async function hydrateModelUI(userId, text, modelUI, mcp) {
  switch (modelUI.component) {
    case "balance_card":
      return balanceUI(userId, mcp);
    case "contacts_list":
      return contactsUI(userId, mcp);
    case "credit_plan_table":
      return creditUI(userId, mcp);
    case "transfer_form":
      return transferUI(userId, text, mcp, modelUI.props);
    case "financial_chart":
      return financialChartUI(userId, mcp, text, modelUI.props);
    case "transactions_summary":
      return transactionsSummaryUI(userId, mcp);
    case "transaction_detail":
      return transactionDetailUI(userId, text, mcp);
    case "clarification_card":
    case "quick_actions":
      return modelUI;
    default:
      return quickActions();
  }
}

async function getChatSession(userId, mcp) {
  if (chatSessions.has(userId)) return chatSessions.get(userId);
  const ai = await getGoogleClient();
  if (!ai) return null;
  const tools = await mcp.listTools();
  const functionDeclarations = tools
    .filter((tool) => READ_ONLY_TOOL_NAMES.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.inputSchema,
    }));
  const chat = ai.chats.create({
    model: MODEL,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      tools: [{ functionDeclarations }],
    },
  });
  chatSessions.set(userId, chat);
  return chat;
}

async function processWithGemini(userId, text, mcp) {
  const chat = await getChatSession(userId, mcp);
  if (!chat) return null;
  let response = await chat.sendMessage({
    message: `[authenticated_user_id=${userId}] ${text}`,
  });

  for (let round = 0; response.functionCalls?.length && round < 4; round += 1) {
    const parts = [];
    for (const call of response.functionCalls) {
      const output = await executeModelTool(userId, call, mcp);
      parts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: output,
        },
      });
    }
    response = await chat.sendMessage({ message: parts });
  }
  if (response.functionCalls?.length) {
    throw new Error("Gemini excedió el límite de llamadas a tools");
  }
  const modelUI = parseModelJson(response.text);
  return hydrateModelUI(userId, text, modelUI, mcp);
}

async function processMessage(userId, text, mcp, { forceLocal = false } = {}) {
  await mcp.listTools();
  let ui;
  if (!forceLocal && getApiKey()) {
    try {
      ui = await processWithGemini(userId, text, mcp);
    } catch (error) {
      chatSessions.delete(userId);
      console.error(`Gemini no disponible para ${userId}; usando fallback: ${error.message}`);
    }
  }
  if (!ui) {
    ui = await localFallback(userId, text, mcp);
  }
  const parsed = a2uiSchema.parse(ui);
  remember(userId, text, parsed);
  return parsed;
}

function clearMemory(userId) {
  chatSessions.delete(userId);
  localMemories.delete(userId);
}

module.exports = {
  MODEL,
  clearMemory,
  extractConcept,
  extractContact,
  extractRecipientName,
  extractTransferEntities,
  financialChartUI,
  getApiKey,
  getGoogleClient,
  localFallback,
  normalizeText,
  parseAmount,
  parseLocalizedNumber,
  parseModelJson,
  processMessage,
  requestedChartType,
  transactionDetailUI,
  transactionsSummaryUI,
};
