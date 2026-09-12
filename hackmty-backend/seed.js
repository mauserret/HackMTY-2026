// seed.js
// Borra y vuelve a crear las colecciones de demo con 4 usuarios de prueba,
// sus contactos entre ellos, un plan de crédito de ejemplo y el historial vacío
// de transacciones.
//
// Uso: node seed.js

const { connectDB, closeDB } = require("./db");

async function seed() {
  const db = await connectDB();

  const users = db.collection("users");
  const contacts = db.collection("contacts");
  const transactions = db.collection("transactions");
  const creditPlans = db.collection("credit_plans");

  // Limpiar antes de recargar (útil si corres el seed varias veces durante el hackathon)
  await Promise.all([
    users.deleteMany({}),
    contacts.deleteMany({}),
    transactions.deleteMany({}),
    creditPlans.deleteMany({}),
  ]);

  const usersData = [
    {
      _id: "u1",
      name: "Mauricio Rey",
      email: "mauricio@demo.com",
      phone: "8111111111",
      accounts: [
        { account_id: "acc_u1_checking", type: "checking", balance: 24500.0, currency: "MXN" },
        {
          account_id: "acc_u1_credit",
          type: "credit_card",
          balance_owed: 18400.0,
          credit_limit: 30000.0,
        },
      ],
    },
    {
      _id: "u2",
      name: "Timoteo Aguilar",
      email: "timoteo@demo.com",
      phone: "8122222222",
      accounts: [
        { account_id: "acc_u2_checking", type: "checking", balance: 8300.0, currency: "MXN" },
      ],
    },
    {
      _id: "u3",
      name: "Esteban Esquivel",
      email: "esteban@demo.com",
      phone: "8133333333",
      accounts: [
        { account_id: "acc_u3_checking", type: "checking", balance: 52000.0, currency: "MXN" },
      ],
    },
    {
      _id: "u4",
      name: "Braulio Garcia",
      email: "braulio@demo.com",
      phone: "8144444444",
      accounts: [
        { account_id: "acc_u4_checking", type: "checking", balance: 1250.0, currency: "MXN" },
      ],
    },
  ];

  await users.insertMany(usersData);

  // Cada usuario tiene a los otros 3 como contactos de transferencia
  const contactsData = [];
  for (const owner of usersData) {
    for (const other of usersData) {
      if (owner._id === other._id) continue;
      contactsData.push({
        owner_id: owner._id,
        contact_user_id: other._id,
        alias: other.name.split(" ")[0], // ej. "Timoteo"
        account_id: other.accounts[0].account_id,
      });
    }
  }
  await contacts.insertMany(contactsData);

  // Plan de crédito de ejemplo para u1 (mismo caso que el mockup del PDF)
  await creditPlans.insertOne({
    _id: "p1",
    account_id: "acc_u1_credit",
    balance: 18400.0,
    options: [
      { months: 12, cat: 32.4, monthly_payment: 1690 },
      { months: 18, cat: 34.1, monthly_payment: 1215 },
      { months: 24, cat: 36.0, monthly_payment: 980 },
    ],
  });

  console.log(`Seed listo: ${usersData.length} usuarios, ${contactsData.length} contactos, 1 plan de crédito.`);
  await closeDB();
}

seed().catch((err) => {
  console.error("Error en el seed:", err);
  process.exit(1);
});
