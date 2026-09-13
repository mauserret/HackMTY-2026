"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { MongoClient, ServerApiVersion } = require("mongodb");
const { buildDemoData } = require("./demoData");

const DEFAULT_DB_NAME = "hackmty_db";

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(
    String(value).trim().toLowerCase(),
  );
}

function classifyMongoError(error) {
  const message = String(error?.message || "");
  const causeCode = error?.cause?.code || error?.code;

  if (
    causeCode === "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR" ||
    /tlsv1 alert internal error|ssl alert number 80/i.test(message)
  ) {
    return {
      code: "ATLAS_TLS_HANDSHAKE_REJECTED",
      message:
        "Atlas rechazó la conexión TLS. Verifica que el clúster esté activo y que Network Access permita la IP pública actual.",
    };
  }
  if (
    error?.name === "MongoParseError" ||
    /invalid scheme|invalid connection string|must begin with/i.test(message)
  ) {
    return {
      code: "MONGODB_URI_INVALID",
      message: "MONGODB_URI no tiene un formato válido.",
    };
  }
  if (
    causeCode === "ENOTFOUND" ||
    causeCode === "ECONNREFUSED" ||
    /querySrv|ENOTFOUND|ECONNREFUSED/i.test(message)
  ) {
    return {
      code: "MONGODB_DNS_UNAVAILABLE",
      message:
        "No fue posible resolver o alcanzar el clúster de MongoDB.",
    };
  }
  if (
    error?.code === 8000 ||
    error?.codeName === "AtlasError" ||
    /authentication failed|bad auth/i.test(message)
  ) {
    return {
      code: "MONGODB_AUTH_FAILED",
      message: "MongoDB rechazó las credenciales configuradas.",
    };
  }
  if (
    error?.name === "MongoServerSelectionError" ||
    /server selection timed out/i.test(message)
  ) {
    return {
      code: "MONGODB_SERVER_UNAVAILABLE",
      message:
        "MongoDB no encontró un nodo disponible. Revisa Network Access, el estado del clúster y la red.",
    };
  }
  return {
    code: "MONGODB_CONNECTION_FAILED",
    message: "No fue posible establecer la conexión con MongoDB.",
  };
}

async function createOrReplaceIndex(collection, key, options) {
  try {
    return await collection.createIndex(key, options);
  } catch (error) {
    const conflict =
      error?.code === 85 ||
      error?.code === 86 ||
      ["IndexOptionsConflict", "IndexKeySpecsConflict"].includes(
        error?.codeName,
      );
    if (!conflict) throw error;

    const indexes = await collection.indexes();
    const keySignature = JSON.stringify(key);
    const existing = indexes.find(
      (index) =>
        index.name === options.name ||
        JSON.stringify(index.key) === keySignature,
    );
    if (!existing || existing.name === "_id_") throw error;
    await collection.dropIndex(existing.name);
    return collection.createIndex(key, options);
  }
}

class MemoryStorage {
  constructor({ fallbackReason = null } = {}) {
    this.kind = "memory";
    this.fallbackReason = fallbackReason;
    this.data = buildDemoData();
    this.lock = Promise.resolve();
  }

  async withLock(operation) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async replaceWithDemoData() {
    return this.withLock(async () => {
      this.data = buildDemoData();
      return this.data;
    });
  }

  async close() {}
}

