"use strict";

const { createAdminDocument } = require("./adminCredentials");

const DEMO_USERS = Object.freeze([
  Object.freeze({ id: "u1", name: "Mauricio Hernández", username: "Mau" }),
  Object.freeze({ id: "u2", name: "Timoteo Aguilar", username: "Timo" }),
  Object.freeze({ id: "u3", name: "Esteban Esquivel", username: "Esteban" }),
  Object.freeze({ id: "u4", name: "Braulio Garcia", username: "Brau" }),
]);

const ACCOUNT_FIXTURES = Object.freeze({
  u1: Object.freeze([
    Object.freeze({
      account_id: "acc_u1_checking",
      name: "Cuenta principal",
      clabe: "072180000001245678",
      bank: "Banorte",
      type: "checking",
      balance: 24500,
      currency: "MXN",
    }),
    Object.freeze({
      account_id: "acc_u1_credit",
      name: "Tarjeta Banorte",
      clabe: "4915660000001840",
      bank: "Banorte",
      type: "credit_card",
      balance_owed: 18400,
      credit_limit: 30000,
      currency: "MXN",
    }),
  ]),
  u2: Object.freeze([
    Object.freeze({
      account_id: "acc_u2_checking",
      name: "Cuenta principal",
      clabe: "072180000002083000",
      bank: "Banorte",
      type: "checking",
      balance: 8300,
      currency: "MXN",
    }),
  ]),
  u3: Object.freeze([
    Object.freeze({
      account_id: "acc_u3_checking",
      name: "Cuenta principal",
      clabe: "072180000003520000",
      bank: "Banorte",
      type: "checking",
      balance: 52000,
      currency: "MXN",
    }),
  ]),
  u4: Object.freeze([
    Object.freeze({
      account_id: "acc_u4_checking",
      name: "Cuenta principal",
      clabe: "072180000004125000",
      bank: "Banorte",
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
      .map((contact) => {
        const checking = contact.accounts.find(
          (account) => account.type === "checking",
        );
        return {
          _id: `contact_${owner._id}_${contact._id}`,
          owner_id: owner._id,
          contact_user_id: contact._id,
          name: contact.username,
          name_key: aliasKey(contact.username),
          clabe: checking.clabe,
          account_id: checking.account_id,
          bank: checking.bank,
          created_at: new Date(),
        };
      }),
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

  const checkingAccount = (userId) =>
    users
      .find((user) => user._id === userId)
      .accounts.find((account) => account.type === "checking");
  const historicalTransfer = ({
    id,
    from,
    to,
    amount,
    concept,
    daysAgo,
  }) => {
    const recipient = users.find((user) => user._id === to);
    const recipientAccount = checkingAccount(to);
    return {
      _id: id,
      request_id: `seed_request_${id}`,
      from_user_id: from,
      to_user_id: to,
      contact_id: `contact_${from}_${to}`,
      to_alias: recipient.username,
      to_alias_key: aliasKey(recipient.username),
      registered_name: recipient.username,
      from_account: checkingAccount(from).account_id,
      to_account: recipientAccount.account_id,
      clabe: recipientAccount.clabe,
      bank: recipientAccount.bank,
      recipient_name: recipient.username,
      amount,
      concept,
      currency: "MXN",
      status: "completed",
      type: "transfer",
      created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      generated_by_agent: false,
    };
  };
  const transactions = [
    historicalTransfer({
      id: "tx_seed_u1_u2_dinner",
      from: "u1",
      to: "u2",
      amount: 850,
      concept: "Cena",
      daysAgo: 2,
    }),
    historicalTransfer({
      id: "tx_seed_u2_u1_tickets",
      from: "u2",
      to: "u1",
      amount: 450,
      concept: "Boletos",
      daysAgo: 3,
    }),
    historicalTransfer({
      id: "tx_seed_u4_u1_food",
      from: "u4",
      to: "u1",
      amount: 200,
      concept: "Comida",
      daysAgo: 5,
    }),
    historicalTransfer({
      id: "tx_seed_u1_u3_rent",
      from: "u1",
      to: "u3",
      amount: 1200,
      concept: "Renta",
      daysAgo: 7,
    }),
    historicalTransfer({
      id: "tx_seed_u1_u4_transport",
      from: "u1",
      to: "u4",
      amount: 300,
      concept: "Transporte",
      daysAgo: 12,
    }),
    historicalTransfer({
      id: "tx_seed_u3_u1_project",
      from: "u3",
      to: "u1",
      amount: 2500,
      concept: "Proyecto",
      daysAgo: 20,
    }),
  ];

  return {
    users,
    admins: [createAdminDocument()],
    contacts,
    creditPlans,
    transactions,
    interactions: [],
  };
}

function getPublicDemoUsers() {
  return DEMO_USERS.map(({ id, name, username }) => ({ id, name, username }));
}

module.exports = {
  ACCOUNT_FIXTURES,
  DEMO_USERS,
  aliasKey,
  buildDemoData,
  getPublicDemoUsers,
};
