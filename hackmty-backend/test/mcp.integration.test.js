"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { clearMemory, localFallback } = require("../llm");
const { EXPECTED_TOOLS, McpGateway, extractToolError } = require("../mcpClient");

test("expone el texto de error cuando MCP no manda JSON estructurado", () => {
  const error = extractToolError({
    isError: true,
    content: [{ type: "text", text: "contactId inválido" }],
  });
  assert.equal(error.message, "contactId inválido");
});

async function memoryGateway(t) {
  const mcp = new McpGateway({
    env: {
      MONGODB_URI: "",
      GEMINI_API_KEY: "",
      LLM_API_KEY: "",
    },
    logger: () => {},
  });
  await mcp.connect();
  t.after(() => mcp.close());
  return mcp;
}

test("el subproceso MCP publica las diecinueve tools registradas", async (t) => {
  const mcp = await memoryGateway(t);
  const names = (await mcp.listTools()).map((tool) => tool.name).sort();
  assert.deepEqual(names, [...EXPECTED_TOOLS].sort());
  assert.equal(mcp.getHealth().storage, "memory");
});

test("las tools administrativas auditan usuarios, interfaces y ratings", async (t) => {
  const mcp = await memoryGateway(t);
  await assert.rejects(
    mcp.callTool("authenticateAdmin", {
      username: "admin",
      password: "incorrecta",
    }),
    (error) => error.code === "ADMIN_INVALID_CREDENTIALS",
  );
  const authentication = await mcp.callTool("authenticateAdmin", {
    username: "ADMIN",
    password: "1",
  });
  assert.equal(authentication.admin.username, "admin");

  const first = await mcp.callTool("saveInteraction", {
    userId: "u1",
    prompt: "Muéstrame mi saldo",
    response: { type: "ui", component: "balance_card", props: {} },
  });
  await mcp.callTool("saveInteraction", {
    userId: "u2",
    prompt: "Muéstrame mis contactos",
    response: { type: "ui", component: "contacts_list", props: {} },
  });
  await mcp.callTool("saveRating", {
    interactionId: first.interaction_id,
    rating: 9,
  });

  const overview = await mcp.callTool("getAdminOverview", {});
  assert.deepEqual(overview.totals, {
    users: 4,
    interfaces: 2,
    rated: 1,
    unrated: 1,
    average_rating: 9,
  });
  assert.equal(
    overview.rating_distribution.find((item) => item.rating === 9).count,
    1,
  );

  const users = await mcp.callTool("listAdminUsers", {
    search: "Mauricio",
    page: 1,
    pageSize: 10,
  });
  assert.equal(users.total, 1);
  assert.equal(users.items[0].interaction_count, 1);
  assert.equal(users.items[0].average_rating, 9);

  const interactions = await mcp.callTool("listAdminInteractions", {
    userId: "u1",
    ratingStatus: "rated",
    page: 1,
    pageSize: 10,
  });
  assert.equal(interactions.total, 1);
  assert.equal(interactions.items[0].component, "balance_card");

  const detail = await mcp.callTool("getAdminInteraction", {
    interactionId: first.interaction_id,
  });
  assert.equal(detail.user.id, "u1");
  assert.equal(detail.rating, 9);
  assert.equal(detail.response.component, "balance_card");
});

