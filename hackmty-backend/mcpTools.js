"use strict";

const { randomUUID } = require("node:crypto");
const { ObjectId } = require("mongodb");
const { z } = require("zod");
const { aliasKey } = require("./demoData");
const { getStorage } = require("./db");
const {
  canonicalContact,
  resolveContact,
} = require("./contactResolver");

const MAX_TRANSACTION_AMOUNT = 1_000_000;
const MAX_INTERACTION_BYTES = 64 * 1024;

class ToolError extends Error {
  constructor(code, message, recoverable = true) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

const userIdSchema = z.string().trim().regex(/^u[1-9]\d{0,8}$/, "userId inválido");
const accountIdSchema = z
  .string()
  .trim()
  .regex(/^acc_[a-zA-Z0-9_-]{1,80}$/, "accountId inválido");
const aliasSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, "alias inválido");
const amountSchema = z
  .number()
  .finite()
  .positive()
  .max(MAX_TRANSACTION_AMOUNT)
  .refine((amount) => Math.abs(Math.round(amount * 100) - amount * 100) < 1e-8, {
    message: "amount admite máximo dos decimales",
  });
const conceptSchema = z.string().trim().max(120);
const contactIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "contactId inválido");
const contactNameSchema = z.string().trim().min(2).max(120);
const accountNumberSchema = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "accountNumber inválido");
const bankSchema = z.string().trim().min(2).max(80);
const accountTypeSchema = z.enum([
  "checking",
  "savings",
  "debit_card",
  "credit_card",
]);
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "currency inválida");
const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "fecha inválida");
const requestIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "requestId inválido");
const interactionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^(?:[a-fA-F0-9]{24}|i_[A-Za-z0-9-]+)$/, "interactionId inválido");

const interactionResponseSchema = z
  .union([z.string().max(MAX_INTERACTION_BYTES), z.record(z.unknown()), z.array(z.unknown())])
  .superRefine((response, context) => {
    let serialized;
    try {
      serialized = JSON.stringify(response);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "response no es serializable" });
      return;
    }
    if (Buffer.byteLength(serialized, "utf8") > MAX_INTERACTION_BYTES) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MAX_INTERACTION_BYTES,
        inclusive: true,
        type: "array",
        message: "response excede 64 KiB",
      });
    }
  });

const inputSchemas = Object.freeze({
  getBalance: { userId: userIdSchema },
  getContacts: { userId: userIdSchema },
  getCreditPlans: { accountId: accountIdSchema },
  createTransaction: {
    fromUserId: userIdSchema,
    toAlias: aliasSchema,
    amount: amountSchema,
    concept: conceptSchema.optional(),
    contactId: contactIdSchema.optional(),
    accountNumber: accountNumberSchema.optional(),
    requestId: requestIdSchema.optional(),
  },
  get_contacts: { userId: userIdSchema },
  add_contact: {
    userId: userIdSchema,
    name: contactNameSchema,
    alias: aliasSchema,
    accountNumber: accountNumberSchema,
    bank: bankSchema,
  },
  update_contact: {
    userId: userIdSchema,
    contactId: contactIdSchema.optional(),
    contact_id: contactIdSchema.optional(),
    name: contactNameSchema.optional(),
    alias: aliasSchema.optional(),
    accountNumber: accountNumberSchema.optional(),
    bank: bankSchema.optional(),
  },
  add_account: {
    userId: userIdSchema,
    type: accountTypeSchema,
    accountNumber: accountNumberSchema,
    bank: bankSchema,
    currency: currencySchema.optional(),
    balance: z.number().finite().min(0).max(1_000_000_000).optional(),
    creditLimit: z.number().finite().positive().max(1_000_000_000).optional(),
  },
  get_financial_summary: {
    userId: userIdSchema,
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    groupBy: z.enum(["day", "week", "month", "category"]).optional(),
  },
  get_transaction_detail: {
    userId: userIdSchema,
    transactionId: z.string().trim().min(8).max(128),
  },
  saveInteraction: {
    userId: userIdSchema,
    prompt: z.string().trim().min(1).max(4000),
    response: interactionResponseSchema,
  },
  saveRating: {
    interactionId: interactionIdSchema,
    rating: z.number().int().min(1).max(10),
  },
});