class MongoStorage {
  constructor(uri, dbName, logger) {
    this.kind = "mongodb";
    this.logger = logger;
    this.client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: Number(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000,
      ),
      connectTimeoutMS: Number(
        process.env.MONGODB_CONNECT_TIMEOUT_MS || 10000,
      ),
    });
    this.dbName = dbName;
    this.db = null;
    this.lock = Promise.resolve();
  }

  async connect({ ensureIndexes = true } = {}) {
    await this.client.connect();
    await this.client.db("admin").command({ ping: 1 });
    this.db = this.client.db(this.dbName);
    if (ensureIndexes) await this.ensureIndexes();
    this.logger(`MongoDB conectado: ${this.dbName}`);
    return this;
  }

  async withLock(operation) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async ensureIndexes() {
    await Promise.all([
      createOrReplaceIndex(
        this.db.collection("users"),
        { username_key: 1 },
        {
          name: "username_key_1",
          unique: true,
          partialFilterExpression: { username_key: { $type: "string" } },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("users"),
        { "accounts.account_id": 1 },
        {
          name: "accounts.account_id_1",
          unique: true,
          partialFilterExpression: {
            "accounts.account_id": { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("users"),
        { "accounts.clabe": 1 },
        {
          name: "accounts.clabe_1",
          unique: true,
          partialFilterExpression: {
            "accounts.clabe": { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("users"),
        { "accounts.account_number": 1 },
        {
          name: "accounts.account_number_1",
          unique: true,
          partialFilterExpression: {
            "accounts.account_number": { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("contacts"),
        { owner_id: 1, name_key: 1 },
        {
          name: "owner_id_1_name_key_1",
          unique: true,
          partialFilterExpression: {
            owner_id: { $type: "string" },
            name_key: { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("contacts"),
        { owner_id: 1, alias_key: 1 },
        {
          name: "owner_id_1_alias_key_1",
          unique: true,
          partialFilterExpression: {
            owner_id: { $type: "string" },
            alias_key: { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("contacts"),
        { owner_id: 1, contact_user_id: 1 },
        {
          name: "owner_id_1_contact_user_id_1",
          unique: true,
          partialFilterExpression: {
            owner_id: { $type: "string" },
            contact_user_id: { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("contacts"),
        { owner_id: 1, clabe: 1 },
        {
          name: "owner_id_1_clabe_1",
          unique: true,
          partialFilterExpression: {
            owner_id: { $type: "string" },
            clabe: { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("contacts"),
        { owner_id: 1, account_number: 1 },
        {
          name: "owner_id_1_account_number_1",
          unique: true,
          partialFilterExpression: {
            owner_id: { $type: "string" },
            account_number: { $type: "string" },
          },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("credit_plans"),
        { account_id: 1 },
        {
          name: "account_id_1",
          unique: true,
          partialFilterExpression: { account_id: { $type: "string" } },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("transactions"),
        { request_id: 1 },
        {
          name: "request_id_1",
          unique: true,
          partialFilterExpression: { request_id: { $type: "string" } },
        },
      ),
      createOrReplaceIndex(
        this.db.collection("transactions"),
        { from_user_id: 1, created_at: -1 },
        { name: "from_user_id_1_created_at_-1" },
      ),
      createOrReplaceIndex(
        this.db.collection("transactions"),
        { to_user_id: 1, created_at: -1 },
        { name: "to_user_id_1_created_at_-1" },
      ),
      createOrReplaceIndex(
        this.db.collection("interactions"),
        { user_id: 1, created_at: -1 },
        { name: "user_id_1_created_at_-1" },
      ),
    ]);
  }

  async replaceWithDemoData() {
    const data = buildDemoData();
    await Promise.all([
      this.db.collection("users").deleteMany({}),
      this.db.collection("contacts").deleteMany({}),
      this.db.collection("transactions").deleteMany({}),
      this.db.collection("credit_plans").deleteMany({}),
      this.db.collection("interactions").deleteMany({}),
    ]);
    await this.db.collection("users").insertMany(data.users);
    await this.db.collection("contacts").insertMany(data.contacts);
    await this.db.collection("credit_plans").insertMany(data.creditPlans);
    if (data.transactions.length) {
      await this.db.collection("transactions").insertMany(data.transactions);
    }
    await this.ensureIndexes();
    return data;
  }

  async close() {
    await this.client.close();
    this.db = null;
  }
}

let storage = null;

async function createStorage({
  uri = process.env.MONGODB_URI,
  dbName = process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME,
  logger = (message) => console.error(message),
  ensureIndexes = true,
  fallbackToMemory = readBoolean(
    process.env.MONGODB_FALLBACK_TO_MEMORY,
    true,
  ),
  required = readBoolean(process.env.MONGODB_REQUIRED, false),
} = {}) {
  const normalizedUri = typeof uri === "string" ? uri.trim() : uri;
  if (!normalizedUri) {
    logger("MONGODB_URI ausente; usando almacenamiento efímero en memoria");
    return new MemoryStorage({ fallbackReason: "MONGODB_URI_MISSING" });
  }

  let mongoStorage;
  try {
    mongoStorage = new MongoStorage(normalizedUri, dbName, logger);
    return await mongoStorage.connect({ ensureIndexes });
  } catch (error) {
    await mongoStorage?.close().catch(() => {});
    const diagnosis = classifyMongoError(error);
    logger(`MongoDB no disponible [${diagnosis.code}]: ${diagnosis.message}`);
    if (required || !fallbackToMemory) throw error;
    logger("El servidor continuará con almacenamiento efímero en memoria");
    return new MemoryStorage({ fallbackReason: diagnosis.code });
  }
}

async function connectDB(options) {
  if (!storage) {
    storage = await createStorage(options);
  }
  return storage;
}

function getStorage() {
  if (!storage) {
    throw new Error("El almacenamiento no está inicializado");
  }
  return storage;
}

async function closeDB() {
  if (storage) {
    await storage.close();
    storage = null;
  }
}

module.exports = {
  DEFAULT_DB_NAME,
  MemoryStorage,
  MongoStorage,
  classifyMongoError,
  closeDB,
  connectDB,
  createStorage,
  getStorage,
  readBoolean,
};
