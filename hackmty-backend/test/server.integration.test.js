"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { WebSocket } = require("ws");

const { clearMemory, processMessage } = require("../llm");
const { McpGateway } = require("../mcpClient");
const { createBackend } = require("../server");

function makeCollector(ws) {
  const buffered = [];
  const waiters = new Set();

  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));
    const waiter = [...waiters].find(({ predicate }) => predicate(message));
    if (waiter) {
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else {
      buffered.push(message);
    }
  });

  return {
    next(predicate, timeoutMs = 5000) {
      const index = buffered.findIndex(predicate);
      if (index >= 0) {
        return Promise.resolve(buffered.splice(index, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            waiters.delete(waiter);
            reject(
              new Error(
                `No llegó el mensaje esperado. Recibidos: ${JSON.stringify(buffered)}`,
              ),
            );
          }, timeoutMs),
        };
        waiters.add(waiter);
      });
    },
  };
}

async function connectClient(url) {
  const ws = new WebSocket(url);
  const collector = makeCollector(ws);
  await once(ws, "open");
  return { collector, ws };
}

function send(ws, payload) {
  ws.send(JSON.stringify(payload));
}

test("WebSocket completa transferencia confirmada, rating y notificación", async (t) => {
  const mcp = new McpGateway({
    env: {
      MONGODB_URI: "",
      GEMINI_API_KEY: "",
      LLM_API_KEY: "",
    },
    logger: () => {},
  });
  const backend = await createBackend({
    heartbeatMs: 60000,
    mcp,
    messageProcessor: (userId, text, gateway) =>
      processMessage(userId, text, gateway, { forceLocal: true }),
  });
  const address = await backend.listen(0, "127.0.0.1");
  const url = `ws://127.0.0.1:${address.port}`;
  let sender;
  let recipient;
  t.after(async () => {
    sender?.ws.terminate();
    recipient?.ws.terminate();
    clearMemory("u1");
    clearMemory("u2");
    await backend.close();
  });
  const healthResponse = await fetch(
    `http://127.0.0.1:${address.port}/health`,
  );
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.tool_count, 12);
  assert.equal(health.storage, "memory");
  assert.equal(health.storage_reason, "MONGODB_URI_MISSING");
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${address.port}/api/demo-users`)
    ).status,
    404,
  );

  sender = await connectClient(url);
  recipient = await connectClient(url);

  send(sender.ws, {
    type: "auth_login",
    username: "usuario-inexistente",
    password: "1234",
  });
  const unknownUser = await sender.collector.next(
    (message) => message.code === "AUTH_USER_NOT_FOUND",
  );
  assert.equal(unknownUser.message, "El usuario no existe.");

  send(sender.ws, {
    type: "auth_login",
    username: "Mau",
    password: "1234",
  });
  send(recipient.ws, {
    type: "auth_login",
    username: "Timo",
    password: "1234",
  });
  const senderAuth = await sender.collector.next(
    (message) => message.type === "auth_success",
  );
  await recipient.collector.next((message) => message.type === "auth_success");
  assert.equal(senderAuth.user.id, "u1");
  assert.equal(senderAuth.overview.available_balance, 24500);

  send(sender.ws, {
    type: "user_message",
    text: "¿Cuál es mi saldo?",
  });
  const currentBalance = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "balance_card",
  );
  assert.equal(currentBalance.props.user.id, "u1");

  send(sender.ws, {
    type: "user_message",
    text: "Muéstrame una gráfica de mis movimientos",
  });
  const chart = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "financial_chart",
  );
  assert.equal(chart.props.chartType, "bar");
  assert.equal(Array.isArray(chart.props.data), true);

  send(sender.ws, {
    type: "user_message",
    user_id: "u4",
    text: "Mándale $1,500 pesos a Braulio por la cena",
  });
  const form = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "transfer_form",
  );
  assert.equal(form.props.to_alias, "Brau");
  assert.equal(form.props.amount, 1500);
  assert.deepEqual(form.props.initialValues, {
    recipient: "Braulio Garcia",
    amount: "1500",
    concept: "Cena",
    accountNumber: "072180000004125000",
    bank: "Banorte",
  });
  assert.equal(form.props.requires_confirmation, true);
  assert.equal(form.props.request_id.length > 8, true);
  assert.equal(typeof form.interaction_id, "string");

  send(sender.ws, {
    type: "rate_interaction",
    interaction_id: form.interaction_id,
    rating: 9,
  });
  const rating = await sender.collector.next(
    (message) => message.type === "rating_saved",
  );
  assert.equal(rating.rating, 9);

  send(sender.ws, {
    type: "confirm_transfer",
    request_id: form.props.request_id,
    contact_id: "contact_u1_u2",
    to_alias: "Timo",
    account_number: "072180000002083000",
    bank: "Banorte",
    amount: 1400,
    concept: "Comida",
  });
  const receipt = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "transfer_success",
  );
  assert.equal(receipt.props.amount, 1400);
  assert.equal(receipt.props.concept, "Comida");
  assert.equal(receipt.props.to_user_id, "u2");
  assert.equal(typeof receipt.interaction_id, "string");

  const senderOverview = await sender.collector.next(
    (message) => message.type === "overview_update",
  );
  const recipientOverview = await recipient.collector.next(
    (message) => message.type === "overview_update",
  );
  assert.equal(senderOverview.overview.available_balance, 23100);
  assert.equal(recipientOverview.overview.available_balance, 9700);
  assert.equal(senderOverview.overview.movements[0].direction, "outgoing");
  assert.equal(recipientOverview.overview.movements[0].direction, "incoming");

  const notification = await recipient.collector.next(
    (message) => message.type === "notification",
  );
  assert.equal(notification.title, "Transferencia recibida");
  assert.match(notification.body, /Mauricio Hernández/);
  assert.equal(typeof notification.timestamp, "string");

  send(sender.ws, {
    type: "confirm_transfer",
    request_id: form.props.request_id,
  });
  const replayError = await sender.collector.next(
    (message) => message.code === "TRANSFER_ALREADY_PROCESSED",
  );
  assert.equal(replayError.recoverable, false);

  send(sender.ws, {
    type: "user_message",
    user_id: "u4",
    text: "¿Cuál es mi saldo?",
  });
  const balance = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "balance_card",
  );
  assert.equal(balance.props.user.id, "u1");
});
