"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractConcept,
  extractContact,
  extractRecipientName,
  normalizeText,
  parseAmount,
  parseLocalizedNumber,
  parseModelJson,
} = require("../llm");
const { parseEvent } = require("../server");

test("normaliza texto en español para comparar intenciones", () => {
  assert.equal(normalizeText("  ¡Transfiérele a MAU!  "), "transfierele a mau");
});

test("normaliza cantidades con separadores mexicanos e internacionales", () => {
  assert.equal(parseLocalizedNumber("1,500.50"), 1500.5);
  assert.equal(parseLocalizedNumber("1.500,50"), 1500.5);
  assert.equal(parseLocalizedNumber("1,500"), 1500);
  assert.equal(parseLocalizedNumber("250.75"), 250.75);
});

test("extrae cantidades numéricas y coloquiales", () => {
  assert.equal(parseAmount("Mándale $2,350.50 pesos a Timo"), 2350.5);
  assert.equal(parseAmount("Transfiere $10 a Timoteo"), 10);
  assert.equal(parseAmount("transfiere mil quinientos pesos a Braulio"), 1500);
  assert.equal(parseAmount("mi usuario es u1"), null);
  assert.equal(parseAmount("transfiere -$500"), null);
});

test("resuelve nombres y aliases a un contacto canónico", () => {
  const contacts = [
    { alias: "Timo", display_name: "Timoteo Aguilar" },
    { alias: "Brau", display_name: "Braulio Garcia" },
  ];
  assert.equal(extractContact("envía 500 a Timoteo", contacts).alias, "Timo");
  assert.equal(extractContact("depositar a Brau", contacts).display_name, "Braulio Garcia");
});

test("extrae persona y concepto de una solicitud de transferencia", () => {
  const prompt = "Quiero transferir $500 a Carlos por la cena";
  assert.equal(extractRecipientName(prompt), "Carlos");
  assert.equal(extractConcept(prompt), "Cena");
  assert.equal(
    extractConcept("Mándale $100 a Timo con concepto de transporte"),
    "Transporte",
  );
  assert.equal(
    extractConcept("Mándale $100 a Timo, por favor"),
    "",
  );
});

test("rechaza texto muerto y acepta JSON A2UI estricto", () => {
  assert.throws(() => parseModelJson('{"type":"text","text":"hola"}'));
  assert.deepEqual(
    parseModelJson(
      '```json\n{"type":"ui","component":"quick_actions","props":{"title":"Opciones"}}\n```',
    ),
    {
      type: "ui",
      component: "quick_actions",
      props: { title: "Opciones" },
    },
  );
});

test("el parser WebSocket descarta identidades forjadas", () => {
  const event = parseEvent(
    JSON.stringify({
      type: "user_message",
      text: "saldo",
      user_id: "u4",
      userId: "u4",
    }),
  );
  assert.deepEqual(event, { type: "user_message", text: "saldo" });
});
