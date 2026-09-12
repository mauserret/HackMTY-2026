"use strict";

const DEMO_USERS = Object.freeze([
  Object.freeze({ id: "u1", name: "Mauricio Rey", username: "Mau" }),
  Object.freeze({ id: "u2", name: "Timoteo Aguilar", username: "Timo" }),
  Object.freeze({ id: "u3", name: "Esteban Esquivel", username: "Esteban" }),
  Object.freeze({ id: "u4", name: "Braulio Garcia", username: "Brau" }),
]);

const ACCOUNT_FIXTURES = Object.freeze({
  u1: Object.freeze([
    Object.freeze({
      account_id: "acc_u1_checking",
      type: "checking",
      balance: 24500,
      currency: "MXN",
    }),
    Object.freeze({
      account_id: "acc_u1_credit",
      type: "credit_card",
      balance_owed: 18400,
      credit_limit: 30000,
      currency: "MXN",
    }),
  ]),
  u2: Object.freeze([
    Object.freeze({
      account_id: "acc_u2_checking",
      type: "checking",
      balance: 8300,
      currency: "MXN",
    }),
  ]),
  u3: Object.freeze([
    Object.freeze({
      account_id: "acc_u3_checking",
      type: "checking",
      balance: 52000,
      currency: "MXN",
    }),
  ]),
  u4: Object.freeze([
    Object.freeze({
      account_id: "acc_u4_checking",
      type: "checking",
      balance: 1250,
      currency: "MXN",
    }),
  ]),
});

function aliasKey(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function buildDemoData() {
  const users = DEMO_USERS.map((user) => ({
    _id: user.id,
    name: user.name,
    username: user.username,
    username_key: aliasKey(user.username),
    email: `${aliasKey(user.name).replace(/\s/g, ".")}@demo.banai.mx`,
    accounts: ACCOUNT_FIXTURES[user.id].map((account) => ({ ...account })),
  }));

  const contacts = users.flatMap((owner) =>
    users
      .filter((contact) => contact._id !== owner._id)
      .map((contact) => ({
        owner_id: owner._id,
        contact_user_id: contact._id,
        alias: contact.username,
        alias_key: aliasKey(contact.username),
        display_name: contact.name,
        account_id: contact.accounts.find((account) => account.type === "checking").account_id,
      })),
  );

  const creditPlans = [
    {
      _id: "credit_plan_u1",
      account_id: "acc_u1_credit",
      current_balance: 18400,
      currency: "MXN",
      options: [
        { months: 12, annual_interest_rate: 28.9, cat: 32.4, monthly_payment: 1690 },
        { months: 18, annual_interest_rate: 30.2, cat: 34.1, monthly_payment: 1215 },
        { months: 24, annual_interest_rate: 31.7, cat: 36, monthly_payment: 980 },
      ],
    },
  ];

  return {
    users,
    contacts,
    creditPlans,
    transactions: [],
    interactions: [],
  };
}

function getPublicDemoUsers() {
  return DEMO_USERS.map(({ id, name, username }) => ({ id, name, username }));
}

module.exports = {
  DEMO_USERS,
  aliasKey,
  buildDemoData,
  getPublicDemoUsers,
};
