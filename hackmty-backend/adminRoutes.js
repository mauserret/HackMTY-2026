"use strict";

const express = require("express");
const { z } = require("zod");
const {
  COOKIE_NAME,
  clearCookie,
  createAdminSessionManager,
  parseCookies,
  serializeCookie,
} = require("./adminSession");

const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
  })
  .strict();

function optionalInteger(min, max) {
  return z.preprocess(
    (value) => value === undefined || value === "" ? undefined : Number(value),
    z.number().int().min(min).max(max).optional(),
  );
}

const pageQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    page: optionalInteger(1, 1_000_000),
    page_size: optionalInteger(1, 100),
  })
  .strict();

const interactionQuerySchema = pageQuerySchema
  .extend({
    user_id: z
      .string()
      .trim()
      .regex(/^(?:u[1-9]\d{0,8}|[a-fA-F0-9]{24})$/)
      .optional(),
    component: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]*$/)
      .optional(),
    rating: optionalInteger(1, 10),
    rating_status: z.enum(["all", "rated", "unrated"]).optional(),
  })
  .strict();

const detailParamsSchema = z
  .object({
    interactionId: z
      .string()
      .trim()
      .regex(/^(?:[a-fA-F0-9]{24}|i_[A-Za-z0-9-]+)$/),
  })
  .strict();

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(
    String(value).trim().toLowerCase(),
  );
}

