"use strict";

const { randomUUID } = require("node:crypto");
const { ObjectId } = require("mongodb");
const { z } = require("zod");
const { aliasKey } = require("./demoData");
const { getStorage } = require("./db");

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
    requestId: requestIdSchema.optional(),
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

async function findUser(storage, userId, options = {}) {
  if (storage.kind === "memory") {
    return storage.data.users.find((user) => user._id === userId) || null;
  }
  return storage.db.collection("users").findOne({ _id: userId }, options);
}

async function getBalance(input) {
  const { userId } = parseInput("getBalance", input);
  const storage = getStorage();
  const user = await findUser(storage, userId);
  if (!user) {
    throw new ToolError("USER_NOT_FOUND", `No existe el usuario ${userId}`);
  }

  return {
    user_id: userId,
    user: publicUser(user),
    accounts: publicAccounts(user.accounts),
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
      .map(({ alias, display_name, contact_user_id, account_id }) => ({
        alias,
        display_name,
        user_id: contact_user_id,
        account_id,
      }))
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "es")),
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

function validateReplay(transaction, { fromUserId, alias_key, amount }) {
  if (
    transaction.from_user_id !== fromUserId ||
    transaction.to_alias_key !== alias_key ||
    normalizeMoney(transaction.amount) !== amount
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
    to_alias: transaction.to_alias,
    from_account: transaction.from_account,
    to_account: transaction.to_account,
    amount: normalizeMoney(transaction.amount),
    currency: transaction.currency,
    status: transaction.status,
    created_at: serializeDate(transaction.created_at),
    generated_by_agent: true,
    idempotent_replay: idempotentReplay,
  };
}

async function createMemoryTransaction(storage, args) {
  return storage.withLock(async () => {
    const existing = storage.data.transactions.find(
      (transaction) => transaction.request_id === args.requestId,
    );
    if (existing) {
      validateReplay(existing, args);
      return transactionResult(existing, true);
    }

    const contact = storage.data.contacts.find(
      (candidate) =>
        candidate.owner_id === args.fromUserId && candidate.alias_key === args.alias_key,
    );
    if (!contact) {
      throw new ToolError(
        "CONTACT_NOT_FOUND",
        `No se encontró el contacto "${args.toAlias}"`,
      );
    }

    const sender = storage.data.users.find((user) => user._id === args.fromUserId);
    const recipient = storage.data.users.find((user) => user._id === contact.contact_user_id);
    if (!sender || !recipient) {
      throw new ToolError("USER_NOT_FOUND", "No se encontró una cuenta participante");
    }
    const senderAccount = sender.accounts.find((account) => account.type === "checking");
    const recipientAccount = recipient.accounts.find(
      (account) => account.account_id === contact.account_id,
    );
    if (!senderAccount || !recipientAccount) {
      throw new ToolError("ACCOUNT_NOT_FOUND", "No se encontró una cuenta participante");
    }
    if (normalizeMoney(senderAccount.balance) < args.amount) {
      throw new ToolError("INSUFFICIENT_FUNDS", "Fondos insuficientes");
    }

    senderAccount.balance = normalizeMoney(senderAccount.balance - args.amount);
    recipientAccount.balance = normalizeMoney(recipientAccount.balance + args.amount);
    const transaction = {
      _id: `tx_${randomUUID()}`,
      request_id: args.requestId,
      from_user_id: args.fromUserId,
      to_user_id: recipient._id,
      to_alias: contact.alias,
      to_alias_key: contact.alias_key,
      from_account: senderAccount.account_id,
      to_account: recipientAccount.account_id,
      amount: args.amount,
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
  const existing = await storage.db
    .collection("transactions")
    .findOne({ request_id: args.requestId }, options);
  if (existing) {
    validateReplay(existing, args);
    return { existing };
  }

  const contact = await storage.db.collection("contacts").findOne(
    { owner_id: args.fromUserId, alias_key: args.alias_key },
    options,
  );
  if (!contact) {
    throw new ToolError("CONTACT_NOT_FOUND", `No se encontró el contacto "${args.toAlias}"`);
  }
  const sender = await findUser(storage, args.fromUserId, options);
  const recipient = await findUser(storage, contact.contact_user_id, options);
  if (!sender || !recipient) {
    throw new ToolError("USER_NOT_FOUND", "No se encontró una cuenta participante");
  }
  const senderAccount = sender.accounts.find((account) => account.type === "checking");
  const recipientAccount = recipient.accounts.find(
    (account) => account.account_id === contact.account_id,
  );
  if (!senderAccount || !recipientAccount) {
    throw new ToolError("ACCOUNT_NOT_FOUND", "No se encontró una cuenta participante");
  }
  return { contact, recipient, recipientAccount, senderAccount };
}

function makeTransactionDocument(args, context) {
  return {
    request_id: args.requestId,
    from_user_id: args.fromUserId,
    to_user_id: context.recipient._id,
    to_alias: context.contact.alias,
    to_alias_key: context.contact.alias_key,
    from_account: context.senderAccount.account_id,
    to_account: context.recipientAccount.account_id,
    amount: args.amount,
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

  const credit = await storage.db.collection("users").updateOne(
    { _id: context.recipient._id, "accounts.account_id": context.recipientAccount.account_id },
    { $inc: { "accounts.$.balance": args.amount } },
    options,
  );
  if (credit.modifiedCount !== 1) {
    throw new ToolError("ACCOUNT_NOT_FOUND", "No se pudo abonar a la cuenta destino");
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
      const credit = await storage.db.collection("users").updateOne(
        {
          _id: context.recipient._id,
          "accounts.account_id": context.recipientAccount.account_id,
        },
        { $inc: { "accounts.$.balance": args.amount } },
      );
      if (credit.modifiedCount !== 1) {
        throw new ToolError("ACCOUNT_NOT_FOUND", "No se pudo abonar a la cuenta destino");
      }
      credited = true;

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
});

module.exports = {
  MAX_TRANSACTION_AMOUNT,
  ToolError,
  createTransaction,
  getBalance,
  getContacts,
  getCreditPlans,
  handlers,
  inputSchemas,
  normalizeAlias,
  normalizeMoney,
  saveInteraction,
  saveRating,
  toolDefinitions,
};