test("las nuevas tools MCP administran contactos, cuentas y analítica", async (t) => {
  const mcp = await memoryGateway(t);
  const contacts = await mcp.callTool("get_contacts", { userId: "u2" });
  const mau = contacts.contacts.find((contact) => contact.name === "Mau");
  assert.equal(mau.name, "Mau");
  assert.equal(mau.clabe, "072180000001245678");

  const registered = await mcp.callTool("register_account", {
    userId: "u2",
    name: "Carlos",
    clabe: "012180001234567890",
    bank: "Banco Demo",
  });
  assert.equal(registered.account.name, "Carlos");
  assert.equal(registered.account.clabe, "012180001234567890");

  // Registrar una CLABE que no pertenece a ningún usuario real debe
  // permitirse, pero la transferencia debe fallar al confirmar.
  await assert.rejects(
    () =>
      mcp.callTool("createTransaction", {
        fromUserId: "u2",
        registeredName: "Carlos",
        toAlias: "Carlos",
        amount: 10,
        concept: "CLABE inexistente",
      }),
    (error) =>
      error.code === "CLABE_NOT_FOUND" &&
      /ninguna cuenta del sistema/i.test(error.message),
  );

  const updatedContact = await mcp.callTool("update_contact", {
    userId: "u2",
    contact_id: registered.account.id,
    name: "Carlitos",
  });
  assert.equal(updatedContact.contact.name, "Carlitos");
  assert.equal(updatedContact.contact.holder_name, "");

  const mauBefore = await mcp.callTool("getBalance", { userId: "u1" });
  const renamedMau = await mcp.callTool("update_contact", {
    userId: "u2",
    contact_id: "contact_u2_u1",
    name: "MiMau",
  });
  assert.equal(renamedMau.contact.name, "MiMau");
  assert.equal(renamedMau.contact.holder_name, "Mauricio Hernández");
  const mauAfter = await mcp.callTool("getBalance", { userId: "u1" });
  assert.equal(mauAfter.user.name, mauBefore.user.name);

  const deleted = await mcp.callTool("delete_contact", {
    userId: "u2",
    contact_id: updatedContact.contact.id,
  });
  assert.equal(deleted.deleted, true);
  const remaining = await mcp.callTool("get_contacts", { userId: "u2" });
  assert.equal(
    remaining.contacts.some(
      (contact) => contact.id === updatedContact.contact.id,
    ),
    false,
  );

  const externalTransfer = await mcp.callTool("createTransaction", {
    fromUserId: "u2",
    contactId: "contact_u2_u1",
    registeredName: "MiMau",
    toAlias: "MiMau",
    clabe: "072180000001245678",
    amount: 50,
    concept: "Prueba",
  });
  assert.equal(externalTransfer.to_user_id, "u1");
  assert.equal(externalTransfer.registered_name, "MiMau");

  await assert.rejects(
    () =>
      mcp.callTool("createTransaction", {
        fromUserId: "u2",
        registeredName: "MiMau",
        toAlias: "MiMau",
        clabe: "000000000000000000",
        amount: 10,
        concept: "Falla",
      }),
    (error) => error.code === "CLABE_NOT_FOUND",
  );

  const account = await mcp.callTool("add_account", {
    userId: "u2",
    type: "savings",
    name: "Ahorro",
    clabe: "072180000002999999",
    bank: "Banorte",
    balance: 1200,
  });
  assert.equal(account.account.type, "savings");
  assert.equal(account.account.clabe, "072180000002999999");

  const summary = await mcp.callTool("get_financial_summary", {
    userId: "u2",
    groupBy: "month",
  });
  assert.equal(summary.totals.count > 0, true);
  assert.equal(summary.groups.length > 0, true);
  const detail = await mcp.callTool("get_transaction_detail", {
    userId: "u2",
    transactionId: summary.transactions[0].transactionId,
  });
  assert.equal(
    detail.transaction.transactionId,
    summary.transactions[0].transactionId,
  );
});

test("consulta seed, ejecuta una transferencia idempotente y guarda rating", async (t) => {
  const mcp = await memoryGateway(t);
  const before = await mcp.callTool("getBalance", { userId: "u1" });
  const contacts = await mcp.callTool("getContacts", { userId: "u1" });
  const credit = await mcp.callTool("getCreditPlans", { accountId: "acc_u1_credit" });

  assert.equal(contacts.contacts.length, 3);
  assert.equal(credit.options.length, 3);

  const requestId = randomUUID();
  const first = await mcp.callTool("createTransaction", {
    fromUserId: "u1",
    toAlias: "Timo",
    amount: 500.25,
    concept: "Cena",
    requestId,
  });
  const replay = await mcp.callTool("createTransaction", {
    fromUserId: "u1",
    toAlias: "Timo",
    amount: 500.25,
    concept: "Cena",
    requestId,
  });
  const after = await mcp.callTool("getBalance", { userId: "u1" });

  assert.equal(first.transaction_id, replay.transaction_id);
  assert.equal(first.concept, "Cena");
  assert.equal(replay.idempotent_replay, true);
  assert.equal(
    after.accounts.find((account) => account.type === "checking").balance,
    before.accounts.find((account) => account.type === "checking").balance - 500.25,
  );
  assert.equal(after.recent_transactions[0].direction, "outgoing");
  assert.equal(after.recent_transactions[0].counterparty, "Timo");
  assert.equal(after.recent_transactions[0].concept, "Cena");

  const interaction = await mcp.callTool("saveInteraction", {
    userId: "u1",
    prompt: "prueba",
    response: { type: "ui", component: "balance_card", props: {} },
  });
  const rating = await mcp.callTool("saveRating", {
    interactionId: interaction.interaction_id,
    rating: 10,
  });
  assert.equal(rating.saved, true);
  assert.equal(rating.rating, 10);
});

test("el fallback consulta MCP y nunca transfiere en el primer turno", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u1"));
  const before = await mcp.callTool("getBalance", { userId: "u1" });
  const ui = await localFallback(
    "u1",
    "Mándale mil quinientos pesos a Timo, por favor",
    mcp,
  );
  const after = await mcp.callTool("getBalance", { userId: "u1" });

  assert.equal(ui.component, "transfer_form");
  assert.equal(ui.props.to_alias, "Timo");
  assert.equal(ui.props.registered_name, "Timo");
  assert.equal(ui.props.amount, 1500);
  assert.deepEqual(after.accounts, before.accounts);
});

