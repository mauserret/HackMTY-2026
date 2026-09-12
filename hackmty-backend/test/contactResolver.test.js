"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalContact,
  resolveContact,
} = require("../contactResolver");

const contacts = [
  {
    _id: "contact-u2-u1",
    alias: "Mau",
    nickname: "Mau",
    first_name: "Mauricio",
    display_name: "Mauricio Hernández",
    account_number: "072180000001245678",
    account_id: "acc_u1_checking",
    bank: "Banorte",
  },
  {
    _id: "contact-u2-u4",
    alias: "Brau",
    display_name: "Braulio Garcia",
    account_number: "072180000004125000",
    bank: "Banorte",
  },
];

test("normaliza un contacto al contrato canónico", () => {
  assert.deepEqual(canonicalContact(contacts[0]), {
    id: "contact-u2-u1",
    alias: "Mau",
    nickname: "Mau",
    firstName: "Mauricio",
    fullName: "Mauricio Hernández",
    accountNumber: "072180000001245678",
    accountId: "acc_u1_checking",
    bank: "Banorte",
    userId: null,
  });
});

test("resuelve alias, primer nombre, typo y número de cuenta", () => {
  assert.equal(resolveContact("Mau", contacts).contact.id, "contact-u2-u1");
  assert.equal(
    resolveContact("Mauricio", contacts).contact.accountNumber,
    "072180000001245678",
  );
  assert.equal(
    resolveContact("Maurcio", contacts).contact.fullName,
    "Mauricio Hernández",
  );
  assert.equal(
    resolveContact("072180000004125000", contacts).contact.alias,
    "Brau",
  );
});