const toolDefinitions = Object.freeze([
  {
    name: "getBalance",
    description: "Consulta las cuentas y saldos actuales de un usuario de la demo.",
    inputSchema: inputSchemas.getBalance,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "getContacts",
    description: "Lista los contactos de transferencia del usuario.",
    inputSchema: inputSchemas.getContacts,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "getCreditPlans",
    description: "Consulta las alternativas de reestructura de una cuenta de crédito.",
    inputSchema: inputSchemas.getCreditPlans,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "createTransaction",
    description: "Ejecuta una transferencia confirmada hacia el alias de un contacto.",
    inputSchema: inputSchemas.createTransaction,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: "saveInteraction",
    description: "Guarda el prompt y la respuesta A2UI de una interacción.",
    inputSchema: inputSchemas.saveInteraction,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "saveRating",
    description: "Guarda una calificación entera de 1 a 10 para una interacción.",
    inputSchema: inputSchemas.saveRating,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "get_contacts",
    description:
      "Obtiene contactos canónicos con id, alias, nombre completo, cuenta y banco.",
    inputSchema: inputSchemas.get_contacts,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "add_contact",
    description: "Agrega un contacto bancario al perfil del usuario.",
    inputSchema: inputSchemas.add_contact,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "update_contact",
    description: "Actualiza nombre, alias, cuenta o banco de un contacto existente.",
    inputSchema: inputSchemas.update_contact,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "add_account",
    description: "Vincula una cuenta bancaria o tarjeta al perfil del usuario.",
    inputSchema: inputSchemas.add_account,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "get_financial_summary",
    description:
      "Agrega entradas, salidas, categorías y series temporales para un rango de fechas.",
    inputSchema: inputSchemas.get_financial_summary,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "get_transaction_detail",
    description: "Obtiene los metadatos completos de una transacción del usuario.",
    inputSchema: inputSchemas.get_transaction_detail,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
]);

function parseInput(toolName, input) {
  const schema = z.object(inputSchemas[toolName]).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new ToolError("VALIDATION_ERROR", message);
  }
  return parsed.data;
}

function normalizeAlias(value) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const parsed = aliasSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new ToolError("INVALID_ALIAS", "El alias contiene caracteres no permitidos");
  }
  return parsed.data;
}

function normalizeMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function clone(value) {
  return structuredClone(value);
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username,
  };
}

function publicAccounts(accounts) {
  return accounts.map((account) => ({ ...account }));
}

function serializeId(value) {
  return typeof value === "string" ? value : value.toString();
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeAccountNumber(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function publicContact(record) {
  const contact = canonicalContact(record);
  return {
    id: contact.id,
    contact_id: contact.id,
    alias: contact.alias,
    nickname: contact.nickname,
    first_name: contact.firstName,
    fullName: contact.fullName,
    display_name: contact.fullName,
    accountNumber: contact.accountNumber,
    account_number: contact.accountNumber,
    account_id: contact.accountId,
    bank: contact.bank,
    user_id: contact.userId,
  };
}

function idCandidates(value) {
  return ObjectId.isValid(value)
    ? [value, ObjectId.createFromHexString(value)]
    : [value];
}

async function findUser(storage, userId, options = {}) {
  if (storage.kind === "memory") {
    return storage.data.users.find((user) => user._id === userId) || null;
  }
  return storage.db.collection("users").findOne({ _id: userId }, options);
}

async function getRecentTransactions(storage, userId) {
  let transactions;
  if (storage.kind === "memory") {
    transactions = storage.data.transactions
      .filter(
        (transaction) =>
          transaction.from_user_id === userId ||
          transaction.to_user_id === userId,
      )
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      .slice(0, 8);
  } else {
    transactions = await storage.db
      .collection("transactions")
      .find({
        $or: [{ from_user_id: userId }, { to_user_id: userId }],
      })
      .sort({ created_at: -1 })
      .limit(8)
      .toArray();
  }

  const senderIds = [
    ...new Set(
      transactions
        .filter((transaction) => transaction.to_user_id === userId)
        .map((transaction) => transaction.from_user_id),
    ),
  ];
  const senderNames = new Map();
  if (storage.kind === "memory") {
    for (const senderId of senderIds) {
      const sender = storage.data.users.find((user) => user._id === senderId);
      if (sender) senderNames.set(senderId, sender.name);
    }
  } else if (senderIds.length) {
    const senders = await storage.db
      .collection("users")
      .find({ _id: { $in: senderIds } })
      .project({ name: 1 })
      .toArray();
    for (const sender of senders) senderNames.set(sender._id, sender.name);
  }

  return transactions.map((transaction) => {
    const direction =
      transaction.from_user_id === userId ? "outgoing" : "incoming";
    return {
      transaction_id: serializeId(transaction._id),
      type: transaction.type,
      direction,
      counterparty:
        direction === "outgoing"
          ? transaction.to_alias
          : senderNames.get(transaction.from_user_id) || "Transferencia recibida",
      amount: normalizeMoney(transaction.amount),
      currency: transaction.currency || "MXN",
      status: transaction.status,
      concept: transaction.concept || "",
      created_at: serializeDate(transaction.created_at),
    };
  });
}

async function getBalance(input) {
  const { userId } = parseInput("getBalance", input);
  const storage = getStorage();
  const user = await findUser(storage, userId);
  if (!user) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${userId}`);
  }
  const recentTransactions = await getRecentTransactions(storage, userId);

  return {
    user_id: userId,
    user: publicUser(user),
    accounts: publicAccounts(user.accounts),
    recent_transactions: recentTransactions,
  };
}

async function getContacts(input) {
  const { userId } = parseInput("getContacts", input);
  const storage = getStorage();
  const owner = await findUser(storage, userId);
  if (!owner) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${userId}`);
  }

  let contacts;
  if (storage.kind === "memory") {
    contacts = storage.data.contacts.filter((contact) => contact.owner_id === userId);
  } else {
    contacts = await storage.db
      .collection("contacts")
      .find({ owner_id: userId })
      .sort({ display_name: 1 })
      .toArray();
  }

  return {
    user_id: userId,
    contacts: contacts
      .map(publicContact)
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "es")),
  };
}

