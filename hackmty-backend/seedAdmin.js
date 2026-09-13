"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { createAdminDocument } = require("./adminCredentials");
const { closeDB, connectDB } = require("./db");

async function seedAdmin() {
  const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
  const storage = await connectDB({ required: hasMongoUri });
  const admin = createAdminDocument({
    username: process.env.ADMIN_SEED_USERNAME || "admin",
    password: process.env.ADMIN_SEED_PASSWORD || "1",
  });
  await storage.upsertAdmin(admin);
  const destination =
    storage.kind === "mongodb"
      ? `persistente en ${storage.dbName}`
      : "efímero; configura MONGODB_URI para conservarlo";
  console.log(
    `Administrador "${admin.username}" listo; storage=${storage.kind}, ${destination}.`,
  );
}

if (require.main === module) {
  seedAdmin()
    .catch((error) => {
      console.error("Error al sembrar el administrador:", error.message);
      process.exitCode = 1;
    })
    .finally(closeDB);
}

module.exports = { seedAdmin };
