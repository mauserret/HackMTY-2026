// db.js
// Maneja una sola conexión reutilizable al cluster de MongoDB Atlas.

require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "hackmty_clients";

if (!uri) {
  throw new Error(
    "Falta MONGODB_URI en tu archivo .env (copia .env.example y llénalo)."
  );
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db = null;

/**
 * Conecta al cluster una sola vez y reutiliza la conexión en toda la app.
 * Llama a esto al arrancar tu servidor (antes de aceptar requests/WebSocket).
 */
async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  console.log(`Conectado a MongoDB Atlas — base "${dbName}"`);
  return db;
}

function getDB() {
  if (!db) {
    throw new Error("La base de datos no está conectada. Llama a connectDB() primero.");
  }
  return db;
}

async function closeDB() {
  await client.close();
  db = null;
}

module.exports = { connectDB, getDB, closeDB };