async function loadContacts(storage, userId, options = {}) {
  if (storage.kind === "memory") {
    return storage.data.contacts.filter((contact) => contact.owner_id === userId);
  }
  return storage.db
    .collection("contacts")
    .find({ owner_id: userId }, options)
    .toArray();
}

async function findContactById(storage, userId, contactId, options = {}) {
  if (storage.kind === "memory") {
    return (
      storage.data.contacts.find(
        (contact) =>
          contact.owner_id === userId &&
          serializeId(contact._id) === contactId,
      ) || null
    );
  }
  return storage.db.collection("contacts").findOne(
    {
      owner_id: userId,
      _id: { $in: idCandidates(contactId) },
    },
    options,
  );
}

async function findAccountOwner(storage, accountNumber, options = {}) {
  if (storage.kind === "memory") {
    for (const user of storage.data.users) {
      const account = user.accounts.find(
        (candidate) =>
          normalizeAccountNumber(candidate.account_number) === accountNumber,
      );
      if (account) return { user, account };
    }
    return null;
  }
  const user = await storage.db
    .collection("users")
    .findOne({ "accounts.account_number": accountNumber }, options);
  if (!user) return null;
  const account = user.accounts.find(
    (candidate) =>
      normalizeAccountNumber(candidate.account_number) === accountNumber,
  );
  return account ? { user, account } : null;
}

function makeContactDocument({
  userId,
  name,
  alias,
  accountNumber,
  bank,
  linkedAccount,
  contactId = `contact_${userId}_${randomUUID().replaceAll("-", "")}`,
}) {
  return {
    _id: contactId,
    owner_id: userId,
    contact_user_id: linkedAccount?.user._id || null,
    alias,
    alias_key: aliasKey(alias),
    nickname: alias,
    first_name: name.split(/\s+/)[0],
    display_name: name,
    account_id:
      linkedAccount?.account.account_id || `external_${accountNumber}`,
    account_number: accountNumber,
    bank,
  };
}

async function addContact(input) {
  const parsed = parseInput("add_contact", input);
  const storage = getStorage();
  const owner = await findUser(storage, parsed.userId);
  if (!owner) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${parsed.userId}`);
  }
  const accountNumber = normalizeAccountNumber(parsed.accountNumber);
  const alias = normalizeAlias(parsed.alias);
  const operation = async () => {
    const contacts = await loadContacts(storage, parsed.userId);
    if (
      contacts.some(
        (contact) =>
          aliasKey(contact.alias) === aliasKey(alias) ||
          normalizeAccountNumber(contact.account_number) === accountNumber,
      )
    ) {
      throw new ToolError(
        "CONTACT_ALREADY_EXISTS",
        "Ya existe un contacto con ese alias o número de cuenta",
      );
    }
    const linkedAccount = await findAccountOwner(storage, accountNumber);
    const document = makeContactDocument({
      userId: parsed.userId,
      name: parsed.name,
      alias,
      accountNumber,
      bank: parsed.bank.trim(),
      linkedAccount,
    });
    if (storage.kind === "memory") {
      storage.data.contacts.push(document);
    } else {
      await storage.db.collection("contacts").insertOne(document);
    }
    return { saved: true, contact: publicContact(document) };
  };
  return storage.kind === "memory" ? storage.withLock(operation) : operation();
}

async function updateContact(input) {
  const parsed = parseInput("update_contact", input);
  const contactId = parsed.contactId || parsed.contact_id;
  if (!contactId) {
    throw new ToolError(
      "VALIDATION_ERROR",
      "contactId o contact_id es obligatorio",
    );
  }
  if (!parsed.name && !parsed.alias && !parsed.accountNumber && !parsed.bank) {
    throw new ToolError(
      "VALIDATION_ERROR",
      "Indica al menos un campo para actualizar",
    );
  }
  const storage = getStorage();
  const operation = async () => {
    const current = await findContactById(
      storage,
      parsed.userId,
      contactId,
    );
    if (!current) {
      throw new ToolError("CONTACT_NOT_FOUND", "No se encontró el contacto");
    }
    const accountNumber = normalizeAccountNumber(
      parsed.accountNumber || current.account_number,
    );
    const alias = normalizeAlias(parsed.alias || current.alias);
    const contacts = await loadContacts(storage, parsed.userId);
    if (
      contacts.some(
        (contact) =>
          serializeId(contact._id) !== contactId &&
          (aliasKey(contact.alias) === aliasKey(alias) ||
            normalizeAccountNumber(contact.account_number) === accountNumber),
      )
    ) {
      throw new ToolError(
        "CONTACT_ALREADY_EXISTS",
        "Otro contacto ya usa ese alias o número de cuenta",
      );
    }
    const linkedAccount = await findAccountOwner(storage, accountNumber);
    const name = parsed.name || current.display_name;
    const changes = {
      alias,
      alias_key: aliasKey(alias),
      nickname: alias,
      first_name: name.split(/\s+/)[0],
      display_name: name,
      account_number: accountNumber,
      bank: parsed.bank?.trim() || current.bank || "Banorte",
      contact_user_id: linkedAccount?.user._id || null,
      account_id:
        linkedAccount?.account.account_id || `external_${accountNumber}`,
    };
    if (storage.kind === "memory") {
      Object.assign(current, changes);
    } else {
      await storage.db.collection("contacts").updateOne(
        { owner_id: parsed.userId, _id: current._id },
        { $set: changes },
      );
      Object.assign(current, changes);
    }
    return { saved: true, contact: publicContact(current) };
  };
  return storage.kind === "memory" ? storage.withLock(operation) : operation();
}

async function addAccount(input) {
  const parsed = parseInput("add_account", input);
  const storage = getStorage();
  const accountNumber = normalizeAccountNumber(parsed.accountNumber);
  const operation = async () => {
    const owner = await findUser(storage, parsed.userId);
    if (!owner) {
      throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${parsed.userId}`);
    }
    const linked = await findAccountOwner(storage, accountNumber);
    if (linked) {
      throw new ToolError(
        "ACCOUNT_ALREADY_EXISTS",
        "Ese número de cuenta ya está vinculado",
      );
    }
    const account = {
      account_id: `acc_${parsed.userId}_${randomUUID().replaceAll("-", "")}`,
      account_number: accountNumber,
      bank: parsed.bank.trim(),
      type: parsed.type,
      currency: parsed.currency || "MXN",
      ...(parsed.type === "credit_card"
        ? {
            balance_owed: normalizeMoney(parsed.balance || 0),
            credit_limit: normalizeMoney(
              parsed.creditLimit || Math.max(parsed.balance || 0, 1),
            ),
          }
        : { balance: normalizeMoney(parsed.balance || 0) }),
    };
    if (storage.kind === "memory") {
      owner.accounts.push(account);
      for (const contact of storage.data.contacts) {
        if (
          normalizeAccountNumber(contact.account_number) === accountNumber
        ) {
          contact.contact_user_id = parsed.userId;
          contact.account_id = account.account_id;
        }
      }
    } else {
      await storage.db
        .collection("users")
        .updateOne({ _id: parsed.userId }, { $push: { accounts: account } });
      await storage.db.collection("contacts").updateMany(
        { account_number: accountNumber },
        {
          $set: {
            contact_user_id: parsed.userId,
            account_id: account.account_id,
          },
        },
      );
    }
    return { saved: true, user_id: parsed.userId, account };
  };
  return storage.kind === "memory" ? storage.withLock(operation) : operation();
}

