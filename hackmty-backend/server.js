"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });

const { createHash, randomUUID, timingSafeEqual } = require("node:crypto");
const http = require("node:http");
const express = require("express");
const { WebSocket, WebSocketServer } = require("ws");
const { z } = require("zod");
const { getPublicDemoUsers } = require("./demoData");
const { clearMemory, normalizeText, processMessage } = require("./llm");
const { McpGateway, McpGatewayError } = require("./mcpClient");

const DEFAULT_PORT = 4000;
const DEFAULT_MAX_WS_PAYLOAD = 256 * 1024;
const DEFAULT_HEARTBEAT_MS = 30000;
const PENDING_TRANSFER_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 1000;
const MAX_MESSAGES_PER_WINDOW = 40;

const eventSchemas = Object.freeze({
  auth_login: z.object({
    type: z.literal("auth_login"),
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
  }),
  auth_logout: z.object({ type: z.literal("auth_logout") }),
  user_message: z.object({
    type: z.literal("user_message"),
    text: z.string().trim().min(1).max(4000),
  }),
  confirm_transfer: z.object({
    type: z.literal("confirm_transfer"),
    request_id: z.string().trim().min(8).max(128),
    contact_id: z.string().trim().min(8).max(128).optional(),
    to_alias: z.string().trim().min(1).max(64).optional(),
    account_number: z.string().trim().min(5).max(40).optional(),
    bank: z.string().trim().min(2).max(80).optional(),
    amount: z.number().finite().positive().max(1_000_000).optional(),
    concept: z.string().trim().max(120).optional(),
  }),
  rate_interaction: z.object({
    type: z.literal("rate_interaction"),
    interaction_id: z.string().trim().min(8).max(128),
    rating: z.number().int().min(1).max(10),
  }),
});

