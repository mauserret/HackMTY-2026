"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { closeDB, connectDB } = require("./db");

async function seed() {
  const storage = await connectDB();
  const data = await storage.replaceWithDemoData();
  const persistence =
    storage.kind === "memory"
      ? "efímero (npm start crea su propio seed en memoria)"
      : `persistente en ${storage.dbName}`;

  console.log(
    `Seed listo: ${data.users.length} usuarios, ${data.contacts.length} contactos, ` +
      `${data.creditPlans.length} plan de crédito; storage=${storage.kind}, ${persistence}.`,
  );
}

seed()
  .catch((error) => {
    console.error("Error en el seed:", error.message);
    process.exitCode = 1;
  })
  .finally(closeDB);