function transactionCategory(concept) {
  const normalized = aliasKey(concept || "");
  if (/\b(cena|comida|restaurante|super|mercado)\b/.test(normalized)) {
    return "Alimentos";
  }
  if (/\b(renta|casa|hipoteca|mantenimiento)\b/.test(normalized)) {
    return "Vivienda";
  }
  if (/\b(transporte|uber|taxi|gasolina|metro)\b/.test(normalized)) {
    return "Transporte";
  }
  if (/\b(cine|boletos|viaje|entretenimiento)\b/.test(normalized)) {
    return "Entretenimiento";
  }
  if (/\b(luz|agua|internet|telefono|servicio)\b/.test(normalized)) {
    return "Servicios";
  }
  return "Transferencias";
}

function dateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    end.setHours(23, 59, 59, 999);
  }
  if (start > end) {
    throw new ToolError(
      "INVALID_DATE_RANGE",
      "startDate debe ser anterior o igual a endDate",
    );
  }
  return { start, end };
}

async function loadTransactions(storage, userId, start, end) {
  if (storage.kind === "memory") {
    return storage.data.transactions
      .filter((transaction) => {
        const createdAt = new Date(transaction.created_at);
        return (
          (transaction.from_user_id === userId ||
            transaction.to_user_id === userId) &&
          createdAt >= start &&
          createdAt <= end
        );
      })
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      );
  }
  return storage.db
    .collection("transactions")
    .find({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
      created_at: { $gte: start, $lte: end },
    })
    .sort({ created_at: -1 })
    .toArray();
}

async function userNames(storage, transactions) {
  const ids = [
    ...new Set(
      transactions
        .flatMap((transaction) => [
          transaction.from_user_id,
          transaction.to_user_id,
        ])
        .filter(Boolean),
    ),
  ];
  if (storage.kind === "memory") {
    return new Map(
      storage.data.users
        .filter((user) => ids.includes(user._id))
        .map((user) => [user._id, user.name]),
    );
  }
  const users = await storage.db
    .collection("users")
    .find({ _id: { $in: ids } })
    .project({ name: 1 })
    .toArray();
  return new Map(users.map((user) => [user._id, user.name]));
}

