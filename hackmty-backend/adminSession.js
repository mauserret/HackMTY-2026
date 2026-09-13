"use strict";

const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "hackmty_admin_session";
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

function parseCookies(header) {
  const result = {};
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function readTtlMs(value = process.env.ADMIN_SESSION_TTL_MINUTES) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 10080) {
    return DEFAULT_TTL_MS;
  }
  return Math.round(minutes * 60 * 1000);
}

function createAdminSessionManager({
  secret = process.env.ADMIN_SESSION_SECRET,
  ttlMs = readTtlMs(),
  now = () => Date.now(),
} = {}) {
  const key = Buffer.from(
    String(secret || randomBytes(32).toString("base64url")),
    "utf8",
  );

  function sign(encoded) {
    return createHmac("sha256", key).update(encoded).digest("base64url");
  }

  function issue(admin) {
    const issuedAt = now();
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        sub: admin.id,
        username: admin.username,
        role: "admin",
        issued_at: issuedAt,
        expires_at: issuedAt + ttlMs,
      }),
    ).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function verify(token) {
    if (typeof token !== "string") return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      );
      if (
        parsed.version !== 1 ||
        parsed.role !== "admin" ||
        typeof parsed.sub !== "string" ||
        typeof parsed.username !== "string" ||
        !Number.isFinite(parsed.expires_at) ||
        parsed.expires_at <= now()
      ) {
        return null;
      }
      return {
        id: parsed.sub,
        username: parsed.username,
        role: parsed.role,
        expires_at: new Date(parsed.expires_at).toISOString(),
      };
    } catch {
      return null;
    }
  }

  return { issue, ttlMs, verify };
}

function serializeCookie(token, { maxAgeMs, secure = false } = {}) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/admin",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor((maxAgeMs ?? DEFAULT_TTL_MS) / 1000))}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(options = {}) {
  return serializeCookie("", { ...options, maxAgeMs: 0 });
}

module.exports = {
  COOKIE_NAME,
  clearCookie,
  createAdminSessionManager,
  parseCookies,
  readTtlMs,
  serializeCookie,
};
