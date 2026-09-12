// mcpTools.js
// Funciones puras sobre la base de datos. Cada una está pensada para volverse,
// tal cual, una "tool" de tu servidor MCP (nombre, descripción y esta misma
// lógica como handler).

const { getDB } = require("./db");

/** Tool MCP: get_balance(user_id) */
async function getBalance(userId) {
  const db = getDB();
  const user = await db.collection("users").findOne({ _id: userId });
  if (!user) throw new Error(`Usuario ${userId} no existe`);
  return { user_id: userId, name: user.name, accounts: user.accounts };
}

/** Tool MCP: get_contacts(user_id) */
async function getContacts(userId) {
  const db = getDB();
  return db.collection("contacts").find({ owner_id: userId }).toArray();
}

/**
 * Tool MCP: create_transaction(from_user_id, to_alias, amount)
 * Resuelve el alias del contacto a su cuenta destino, valida fondos,
 * actualiza ambos balances y registra la transacción.
 */
async function createTransaction(fromUserId, toAlias, amount) {
  const db = getDB();

  const contact = await db
    .collection("contacts")
    .findOne({ owner_id: fromUserId, alias: new RegExp(`^${toAlias}$`, "i") });
  if (!contact) throw new Error(`No se encontró el contacto "${toAlias}" para este usuario`);

  const fromUser = await db.collection("users").findOne({ _id: fromUserId });
  const fromAccount = fromUser.accounts.find((a) => a.type === "checking");
  if (!fromAccount) throw new Error("El usuario origen no tiene cuenta de cheques");
  if (fromAccount.balance < amount) throw new Error("Fondos insuficientes");

  const toUserId = contact.contact_user_id;

  // Descuenta al origen, abona al destino
  await db
    .collection("users")
    .updateOne(
      { _id: fromUserId, "accounts.account_id": fromAccount.account_id },
      { $inc: { "accounts.$.balance": -amount } }
    );
  await db
    .collection("users")
    .updateOne(
      { _id: toUserId, "accounts.account_id": contact.account_id },
      { $inc: { "accounts.$.balance": amount } }
    );

  const transaction = {
    from_account: fromAccount.account_id,
    to_account: contact.account_id,
    amount,
    currency: "MXN",
    status: "completed",
    type: "transfer",
    created_at: new Date().toISOString(),
    generated_by_agent: true,
  };
  const result = await db.collection("transactions").insertOne(transaction);

  return { ...transaction, _id: result.insertedId };
}

/** Tool MCP: get_credit_plans(account_id) */
async function getCreditPlans(accountId) {
  const db = getDB();
  const plan = await db.collection("credit_plans").findOne({ account_id: accountId });
  if (!plan) throw new Error(`No hay plan de crédito para la cuenta ${accountId}`);
  return plan;
}

module.exports = { getBalance, getContacts, createTransaction, getCreditPlans };