function transactionForUser(transaction, userId, names) {
  const direction =
    transaction.from_user_id === userId ? "outgoing" : "incoming";
  const recipient =
    transaction.recipient_name ||
    names.get(transaction.to_user_id) ||
    transaction.to_alias ||
    "Destinatario";
  const sender =
    names.get(transaction.from_user_id) || "Transferencia recibida";
  return {
    transactionId: serializeId(transaction._id),
    transaction_id: serializeId(transaction._id),
    requestId: transaction.request_id,
    direction,
    timestamp: serializeDate(transaction.created_at),
    status: transaction.status,
    recipient,
    recipientAlias: transaction.to_alias,
    sender,
    concept: transaction.concept || "",
    category: transactionCategory(transaction.concept),
    amount: normalizeMoney(transaction.amount),
    currency: transaction.currency || "MXN",
    accountNumber: transaction.account_number || "",
    bank: transaction.bank || "Banorte",
  };
}

function periodKey(dateValue, groupBy) {
  const date = new Date(dateValue);
  if (groupBy === "month") return date.toISOString().slice(0, 7);
  if (groupBy === "week") {
    const monday = new Date(date);
    const day = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - day);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

async function getFinancialSummary(input) {
  const parsed = parseInput("get_financial_summary", input);
  const storage = getStorage();
  const owner = await findUser(storage, parsed.userId);
  if (!owner) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${parsed.userId}`);
  }
  const range = dateRange(parsed.startDate, parsed.endDate);
  const transactions = await loadTransactions(
    storage,
    parsed.userId,
    range.start,
    range.end,
  );
  const names = await userNames(storage, transactions);
  const details = transactions.map((transaction) =>
    transactionForUser(transaction, parsed.userId, names),
  );
  const totals = details.reduce(
    (summary, transaction) => {
      summary.count += 1;
      if (transaction.direction === "incoming") {
        summary.incoming = normalizeMoney(
          summary.incoming + transaction.amount,
        );
      } else {
        summary.outgoing = normalizeMoney(
          summary.outgoing + transaction.amount,
        );
      }
      summary.net = normalizeMoney(summary.incoming - summary.outgoing);
      return summary;
    },
    { incoming: 0, outgoing: 0, net: 0, count: 0 },
  );
  const groupBy = parsed.groupBy || "day";
  const grouped = new Map();
  for (const transaction of details) {
    const key =
      groupBy === "category"
        ? transaction.category
        : periodKey(transaction.timestamp, groupBy);
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: key,
        incoming: 0,
        outgoing: 0,
        total: 0,
        count: 0,
      });
    }
    const item = grouped.get(key);
    item[transaction.direction === "incoming" ? "incoming" : "outgoing"] =
      normalizeMoney(
        item[
          transaction.direction === "incoming" ? "incoming" : "outgoing"
        ] + transaction.amount,
      );
    item.total = normalizeMoney(item.total + transaction.amount);
    item.count += 1;
  }
  const groups = [...grouped.values()].sort((left, right) =>
    groupBy === "category"
      ? right.total - left.total
      : left.key.localeCompare(right.key),
  );
  const categoryMap = new Map();
  for (const transaction of details.filter(
    (candidate) => candidate.direction === "outgoing",
  )) {
    const current = categoryMap.get(transaction.category) || {
      category: transaction.category,
      total: 0,
      count: 0,
    };
    current.total = normalizeMoney(current.total + transaction.amount);
    current.count += 1;
    categoryMap.set(transaction.category, current);
  }

  return {
    user_id: parsed.userId,
    startDate: range.start.toISOString(),
    endDate: range.end.toISOString(),
    groupBy,
    totals,
    groups,
    categories: [...categoryMap.values()].sort(
      (left, right) => right.total - left.total,
    ),
    transactions: details.slice(0, 50),
  };
}

async function getTransactionDetail(input) {
  const parsed = parseInput("get_transaction_detail", input);
  const storage = getStorage();
  let transaction;
  if (storage.kind === "memory") {
    transaction =
      storage.data.transactions.find(
        (candidate) =>
          serializeId(candidate._id) === parsed.transactionId &&
          (candidate.from_user_id === parsed.userId ||
            candidate.to_user_id === parsed.userId),
      ) || null;
  } else {
    transaction = await storage.db.collection("transactions").findOne({
      _id: { $in: idCandidates(parsed.transactionId) },
      $or: [
        { from_user_id: parsed.userId },
        { to_user_id: parsed.userId },
      ],
    });
  }
  if (!transaction) {
    throw new ToolError(
      "TRANSACTION_NOT_FOUND",
      "No se encontró una transacción accesible con ese identificador",
    );
  }
  const names = await userNames(storage, [transaction]);
  return {
    user_id: parsed.userId,
    transaction: transactionForUser(transaction, parsed.userId, names),
  };
}

async function getCreditPlans(input) {
  const { accountId } = parseInput("getCreditPlans", input);
  const storage = getStorage();
  let plan;
  if (storage.kind === "memory") {
    plan = storage.data.creditPlans.find((candidate) => candidate.account_id === accountId);
  } else {
    plan = await storage.db.collection("credit_plans").findOne({ account_id: accountId });
  }
  if (!plan) {
    throw new ToolError(
      "CREDIT_PLAN_NOT_FOUND",
      `No hay opciones de reestructura para la cuenta ${accountId}`,
    );
  }

  const { _id, ...result } = plan;
  return { plan_id: serializeId(_id), ...clone(result) };
}

function resolveStoredContact(records, args) {
  const byId = args.contactId
    ? records.find(
        (contact) => serializeId(contact._id) === args.contactId,
      )
    : null;
  const byAccount = args.accountNumber
    ? records.find(
        (contact) =>
          normalizeAccountNumber(contact.account_number) === args.accountNumber,
      )
    : null;
  const byAlias = resolveContact(args.toAlias, records)?.record || null;
  const resolved =
    byId || byAccount || byAlias || null;
  if (!resolved) {
    throw new ToolError(
      "CONTACT_NOT_FOUND",
      `No se encontró el contacto "${args.toAlias}"`,
    );
  }
  const canonical = canonicalContact(resolved);
  const aliasContact = byAlias ? canonicalContact(byAlias) : null;
  if (
    (args.contactId && canonical.id !== args.contactId) ||
    (args.accountNumber &&
      normalizeAccountNumber(canonical.accountNumber) !==
        args.accountNumber) ||
    ((byId || byAccount) &&
      (!aliasContact || aliasContact.id !== canonical.id))
  ) {
    throw new ToolError(
      "CONTACT_ACCOUNT_MISMATCH",
      "El contacto y la cuenta no corresponden al mismo registro",
      false,
    );
  }
  return {
    record: resolved,
    args: {
      ...args,
      toAlias: canonical.alias,
      alias_key: aliasKey(canonical.alias),
      contactId: canonical.id,
      accountNumber: normalizeAccountNumber(canonical.accountNumber),
      recipientName: canonical.fullName,
      bank: canonical.bank,
    },
  };
}

function validateReplay(
  transaction,
  { fromUserId, alias_key, amount, concept, contactId, accountNumber },
) {
  if (
    transaction.from_user_id !== fromUserId ||
    transaction.to_alias_key !== alias_key ||
    normalizeMoney(transaction.amount) !== amount ||
    String(transaction.concept || "") !== String(concept || "") ||
    String(transaction.contact_id || "") !== String(contactId || "") ||
    normalizeAccountNumber(transaction.account_number) !==
      normalizeAccountNumber(accountNumber)
  ) {
    throw new ToolError(
      "IDEMPOTENCY_CONFLICT",
      "El requestId ya fue usado con datos diferentes",
      false,
    );
  }
}

function transactionResult(transaction, idempotentReplay = false) {
  return {
    transaction_id: serializeId(transaction._id),
    request_id: transaction.request_id,
    from_user_id: transaction.from_user_id,
    to_user_id: transaction.to_user_id,
    contact_id: transaction.contact_id || "",
    to_alias: transaction.to_alias,
    recipient_name: transaction.recipient_name || transaction.to_alias,
    account_number: transaction.account_number || "",
    bank: transaction.bank || "Banorte",
    from_account: transaction.from_account,
    to_account: transaction.to_account,
    amount: normalizeMoney(transaction.amount),
    concept: transaction.concept || "",
    currency: transaction.currency,
    status: transaction.status,
    created_at: serializeDate(transaction.created_at),
    generated_by_agent: true,
    idempotent_replay: idempotentReplay,
  };
}

async function createMemoryTransaction(storage, args) {
  return storage.withLock(async () => {
    const resolution = resolveStoredContact(
      storage.data.contacts.filter(
        (contact) => contact.owner_id === args.fromUserId,
      ),
      args,
    );
    const contact = resolution.record;
    args = resolution.args;
    const existing = storage.data.transactions.find(
      (transaction) => transaction.request_id === args.requestId,
    );
    if (existing) {
      validateReplay(existing, args);
      return transactionResult(existing, true);
    }

    const sender = storage.data.users.find((user) => user._id === args.fromUserId);
    const recipient = contact.contact_user_id
      ? storage.data.users.find(
          (user) => user._id === contact.contact_user_id,
        )
      : null;
    if (!sender || (contact.contact_user_id && !recipient)) {
      throw new ToolError(
        "USER_NOT_FOUND",
        "No se encontró una cuenta participante",
      );
    }
    const senderAccount = sender.accounts.find((account) => account.type === "checking");
    const recipientAccount = recipient
      ? recipient.accounts.find(
          (account) => account.account_id === contact.account_id,
        )
      : null;
    if (!senderAccount || (recipient && !recipientAccount)) {
      throw new ToolError("ACCOUNT_NOT_FOUND", "No se encontró una cuenta participante");
    }
    if (normalizeMoney(senderAccount.balance) < args.amount) {
      throw new ToolError("INSUFFICIENT_FUNDS", "Fondos insuficientes");
    }

    senderAccount.balance = normalizeMoney(senderAccount.balance - args.amount);
    if (recipientAccount) {
      recipientAccount.balance = normalizeMoney(
        recipientAccount.balance + args.amount,
      );
    }
    const transaction = {
      _id: `tx_${randomUUID()}`,
      request_id: args.requestId,
      from_user_id: args.fromUserId,
      to_user_id: recipient?._id || null,
      contact_id: args.contactId,
      to_alias: contact.alias,
      to_alias_key: contact.alias_key,
      recipient_name: args.recipientName,
      account_number: args.accountNumber,
      bank: args.bank,
      from_account: senderAccount.account_id,
      to_account: recipientAccount?.account_id || contact.account_id,
      amount: args.amount,
      concept: args.concept,
      currency: "MXN",
      status: "completed",
      type: "transfer",
      created_at: new Date().toISOString(),
      generated_by_agent: true,
    };
    storage.data.transactions.push(transaction);
    return transactionResult(transaction);
  });
}

async function loadMongoTransferContext(storage, args, session) {
  const options = session ? { session } : {};
  const contacts = await storage.db
    .collection("contacts")
    .find({ owner_id: args.fromUserId }, options)
    .toArray();
  const resolution = resolveStoredContact(contacts, args);
  Object.assign(args, resolution.args);
  const existing = await storage.db
    .collection("transactions")
    .findOne({ request_id: args.requestId }, options);
  if (existing) {
    validateReplay(existing, args);
    return { existing };
  }

  const contact = resolution.record;
  const sender = await findUser(storage, args.fromUserId, options);
  const recipient = contact.contact_user_id
    ? await findUser(storage, contact.contact_user_id, options)
    : null;
  if (!sender || (contact.contact_user_id && !recipient)) {
    throw new ToolError("USER_NOT_FOUND", "No se encontró una cuenta participante");
  }
  const senderAccount = sender.accounts.find((account) => account.type === "checking");
  const recipientAccount = recipient
    ? recipient.accounts.find(
        (account) => account.account_id === contact.account_id,
      )
    : null;
  if (!senderAccount || (recipient && !recipientAccount)) {
    throw new ToolError("ACCOUNT_NOT_FOUND", "No se encontró una cuenta participante");
  }
  return { contact, recipient, recipientAccount, senderAccount };
}

function makeTransactionDocument(args, context) {
  return {
    request_id: args.requestId,
    from_user_id: args.fromUserId,
    to_user_id: context.recipient?._id || null,
    contact_id: args.contactId,
    to_alias: context.contact.alias,
    to_alias_key: context.contact.alias_key,
    recipient_name: args.recipientName,
    account_number: args.accountNumber,
    bank: args.bank,
    from_account: context.senderAccount.account_id,
    to_account:
      context.recipientAccount?.account_id || context.contact.account_id,
    amount: args.amount,
    concept: args.concept,
    currency: "MXN",
    status: "completed",
    type: "transfer",
    created_at: new Date(),
    generated_by_agent: true,
  };
}

async function applyMongoTransfer(storage, args, session) {
  const options = session ? { session } : {};
  const context = await loadMongoTransferContext(storage, args, session);
  if (context.existing) {
    return transactionResult(context.existing, true);
  }

  const debit = await storage.db.collection("users").updateOne(
    {
      _id: args.fromUserId,
      accounts: {
        $elemMatch: {
          account_id: context.senderAccount.account_id,
          balance: { $gte: args.amount },
        },
      },
    },
    { $inc: { "accounts.$.balance": -args.amount } },
    options,
  );
  if (debit.modifiedCount !== 1) {
    throw new ToolError("INSUFFICIENT_FUNDS", "Fondos insuficientes");
  }

  if (context.recipient) {
    const credit = await storage.db.collection("users").updateOne(
      {
        _id: context.recipient._id,
        "accounts.account_id": context.recipientAccount.account_id,
      },
      { $inc: { "accounts.$.balance": args.amount } },
      options,
    );
    if (credit.modifiedCount !== 1) {
      throw new ToolError(
        "ACCOUNT_NOT_FOUND",
        "No se pudo abonar a la cuenta destino",
      );
    }
  }

  const document = makeTransactionDocument(args, context);
  const inserted = await storage.db.collection("transactions").insertOne(document, options);
  return transactionResult({ _id: inserted.insertedId, ...document });
}

function transactionUnsupported(error) {
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    /transaction numbers are only allowed|does not support transactions/i.test(error?.message || "")
  );
}

async function createMongoTransactionWithoutSession(storage, args) {
  return storage.withLock(async () => {
    const context = await loadMongoTransferContext(storage, args);
    if (context.existing) {
      return transactionResult(context.existing, true);
    }

    const debit = await storage.db.collection("users").updateOne(
      {
        _id: args.fromUserId,
        accounts: {
          $elemMatch: {
            account_id: context.senderAccount.account_id,
            balance: { $gte: args.amount },
          },
        },
      },
      { $inc: { "accounts.$.balance": -args.amount } },
    );
    if (debit.modifiedCount !== 1) {
      throw new ToolError("INSUFFICIENT_FUNDS", "Fondos insuficientes");
    }

    let credited = false;
    try {
      if (context.recipient) {
        const credit = await storage.db.collection("users").updateOne(
          {
            _id: context.recipient._id,
            "accounts.account_id": context.recipientAccount.account_id,
          },
          { $inc: { "accounts.$.balance": args.amount } },
        );
        if (credit.modifiedCount !== 1) {
          throw new ToolError(
            "ACCOUNT_NOT_FOUND",
            "No se pudo abonar a la cuenta destino",
          );
        }
        credited = true;
      }

      const document = makeTransactionDocument(args, context);
      const inserted = await storage.db.collection("transactions").insertOne(document);
      return transactionResult({ _id: inserted.insertedId, ...document });
    } catch (error) {
      await storage.db.collection("users").updateOne(
        { _id: args.fromUserId, "accounts.account_id": context.senderAccount.account_id },
        { $inc: { "accounts.$.balance": args.amount } },
      );
      if (credited) {
        await storage.db.collection("users").updateOne(
          {
            _id: context.recipient._id,
            "accounts.account_id": context.recipientAccount.account_id,
          },
          { $inc: { "accounts.$.balance": -args.amount } },
        );
      }
      throw error;
    }
  });
}

async function createMongoTransaction(storage, args) {
  const session = storage.client.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await applyMongoTransfer(storage, args, session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
    return result;
  } catch (error) {
    if (transactionUnsupported(error)) {
      return createMongoTransactionWithoutSession(storage, args);
    }
    if (error?.code === 11000) {
      const existing = await storage.db
        .collection("transactions")
        .findOne({ request_id: args.requestId });
      if (existing) {
        validateReplay(existing, args);
        return transactionResult(existing, true);
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function createTransaction(input) {
  const parsed = parseInput("createTransaction", input);
  const toAlias = normalizeAlias(parsed.toAlias);
  const args = {
    ...parsed,
    toAlias,
    alias_key: aliasKey(toAlias),
    amount: normalizeMoney(parsed.amount),
    concept: parsed.concept?.replace(/\s+/g, " ").trim() || "",
    accountNumber: parsed.accountNumber
      ? normalizeAccountNumber(parsed.accountNumber)
      : "",
    requestId: parsed.requestId || randomUUID(),
  };
  const storage = getStorage();

  try {
    if (storage.kind === "memory") {
      return await createMemoryTransaction(storage, args);
    }
    return await createMongoTransaction(storage, args);
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    throw new ToolError("STORAGE_ERROR", "No fue posible completar la transferencia");
  }
}

async function saveInteraction(input) {
  const { userId, prompt, response } = parseInput("saveInteraction", input);
  const storage = getStorage();
  const user = await findUser(storage, userId);
  if (!user) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${userId}`);
  }
  const interaction = {
    user_id: userId,
    prompt,
    response: clone(response),
    created_at: new Date(),
    rating: null,
  };

  if (storage.kind === "memory") {
    interaction._id = `i_${randomUUID()}`;
    storage.data.interactions.push(interaction);
  } else {
    const inserted = await storage.db.collection("interactions").insertOne(interaction);
    interaction._id = inserted.insertedId;
  }

  return {
    interaction_id: serializeId(interaction._id),
    user_id: userId,
    created_at: serializeDate(interaction.created_at),
  };
}

