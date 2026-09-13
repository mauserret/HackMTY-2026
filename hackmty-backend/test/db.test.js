"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAdminDocument, verifyPassword } = require("../adminCredentials");
const {
  classifyMongoError,
  createStorage,
} = require("../db");

test("clasifica el rechazo TLS de Atlas sin filtrar la URI", () => {
  const diagnosis = classifyMongoError(
    new Error(
      "SSL routines:ssl3_read_bytes:tlsv1 alert internal error: SSL alert number 80",
    ),
  );
  assert.equal(diagnosis.code, "ATLAS_TLS_HANDSHAKE_REJECTED");
  assert.match(diagnosis.message, /Network Access/);
});

test("usa memoria si Mongo está mal configurado y el fallback está habilitado", async () => {
  const logs = [];
  const storage = await createStorage({
    uri: "protocolo-invalido://localhost",
    fallbackToMemory: true,
    required: false,
    logger: (message) => logs.push(message),
  });

  assert.equal(storage.kind, "memory");
  assert.equal(storage.fallbackReason, "MONGODB_URI_INVALID");
  assert.equal(logs.some((line) => line.includes("MONGODB_URI_INVALID")), true);
  await storage.close();
});

test("mantiene fallo estricto cuando Mongo es obligatorio", async () => {
  await assert.rejects(
    createStorage({
      uri: "protocolo-invalido://localhost",
      fallbackToMemory: true,
      required: true,
      logger: () => {},
    }),
  );
});

test("actualiza el administrador sin duplicarlo", async () => {
  const storage = await createStorage({ uri: "", logger: () => {} });
  assert.equal(storage.data.admins.length, 1);
  await storage.upsertAdmin(
    createAdminDocument({ username: "admin", password: "nueva" }),
  );
  assert.equal(storage.data.admins.length, 1);
  assert.equal(verifyPassword("nueva", storage.data.admins[0]), true);
  await storage.close();
});