class SocketEventError extends Error {
  constructor(code, message, recoverable = true) {
    super(message);
    this.name = "SocketEventError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

function safeSend(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function errorPayload(error) {
  if (error instanceof z.ZodError) {
    return {
      type: "error",
      code: "INVALID_PAYLOAD",
      message: error.issues.map((issue) => issue.message).join("; "),
      recoverable: true,
    };
  }
  if (
    error instanceof SocketEventError ||
    error instanceof McpGatewayError
  ) {
    return {
      type: "error",
      code: error.code,
      message: error.message,
      recoverable: error.recoverable !== false,
    };
  }
  return {
    type: "error",
    code: "INTERNAL_ERROR",
    message: "No fue posible completar la operación",
    recoverable: true,
  };
}

function passwordMatches(candidate) {
  const expected = process.env.DEMO_PASSWORD || "1234";
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function parseAllowedOrigins() {
  return new Set(
    String(process.env.WS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function buildOverview(balance) {
  const checking = balance.accounts.find((account) => account.type === "checking") || null;
  const credit = balance.accounts.find((account) => account.type === "credit_card") || null;
  return {
    user: balance.user,
    accounts: balance.accounts,
    available_balance: checking?.balance ?? 0,
    currency: checking?.currency || "MXN",
    credit_balance_owed: credit?.balance_owed ?? null,
    movements: balance.recent_transactions || [],
  };
}

function parseEvent(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SocketEventError("INVALID_JSON", "El mensaje no contiene JSON válido");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SocketEventError("INVALID_PAYLOAD", "El evento debe ser un objeto JSON");
  }
  const schema = eventSchemas[value.type];
  if (!schema) {
    throw new SocketEventError("UNKNOWN_EVENT", `Evento no soportado: ${value.type || "vacío"}`);
  }
  return schema.parse(value);
}

async function createBackend({
  mcp = new McpGateway(),
  heartbeatMs = Number(process.env.WS_HEARTBEAT_MS || DEFAULT_HEARTBEAT_MS),
  maxPayload = Number(process.env.MAX_WS_PAYLOAD_BYTES || DEFAULT_MAX_WS_PAYLOAD),
  messageProcessor = processMessage,
} = {}) {
  await mcp.connect();
  const safeMaxPayload =
    Number.isSafeInteger(maxPayload) && maxPayload >= 64 * 1024
      ? maxPayload
      : DEFAULT_MAX_WS_PAYLOAD;

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", async (_request, response) => {
    try {
      await mcp.listTools({ refresh: true });
      const health = mcp.getHealth();
      response.status(200).json({
        status: "ok",
        mcp: health.status,
        mcp_server: health.server,
        tool_count: health.tools,
        storage: health.storage,
        storage_reason: health.storageReason,
        persistent: health.storage === "mongodb",
        uptime_seconds: Math.floor(process.uptime()),
      });
    } catch (error) {
      const health = mcp.getHealth();
      response.status(503).json({
        status: "unavailable",
        mcp: health.status,
        storage: health.storage,
        storage_reason: health.storageReason,
        persistent: health.storage === "mongodb",
        error: error.code || "MCP_UNAVAILABLE",
      });
    }
  });

  app.use((error, _request, response, _next) => {
    const status = error?.status === 400 || error?.type === "entity.parse.failed" ? 400 : 500;
    response.status(status).json({
      error: {
        code: status === 400 ? "INVALID_JSON" : "INTERNAL_ERROR",
        message: status === 400 ? "El body no contiene JSON válido" : "Error interno",
      },
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
  });

  const httpServer = http.createServer(app);
  const allowedOrigins = parseAllowedOrigins();
  let closing = false;
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: safeMaxPayload,
    perMessageDeflate: false,
    verifyClient: ({ origin }, done) => {
      const allowed = allowedOrigins.size === 0 || Boolean(origin && allowedOrigins.has(origin));
      done(allowed, 403, allowed ? undefined : "Origin not allowed");
    },
  });
  wss.on("error", (error) => {
    if (httpServer.listening && !closing) {
      console.error(`Error WebSocket: ${error.message}`);
    }
  });

  const socketStates = new WeakMap();
  const connectedUsers = new Map();

  function addUserSocket(userId, ws) {
    if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
    connectedUsers.get(userId).add(ws);
  }

  function removeUserSocket(userId, ws) {
    if (!userId) return;
    const sockets = connectedUsers.get(userId);
    sockets?.delete(ws);
    if (sockets?.size === 0) connectedUsers.delete(userId);
  }

  function broadcastToUser(userId, payload) {
    for (const socket of connectedUsers.get(userId) || []) {
      safeSend(socket, payload);
    }
  }

  async function getOverview(userId) {
    const balance = await mcp.callTool("getBalance", { userId });
    return buildOverview(balance);
  }

  async function persistUI(state, prompt, ui) {
    const saved = await mcp.callTool("saveInteraction", {
      userId: state.user.id,
      prompt,
      response: ui,
    });
    state.interactionIds.add(saved.interaction_id);
    return {
      ...ui,
      interaction_id: saved.interaction_id,
      props: {
        ...ui.props,
        interaction_id: saved.interaction_id,
      },
    };
  }

  function requireAuthentication(state) {
    if (!state.user) {
      throw new SocketEventError("AUTH_REQUIRED", "Inicia sesión para continuar");
    }
  }

  function checkRateLimit(state) {
    const now = Date.now();
    if (now - state.rate.windowStartedAt >= RATE_WINDOW_MS) {
      state.rate = { windowStartedAt: now, messages: 0 };
    }
    state.rate.messages += 1;
    if (state.rate.messages > MAX_MESSAGES_PER_WINDOW) {
      throw new SocketEventError(
        "RATE_LIMITED",
        "Demasiados mensajes; espera unos segundos",
        true,
      );
    }
  }

  async function handleLogin(ws, state, event) {
    if (state.user) {
      throw new SocketEventError(
        "ALREADY_AUTHENTICATED",
        "Cierra la sesión actual antes de iniciar otra",
      );
    }
    const user = getPublicDemoUsers().find(
      (candidate) => normalizeText(candidate.username) === normalizeText(event.username),
    );
    const authError = !user
      ? {
          code: "AUTH_USER_NOT_FOUND",
          message: "El usuario no existe.",
        }
      : !passwordMatches(event.password)
        ? {
            code: "AUTH_INVALID_PASSWORD",
            message: "La contraseña es incorrecta.",
          }
        : null;
    if (authError) {
      state.authFailures += 1;
      if (state.authFailures >= 5) {
        safeSend(ws, {
          type: "error",
          code: "AUTH_LOCKED",
          message: "Demasiados intentos fallidos",
          recoverable: false,
        });
        ws.close(1008, "Authentication failed");
        return;
      }
      throw new SocketEventError(authError.code, authError.message);
    }

    let overview;
    try {
      overview = await getOverview(user.id);
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        throw new SocketEventError(
          "AUTH_USER_NOT_FOUND",
          "El usuario no existe.",
        );
      }
      throw error;
    }
    state.user = user;
    state.authFailures = 0;
    addUserSocket(user.id, ws);
    safeSend(ws, { type: "auth_success", user, overview });
  }

  async function handleLogout(ws, state) {
    requireAuthentication(state);
    const userId = state.user.id;
    removeUserSocket(userId, ws);
    clearMemory(userId);
    state.user = null;
    state.pendingTransfer = null;
    state.interactionIds.clear();
    safeSend(ws, { type: "auth_logged_out" });
  }

  async function handleUserText(ws, state, text) {
    requireAuthentication(state);
    safeSend(ws, {
      type: "assistant_status",
      status: "thinking",
      message: "Construyendo tu interfaz…",
    });
    try {
      let ui = await messageProcessor(state.user.id, text, mcp);
      let pendingTransfer = null;
      if (ui.component === "transfer_form") {
        const requestId = randomUUID();
        ui = {
          ...ui,
          props: {
            ...ui.props,
            request_id: requestId,
          },
        };
        pendingTransfer = {
          requestId,
          contactId: ui.props.contact_id,
          toAlias: ui.props.to_alias,
          accountNumber: ui.props.account_number,
          bank: ui.props.bank,
          amount: ui.props.amount,
          concept: ui.props.concept || "",
          status: "pending",
          transaction: null,
          expiresAt: Date.now() + PENDING_TRANSFER_TTL_MS,
        };
      }
      const persistedUI = await persistUI(state, text, ui);
      if (pendingTransfer) state.pendingTransfer = pendingTransfer;
      safeSend(ws, persistedUI);
    } finally {
      safeSend(ws, { type: "assistant_status", status: "idle" });
    }
  }

  function validatePendingTransfer(state, event) {
    if (state.completedRequestIds.has(event.request_id)) {
      throw new SocketEventError(
        "TRANSFER_ALREADY_PROCESSED",
        "Esta transferencia ya fue procesada",
        false,
      );
    }
    const pending = state.pendingTransfer;
    if (!pending || pending.requestId !== event.request_id) {
      throw new SocketEventError(
        "TRANSFER_NOT_PENDING",
        "La confirmación no coincide con una transferencia pendiente",
      );
    }
    if (Date.now() > pending.expiresAt) {
      state.pendingTransfer = null;
      throw new SocketEventError("TRANSFER_EXPIRED", "La transferencia pendiente expiró");
    }
    const toAlias = event.to_alias || pending.toAlias;
    const amount = event.amount ?? pending.amount;
    if (!toAlias || !Number.isFinite(amount) || amount <= 0) {
      throw new SocketEventError(
        "TRANSFER_FIELDS_REQUIRED",
        "Completa la persona y el monto antes de confirmar",
      );
    }
    const recipientChanged =
      normalizeText(toAlias) !== normalizeText(pending.toAlias || "");
    pending.toAlias = toAlias.trim();
    pending.contactId =
      event.contact_id || (recipientChanged ? "" : pending.contactId) || "";
    pending.accountNumber =
      event.account_number ||
      (recipientChanged ? "" : pending.accountNumber) ||
      "";
    pending.bank =
      event.bank || (recipientChanged ? "" : pending.bank) || "";
    pending.amount = Math.round(amount * 100) / 100;
    pending.concept = event.concept ?? pending.concept ?? "";
    if (pending.status === "processing") {
      throw new SocketEventError(
        "TRANSFER_IN_PROGRESS",
        "La transferencia ya se está procesando",
      );
    }
    return pending;
  }

  function markRequestCompleted(state, requestId) {
    state.completedRequestIds.set(requestId, Date.now());
    if (state.completedRequestIds.size > 100) {
      const oldest = state.completedRequestIds.keys().next().value;
      state.completedRequestIds.delete(oldest);
    }
  }

  async function refreshParticipants(state, transaction) {
    const participantIds = [
      ...new Set(
        [transaction.from_user_id, transaction.to_user_id].filter(Boolean),
      ),
    ];
    const overviews = await Promise.allSettled(
      participantIds.map(async (userId) => ({ userId, overview: await getOverview(userId) })),
    );
    for (const result of overviews) {
      if (result.status === "fulfilled") {
        broadcastToUser(result.value.userId, {
          type: "overview_update",
          overview: result.value.overview,
        });
      } else {
        console.error("No se pudo actualizar un overview después de la transferencia");
      }
    }

    const timestamp = new Date().toISOString();
    const title = "Transferencia recibida";
    const body = `${state.user.name} te transfirió $${transaction.amount.toFixed(2)} MXN`;
    if (transaction.to_user_id) {
      broadcastToUser(transaction.to_user_id, {
        type: "notification",
        title,
        body,
        timestamp,
        notification: {
          kind: "transfer_received",
          title,
          message: body,
          timestamp,
          amount: transaction.amount,
          currency: transaction.currency,
          from_user: state.user,
          transaction_id: transaction.transaction_id,
        },
      });
    }
  }

  async function handleTransferConfirmation(ws, state, event) {
    requireAuthentication(state);
    const pending = validatePendingTransfer(state, event);
    safeSend(ws, {
      type: "assistant_status",
      status: "transferring",
      message: "Protegiendo y enviando tu transferencia…",
    });
    try {
      if (!pending.transaction) {
        pending.status = "processing";
        try {
          pending.transaction = await mcp.callTool("createTransaction", {
            fromUserId: state.user.id,
            toAlias: pending.toAlias,
            amount: pending.amount,
            concept: pending.concept,
            contactId: pending.contactId || undefined,
            accountNumber: pending.accountNumber || undefined,
            requestId: pending.requestId,
          });
          pending.status = "executed";
        } catch (error) {
          pending.status = "pending";
          throw error;
        }
      }

      const ui = {
        type: "ui",
        component: "transfer_success",
        props: {
          title: "Transferencia completada",
          ...pending.transaction,
        },
      };
      let persistedUI;
      try {
        persistedUI = await persistUI(
          state,
          `Confirmación de transferencia ${pending.requestId}`,
          ui,
        );
      } catch {
        pending.status = "executed";
        throw new SocketEventError(
          "TRANSFER_COMPLETED_RECEIPT_PENDING",
          "La transferencia se completó, pero no se guardó el comprobante. Reintenta la confirmación.",
          true,
        );
      }

      pending.status = "completed";
      markRequestCompleted(state, pending.requestId);
      state.pendingTransfer = null;
      safeSend(ws, persistedUI);
      await refreshParticipants(state, pending.transaction);
    } finally {
      safeSend(ws, { type: "assistant_status", status: "idle" });
    }
  }

  async function handleRating(ws, state, event) {
    requireAuthentication(state);
    if (!state.interactionIds.has(event.interaction_id)) {
      throw new SocketEventError(
        "INTERACTION_NOT_OWNED",
        "La interacción no pertenece a esta sesión",
        false,
      );
    }
    const result = await mcp.callTool("saveRating", {
      interactionId: event.interaction_id,
      rating: event.rating,
    });
    safeSend(ws, { type: "rating_saved", ...result });
  }

  async function dispatchEvent(ws, state, event) {
    switch (event.type) {
      case "auth_login":
        return handleLogin(ws, state, event);
      case "auth_logout":
        return handleLogout(ws, state);
      case "user_message":
        requireAuthentication(state);
        return handleUserText(ws, state, event.text);
      case "confirm_transfer":
        return handleTransferConfirmation(ws, state, event);
      case "rate_interaction":
        return handleRating(ws, state, event);
      default:
        throw new SocketEventError("UNKNOWN_EVENT", "Evento no soportado");
    }
  }

  wss.on("connection", (ws) => {
    const state = {
      user: null,
      isAlive: true,
      authFailures: 0,
      pendingTransfer: null,
      completedRequestIds: new Map(),
      interactionIds: new Set(),
      rate: { windowStartedAt: Date.now(), messages: 0 },
      queue: Promise.resolve(),
    };
    socketStates.set(ws, state);

    ws.on("pong", () => {
      state.isAlive = true;
    });
    ws.on("message", (raw, isBinary) => {
      state.queue = state.queue
        .then(async () => {
          if (isBinary) {
            throw new SocketEventError(
              "BINARY_NOT_ALLOWED",
              "Solo se aceptan eventos JSON de texto",
            );
          }
          checkRateLimit(state);
          const event = parseEvent(raw.toString("utf8"));
          await dispatchEvent(ws, state, event);
        })
        .catch((error) => {
          safeSend(ws, errorPayload(error));
        });
    });
    ws.on("close", () => {
      removeUserSocket(state.user?.id, ws);
      state.pendingTransfer = null;
    });
    ws.on("error", () => {
      removeUserSocket(state.user?.id, ws);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const state = socketStates.get(ws);
      if (!state?.isAlive) {
        ws.terminate();
        continue;
      }
      state.isAlive = false;
      ws.ping();
    }
  }, Number.isFinite(heartbeatMs) && heartbeatMs >= 5000 ? heartbeatMs : DEFAULT_HEARTBEAT_MS);
  heartbeat.unref();

  async function listen(port = Number(process.env.PORT || DEFAULT_PORT), host = process.env.HOST || "0.0.0.0") {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        httpServer.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        httpServer.off("error", onError);
        resolve();
      };
      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      httpServer.listen(port, host);
    });
    return httpServer.address();
  }

  async function close() {
    if (closing) return;
    closing = true;
    clearInterval(heartbeat);
    for (const ws of wss.clients) {
      ws.close(1001, "Server shutting down");
    }
    const forceClose = setTimeout(() => {
      for (const ws of wss.clients) ws.terminate();
    }, 250);
    forceClose.unref();

    await Promise.allSettled([
      new Promise((resolve) => wss.close(resolve)),
      new Promise((resolve) => {
        if (!httpServer.listening) return resolve();
        httpServer.close(resolve);
        httpServer.closeAllConnections?.();
      }),
    ]);
    clearTimeout(forceClose);
    await mcp.close();
  }

  return { app, close, httpServer, listen, mcp, wss };
}

async function main() {
  const backend = await createBackend();
  let address;
  try {
    address = await backend.listen();
  } catch (error) {
    await backend.close();
    throw error;
  }
  const port = typeof address === "object" && address ? address.port : DEFAULT_PORT;
  console.log(`BanAI backend listo en http://localhost:${port}; storage=${backend.mcp.storage}`);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await backend.close();
  };
  process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("No se pudo iniciar BanAI:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  SocketEventError,
  buildOverview,
  createBackend,
  errorPayload,
  parseEvent,
};