async function saveRating(input) {
  const { interactionId, rating } = parseInput("saveRating", input);
  const storage = getStorage();

  if (storage.kind === "memory") {
    const interaction = storage.data.interactions.find(
      (candidate) => candidate._id === interactionId,
    );
    if (!interaction) {
      throw new ToolError("INTERACTION_NOT_FOUND", "No se encontró la interacción");
    }
    interaction.rating = rating;
    interaction.rated_at = new Date().toISOString();
  } else {
    if (!ObjectId.isValid(interactionId)) {
      throw new ToolError("INTERACTION_NOT_FOUND", "No se encontró la interacción");
    }
    const updated = await storage.db.collection("interactions").updateOne(
      { _id: ObjectId.createFromHexString(interactionId) },
      { $set: { rating, rated_at: new Date() } },
    );
    if (updated.matchedCount !== 1) {
      throw new ToolError("INTERACTION_NOT_FOUND", "No se encontró la interacción");
    }
  }

  return {
    interaction_id: interactionId,
    rating,
    saved: true,
  };
}

const handlers = Object.freeze({
  getBalance,
  getContacts,
  getCreditPlans,
  createTransaction,
  saveInteraction,
  saveRating,
  get_contacts: getContacts,
  add_contact: addContact,
  update_contact: updateContact,
  add_account: addAccount,
  get_financial_summary: getFinancialSummary,
  get_transaction_detail: getTransactionDetail,
});

module.exports = {
  MAX_TRANSACTION_AMOUNT,
  ToolError,
  addAccount,
  addContact,
  createTransaction,
  getBalance,
  getContacts,
  getCreditPlans,
  getFinancialSummary,
  getRecentTransactions,
  getTransactionDetail,
  handlers,
  inputSchemas,
  normalizeAlias,
  normalizeMoney,
  saveInteraction,
  saveRating,
  toolDefinitions,
  updateContact,
};
