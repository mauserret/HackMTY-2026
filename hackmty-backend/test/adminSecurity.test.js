"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAdminDocument,
  hashPassword,
  normalizeAdminUsername,
  verifyPassword,
} = require("../adminCredentials");
const {
  COOKIE_NAME,
  createAdminSessionManager,
  parseCookies,
  serializeCookie,
} = require("../adminSession");
const {
  createLoginLimiter,
  originAllowed,
} = require("../adminRoutes");

test("protege la contraseña administrativa con scrypt", () => {
  const credential = hashPassword(
    "1",
    "00112233445566778899aabbccddeeff",
  );
  assert.equal(credential.password_algorithm, "scrypt");
  assert.notEqual(credential.password_hash, "1");
  assert.equal(verifyPassword("1", credential), true);
  assert.equal(verifyPassword("2", credential), false);
  assert.equal(normalizeAdminUsername("  ÁDMIN  "), "admin");

  const admin = createAdminDocument({
    username: "admin",
    password: "1",
    now: new Date("2026-09-12T12:00:00.000Z"),
  });
  assert.equal(admin._id, "admin_admin");
  assert.equal(admin.role, "admin");
  assert.equal(Object.hasOwn(admin, "password"), false);
});

test("firma y expira sesiones administrativas HttpOnly", () => {
  let now = Date.parse("2026-09-12T12:00:00.000Z");
  const sessions = createAdminSessionManager({
    secret: "secreto-de-prueba-con-suficiente-entropia",
    ttlMs: 60_000,
    now: () => now,
  });
  const token = sessions.issue({ id: "admin_admin", username: "admin" });
  assert.equal(sessions.verify(token).username, "admin");
  assert.equal(sessions.verify(`${token}alterado`), null);
  const cookie = serializeCookie(token, { maxAgeMs: sessions.ttlMs });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(parseCookies(cookie)[COOKIE_NAME], token);
  now += 60_001;
  assert.equal(sessions.verify(token), null);
});

test("limita intentos y permite solo orígenes locales o configurados", () => {
  let now = 1000;
  const limiter = createLoginLimiter({
    limit: 2,
    windowMs: 5000,
    now: () => now,
  });
  const request = { ip: "127.0.0.1" };
  limiter.fail(request);
  limiter.fail(request);
  assert.equal(limiter.retryAfter(request), 5);
  now += 5001;
  assert.equal(limiter.retryAfter(request), null);

  assert.equal(
    originAllowed(
      "http://192.168.1.20:5173",
      { hostname: "192.168.1.20" },
      new Set(),
    ),
    true,
  );
  assert.equal(
    originAllowed(
      "https://example.com",
      { hostname: "localhost" },
      new Set(),
    ),
    false,
  );
  assert.equal(
    originAllowed(
      "https://admin.example.test",
      { hostname: "localhost" },
      new Set(["https://admin.example.test"]),
    ),
    true,
  );
});
