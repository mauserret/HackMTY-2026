"use strict";

const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

function normalizeAdminUsername(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const candidate = String(password || "");
  if (!candidate) throw new TypeError("La contraseña no puede estar vacía");
  return {
    password_algorithm: "scrypt",
    password_salt: salt,
    password_hash: scryptSync(
      candidate,
      salt,
      KEY_LENGTH,
      SCRYPT_OPTIONS,
    ).toString("hex"),
  };
}

function verifyPassword(candidate, credential) {
  if (
    credential?.password_algorithm !== "scrypt" ||
    typeof credential.password_salt !== "string" ||
    typeof credential.password_hash !== "string"
  ) {
    return false;
  }
  try {
    const actual = scryptSync(
      String(candidate || ""),
      credential.password_salt,
      KEY_LENGTH,
      SCRYPT_OPTIONS,
    );
    const expected = Buffer.from(credential.password_hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function createAdminDocument({
  username = "admin",
  password = "1",
  now = new Date(),
} = {}) {
  const displayUsername = String(username || "").trim();
  const usernameKey = normalizeAdminUsername(displayUsername);
  if (!usernameKey) throw new TypeError("El usuario administrador es obligatorio");
  return {
    _id: `admin_${usernameKey.replace(/[^a-z0-9_-]/g, "_")}`,
    username: displayUsername,
    username_key: usernameKey,
    role: "admin",
    active: true,
    ...hashPassword(password),
    created_at: new Date(now),
    updated_at: new Date(now),
  };
}

module.exports = {
  createAdminDocument,
  hashPassword,
  normalizeAdminUsername,
  verifyPassword,
};