function configuredOrigins(value = process.env.ADMIN_ALLOWED_ORIGINS) {
  return new Set(
    String(value || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

function isLoopback(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    String(hostname || "").toLowerCase(),
  );
}

function originAllowed(origin, request, allowlist) {
  if (!origin) return true;
  const normalized = String(origin).replace(/\/$/, "");
  if (allowlist.has(normalized)) return true;
  try {
    const originUrl = new URL(normalized);
    const requestHost = String(request.hostname || "").toLowerCase();
    const originHost = originUrl.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(originUrl.protocol) &&
      (originHost === requestHost ||
        (isLoopback(originHost) && isLoopback(requestHost)))
    );
  } catch {
    return false;
  }
}

function createLoginLimiter({
  limit = 5,
  windowMs = 10 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const attempts = new Map();
  const keyFor = (request) =>
    request.ip || request.socket?.remoteAddress || "unknown";
  const active = (request) => {
    const key = keyFor(request);
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now()) {
      attempts.delete(key);
      return null;
    }
    return { key, entry };
  };
  return {
    retryAfter(request) {
      const value = active(request);
      return value?.entry.count >= limit
        ? Math.max(1, Math.ceil((value.entry.resetAt - now()) / 1000))
        : null;
    },
    fail(request) {
      const value = active(request);
      if (value) {
        value.entry.count += 1;
      } else {
        attempts.set(keyFor(request), {
          count: 1,
          resetAt: now() + windowMs,
        });
      }
    },
    reset(request) {
      attempts.delete(keyFor(request));
    },
  };
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function sendError(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

function adminInteractionArgs(query, { forceRated = false } = {}) {
  return {
    userId: query.user_id,
    search: query.search,
    component: query.component,
    rating: query.rating,
    ratingStatus: forceRated ? "rated" : query.rating_status,
    page: query.page,
    pageSize: query.page_size,
  };
}

function createAdminRouter({
  mcp,
  sessions = createAdminSessionManager(),
  allowlist = configuredOrigins(),
  limiter = createLoginLimiter(),
  secureCookie = readBoolean(process.env.ADMIN_COOKIE_SECURE, false),
} = {}) {
  if (!mcp) throw new TypeError("El router administrativo requiere MCP");
  const router = express.Router();

  router.use((request, response, next) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    const origin = request.get("origin");
    if (!originAllowed(origin, request, allowlist)) {
      return sendError(
        response,
        403,
        "ADMIN_ORIGIN_FORBIDDEN",
        "El origen no está autorizado",
      );
    }
    if (origin) {
      response.set("Access-Control-Allow-Origin", origin);
      response.set("Access-Control-Allow-Credentials", "true");
      response.vary("Origin");
    }
    if (request.method === "OPTIONS") {
      response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.set("Access-Control-Allow-Headers", "Content-Type");
      return response.sendStatus(204);
    }
    return next();
  });

  router.post(
    "/login",
    asyncRoute(async (request, response) => {
      const retryAfter = limiter.retryAfter(request);
      if (retryAfter) {
        response.set("Retry-After", String(retryAfter));
        return sendError(
          response,
          429,
          "ADMIN_LOGIN_RATE_LIMITED",
          "Demasiados intentos; inténtalo más tarde",
        );
      }
      const credentials = loginSchema.parse(request.body);
      try {
        const result = await mcp.callTool("authenticateAdmin", credentials);
        limiter.reset(request);
        response.set(
          "Set-Cookie",
          serializeCookie(sessions.issue(result.admin), {
            maxAgeMs: sessions.ttlMs,
            secure: secureCookie,
          }),
        );
        return response.status(200).json({ admin: result.admin });
      } catch (error) {
        if (error?.code === "ADMIN_INVALID_CREDENTIALS") {
          limiter.fail(request);
        }
        throw error;
      }
    }),
  );

  router.post("/logout", (_request, response) => {
    response.set("Set-Cookie", clearCookie({ secure: secureCookie }));
    response.status(204).end();
  });

  router.use((request, response, next) => {
    const admin = sessions.verify(
      parseCookies(request.get("cookie"))[COOKIE_NAME],
    );
    if (!admin) {
      return sendError(
        response,
        401,
        "ADMIN_AUTH_REQUIRED",
        "Inicia sesión como administrador",
      );
    }
    request.admin = admin;
    return next();
  });

  router.get("/session", (request, response) => {
    response.status(200).json({ admin: request.admin });
  });

  router.get(
    "/overview",
    asyncRoute(async (_request, response) => {
      response.status(200).json(await mcp.callTool("getAdminOverview", {}));
    }),
  );

  router.get(
    "/users",
    asyncRoute(async (request, response) => {
      const query = pageQuerySchema.parse(request.query);
      response.status(200).json(
        await mcp.callTool("listAdminUsers", {
          search: query.search,
          page: query.page,
          pageSize: query.page_size,
        }),
      );
    }),
  );

  router.get(
    "/interactions",
    asyncRoute(async (request, response) => {
      const query = interactionQuerySchema.parse(request.query);
      response.status(200).json(
        await mcp.callTool(
          "listAdminInteractions",
          adminInteractionArgs(query),
        ),
      );
    }),
  );

  router.get(
    "/ratings",
    asyncRoute(async (request, response) => {
      const query = interactionQuerySchema.parse(request.query);
      const [overview, ratings] = await Promise.all([
        mcp.callTool("getAdminOverview", {}),
        mcp.callTool(
          "listAdminInteractions",
          adminInteractionArgs(query, { forceRated: query.rating === undefined }),
        ),
      ]);
      response.status(200).json({
        average_rating: overview.totals.average_rating,
        rated: overview.totals.rated,
        unrated: overview.totals.unrated,
        distribution: overview.rating_distribution,
        ...ratings,
      });
    }),
  );

  router.get(
    "/interactions/:interactionId",
    asyncRoute(async (request, response) => {
      const params = detailParamsSchema.parse(request.params);
      response.status(200).json(
        await mcp.callTool("getAdminInteraction", params),
      );
    }),
  );

  router.use((error, _request, response, _next) => {
    if (error instanceof z.ZodError) {
      return sendError(
        response,
        400,
        "INVALID_ADMIN_REQUEST",
        error.issues.map((issue) => issue.message).join("; "),
      );
    }
    if (error?.code === "ADMIN_INVALID_CREDENTIALS") {
      return sendError(
        response,
        401,
        error.code,
        "El usuario o la contraseña son incorrectos",
      );
    }
    if (error?.code === "INTERACTION_NOT_FOUND") {
      return sendError(
        response,
        404,
        error.code,
        "No se encontró la interacción",
      );
    }
    if (String(error?.code || "").startsWith("MCP_")) {
      return sendError(
        response,
        503,
        "ADMIN_DATA_UNAVAILABLE",
        "Los datos administrativos no están disponibles",
      );
    }
    return sendError(
      response,
      500,
      "ADMIN_INTERNAL_ERROR",
      "No fue posible completar la solicitud",
    );
  });

  return router;
}

module.exports = {
  createAdminRouter,
  createLoginLimiter,
  originAllowed,
};
