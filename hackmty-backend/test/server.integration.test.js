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
    audioTranscriber: async ({ data, mimeType }) => {
      assert.equal(data, "Zm9v");
      assert.equal(mimeType, "audio/mp4");
      return "¿Cuál es mi saldo?";
    },
  });
  const address = await backend.listen(0, "127.0.0.1");
  const url = `ws://127.0.0.1:${address.port}`;
  const healthResponse = await fetch(
    `http://127.0.0.1:${address.port}/health`,
  );
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.tool_count, 6);
  assert.equal(health.storage, "memory");

  const sender = await connectClient(url);
  const recipient = await connectClient(url);

  t.after(async () => {
    sender.ws.terminate();
    recipient.ws.terminate();
    clearMemory("u1");
    clearMemory("u2");
    await backend.close();
  });

  await sender.collector.next((message) => message.type === "demo_users");
  await recipient.collector.next((message) => message.type === "demo_users");

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
    type: "audio_stream",
    audio_base64: "Zm9v",
    mime_type: "audio/mp4",
    duration_ms: 500,
  });
  const transcription = await sender.collector.next(
    (message) => message.type === "transcription",
  );
  assert.equal(transcription.text, "¿Cuál es mi saldo?");
  const spokenBalance = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "balance_card",
  );
  assert.equal(spokenBalance.props.user.id, "u1");

  send(sender.ws, {
    type: "user_message",
    user_id: "u4",
    text: "Mándale $1,500 pesos a Timoteo",
  });
  const form = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "transfer_form",
  );
  assert.equal(form.props.to_alias, "Timo");
  assert.equal(form.props.amount, 1500);
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
    to_alias: "Timo",
    amount: 1500,
  });
  const receipt = await sender.collector.next(
    (message) =>
      message.type === "ui" && message.component === "transfer_success",
  );
  assert.equal(receipt.props.amount, 1500);
  assert.equal(receipt.props.to_user_id, "u2");
  assert.equal(typeof receipt.interaction_id, "string");

  const senderOverview = await sender.collector.next(
    (message) => message.type === "overview_update",
  );
  const recipientOverview = await recipient.collector.next(
    (message) => message.type === "overview_update",
  );
  assert.equal(senderOverview.overview.available_balance, 23000);
  assert.equal(recipientOverview.overview.available_balance, 9800);

  const notification = await recipient.collector.next(
    (message) => message.type === "notification",
  );
  assert.equal(notification.title, "Transferencia recibida");
  assert.match(notification.body, /Mauricio Rey/);
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
