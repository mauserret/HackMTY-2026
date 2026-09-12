"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { MongoClient, ServerApiVersion } = require("mongodb");
const { buildDemoData } = require("./demoData");

const DEFAULT_DB_NAME = "hackmty_db";

class MemoryStorage {
  constructor() {
    this.kind = "memory";
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
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    });
    this.dbName = dbName;
    this.db = null;
    this.lock = Promise.resolve();
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    await this.ensureIndexes();
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
      this.db.collection("users").createIndex({ username_key: 1 }, { unique: true }),
      this.db.collection("users").createIndex({ "accounts.account_id": 1 }, { unique: true }),
      this.db
        .collection("contacts")
        .createIndex({ owner_id: 1, alias_key: 1 }, { unique: true }),
      this.db
        .collection("contacts")
        .createIndex({ owner_id: 1, contact_user_id: 1 }, { unique: true }),
      this.db.collection("credit_plans").createIndex({ account_id: 1 }, { unique: true }),
      this.db.collection("transactions").createIndex(
        { request_id: 1 },
        {
          unique: true,
          partialFilterExpression: { request_id: { $type: "string" } },
        },
      ),
      this.db.collection("transactions").createIndex({ from_user_id: 1, created_at: -1 }),
      this.db.collection("interactions").createIndex({ user_id: 1, created_at: -1 }),
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
} = {}) {
  const normalizedUri = typeof uri === "string" ? uri.trim() : uri;
  if (!normalizedUri) {
    logger("MONGODB_URI ausente; usando almacenamiento efímero en memoria");
    return new MemoryStorage();
  }

  const mongoStorage = new MongoStorage(normalizedUri, dbName, logger);
  return mongoStorage.connect();
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
  closeDB,
  connectDB,
  createStorage,
  getStorage,
};