test("precarga persona, monto y concepto aunque la persona no sea un contacto", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u1"));
  const ui = await localFallback(
    "u1",
    "Quiero transferir $500 a Carlos por la cena",
    mcp,
  );

  assert.equal(ui.component, "transfer_form");
  assert.deepEqual(ui.props.initialValues, {
    recipient: "Carlos",
    amount: "500",
    concept: "Cena",
    accountNumber: "",
    clabe: "",
    bank: "",
  });
  assert.equal(ui.props.to_alias, "Carlos");
  assert.equal(ui.props.registered_name, "Carlos");
  assert.equal(ui.props.missing_fields.length, 0);
  assert.equal(ui.props.available_contacts.length, 3);
});

test("Mau se resuelve al nombre registrado y CLABE antes de transferir", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u2"));
  const ui = await localFallback(
    "u2",
    "Transfiere $500 a Mau por la cena",
    mcp,
  );

  assert.equal(ui.component, "transfer_form");
  assert.equal(ui.props.contact_id, "contact_u2_u1");
  assert.equal(ui.props.to_alias, "Mau");
  assert.equal(ui.props.registered_name, "Mau");
  assert.equal(ui.props.recipient_name, "Mau");
  assert.equal(ui.props.clabe, "072180000001245678");
  assert.equal(ui.props.account_number, "072180000001245678");
  assert.equal(ui.props.bank, "Banorte");

  const transaction = await mcp.callTool("createTransaction", {
    fromUserId: "u2",
    contactId: ui.props.contact_id,
    registeredName: ui.props.registered_name,
    toAlias: ui.props.to_alias,
    clabe: ui.props.clabe,
    amount: ui.props.amount,
    concept: ui.props.concept,
  });
  assert.equal(transaction.to_user_id, "u1");
  assert.equal(transaction.registered_name, "Mau");
  assert.equal(transaction.recipient_name, "Mau");
  assert.equal(transaction.clabe, "072180000001245678");
});

test("confirma la transferencia aunque el texto no coincida con el nombre registrado", async (t) => {
  const mcp = await memoryGateway(t);
  const transaction = await mcp.callTool("createTransaction", {
    fromUserId: "u1",
    contactId: "contact_u1_u2",
    toAlias: "Destinatario",
    registeredName: "Destinatario",
    amount: 25,
    concept: "Ajuste",
  });
  assert.equal(transaction.to_user_id, "u2");
  assert.equal(transaction.to_alias, "Timo");
  assert.equal(transaction.registered_name, "Timo");
  assert.equal(transaction.recipient_name, "Timo");
});

test("genera el formulario editable aun cuando faltan entidades", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u1"));
  const ui = await localFallback(
    "u1",
    "Quiero hacer una transferencia",
    mcp,
  );

  assert.equal(ui.component, "transfer_form");
  assert.deepEqual(ui.props.initialValues, {
    recipient: "",
    amount: "",
    concept: "",
    accountNumber: "",
    clabe: "",
    bank: "",
  });
  assert.deepEqual(ui.props.missing_fields, ["recipient", "amount"]);
});

test("genera el formulario de registro de cuenta por nombre y CLABE", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u1"));
  const ui = await localFallback(
    "u1",
    "Registra una cuenta llamada Renta con CLABE 072180000009999999",
    mcp,
  );
  assert.equal(ui.component, "register_account_form");
  assert.equal(ui.props.name, "Renta");
  assert.equal(ui.props.clabe, "072180000009999999");
});

test("el fallback genera una gráfica con datos financieros reales", async (t) => {
  const mcp = await memoryGateway(t);
  const ui = await localFallback(
    "u1",
    "Muéstrame una gráfica de mis movimientos",
    mcp,
  );

  assert.equal(ui.component, "financial_chart");
  assert.equal(ui.props.chartType, "bar");
  assert.equal(ui.props.data.length >= 2, true);
});

test("genera pastel, línea, resumen y detalle transaccional", async (t) => {
  const mcp = await memoryGateway(t);
  t.after(() => clearMemory("u2"));

  const pie = await localFallback(
    "u2",
    "Grafica mis gastos en pastel",
    mcp,
  );
  assert.equal(pie.component, "financial_chart");
  assert.equal(pie.props.chartType, "pie");
  assert.deepEqual(
    pie.props.data.map((item) => item.label).sort(),
    ["Entradas", "Salidas"],
  );

  const line = await localFallback(
    "u2",
    "Muéstrame la evolución de gastos en una gráfica de línea",
    mcp,
  );
  assert.equal(line.props.chartType, "bar");
  assert.deepEqual(
    line.props.data.map((item) => item.label).sort(),
    ["Entradas", "Salidas"],
  );

  const summary = await localFallback(
    "u2",
    "Dame un resumen de transferencias",
    mcp,
  );
  assert.equal(summary.component, "transactions_summary");
  assert.equal(summary.props.groups.length > 0, true);

  const detail = await localFallback(
    "u2",
    "Quiero el detalle del pago a Mau",
    mcp,
  );
  assert.equal(detail.component, "transaction_detail");
  assert.equal(detail.props.transaction.recipient, "Mau");
  assert.equal(detail.props.transaction.concept, "Boletos");
});
