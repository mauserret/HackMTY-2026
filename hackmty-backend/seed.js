"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { closeDB, connectDB } = require("./db");

async function seed() {
  const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
  const storage = await connectDB({
    ensureIndexes: false,
    required: hasMongoUri,
  });
  const data = await storage.replaceWithDemoData();
  const persistence =
    storage.kind === "memory"
      ? "efímero (npm start crea su propio seed en memoria)"
      : `persistente en ${storage.dbName}`;

  console.log(
    `Seed listo: ${data.users.length} usuarios, ${data.admins.length} administrador, ` +
      `${data.contacts.length} contactos, ` +
      `${data.transactions.length} transacciones y ${data.creditPlans.length} plan de crédito; ` +
      `storage=${storage.kind}, ${persistence}.`,
  );
}

seed()
  .catch((error) => {
    console.error("Error en el seed:", error.message);
    process.exitCode = 1;
  })
  .finally(closeDB);
