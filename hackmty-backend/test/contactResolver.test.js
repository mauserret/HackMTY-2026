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
    name: "Mau",
    name_key: "mau",
    clabe: "072180000001245678",
    account_id: "acc_u1_checking",
    bank: "Banorte",
  },
  {
    _id: "contact-u2-u4",
    name: "Brau",
    name_key: "brau",
    clabe: "072180000004125000",
    bank: "Banorte",
  },
];

test("normaliza un contacto al contrato canónico", () => {
  assert.deepEqual(canonicalContact(contacts[0]), {
    id: "contact-u2-u1",
    name: "Mau",
    alias: "Mau",
    nickname: "Mau",
    firstName: "Mau",
    fullName: "Mau",
    clabe: "072180000001245678",
    accountNumber: "072180000001245678",
    accountId: "acc_u1_checking",
    bank: "Banorte",
    userId: null,
  });
});

test("resuelve alias, primer nombre, typo y número de cuenta", () => {
  assert.equal(resolveContact("Mau", contacts).contact.name, "Mau");
  assert.equal(
    resolveContact("072180000001245678", contacts).contact.clabe,
    "072180000001245678",
  );
  assert.equal(resolveContact("Mauu", contacts).contact.name, "Mau");
  assert.equal(
    resolveContact("072180000004125000", contacts).contact.name,
    "Brau",
  );
});
