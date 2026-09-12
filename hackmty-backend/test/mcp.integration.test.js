"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { clearMemory, localFallback } = require("../llm");
const { EXPECTED_TOOLS, McpGateway } = require("../mcpClient");

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

test("el subproceso MCP publica exactamente seis tools", async (t) => {
  const mcp = await memoryGateway(t);
  const names = (await mcp.listTools()).map((tool) => tool.name).sort();
  assert.deepEqual(names, [...EXPECTED_TOOLS].sort());
  assert.equal(mcp.getHealth().storage, "memory");
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
    requestId,
  });
  const replay = await mcp.callTool("createTransaction", {
    fromUserId: "u1",
    toAlias: "Timo",
    amount: 500.25,
    requestId,
  });
  const after = await mcp.callTool("getBalance", { userId: "u1" });

  assert.equal(first.transaction_id, replay.transaction_id);
  assert.equal(replay.idempotent_replay, true);
  assert.equal(
    after.accounts.find((account) => account.type === "checking").balance,
    before.accounts.find((account) => account.type === "checking").balance - 500.25,
  );

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
    "Mándale mil quinientos pesos a Timoteo, por favor",
    mcp,
  );
  const after = await mcp.callTool("getBalance", { userId: "u1" });

  assert.equal(ui.component, "transfer_form");
  assert.equal(ui.props.to_alias, "Timo");
  assert.equal(ui.props.amount, 1500);
  assert.deepEqual(after.accounts, before.accounts);
});
