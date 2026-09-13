"use strict";

const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const EXPECTED_TOOLS = Object.freeze([
  "getBalance",
  "getContacts",
  "getCreditPlans",
  "createTransaction",
  "saveInteraction",
  "saveRating",
  "get_contacts",
  "register_account",
  "add_contact",
  "update_contact",
  "add_account",
  "get_financial_summary",
  "get_transaction_detail",
]);

class McpGatewayError extends Error {
  constructor(code, message, recoverable = true, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "McpGatewayError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

function makeChildEnvironment(overrides = {}) {
  const env = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) {
      delete env[key];
    } else {
      env[key] = String(value);
    }
  }
  return env;
}

function parseTextContent(result) {
  const textPart = result.content?.find((part) => part.type === "text");
  if (!textPart?.text) return null;
  try {
    return JSON.parse(textPart.text);
  } catch {
    return { value: textPart.text };
  }
}

function extractToolError(result) {
  const payload = parseTextContent(result);
  const error = payload?.error;
  if (error && typeof error === "object") {
    return new McpGatewayError(
      typeof error.code === "string" ? error.code : "MCP_TOOL_ERROR",
      typeof error.message === "string" ? error.message : "La tool MCP falló",
      error.recoverable !== false,
    );
  }
  const fallback =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.value === "string" && payload.value) ||
    "La tool MCP falló";
  return new McpGatewayError("MCP_TOOL_ERROR", fallback);
}

class McpGateway {
  constructor({
    env = {},
    logger = (message) => console.error(message),
    requestTimeoutMs = Number(process.env.MCP_REQUEST_TIMEOUT_MS || 15000),
  } = {}) {
    this.childEnv = makeChildEnvironment(env);
    this.logger = logger;
    this.requestTimeoutMs = requestTimeoutMs;
    this.state = "idle";
    this.storage = this.childEnv.MONGODB_URI ? "mongodb" : "memory";
    this.storageReason = this.childEnv.MONGODB_URI
      ? null
      : "MONGODB_URI_MISSING";
    this.client = null;
    this.transport = null;
    this.tools = null;
    this.connectPromise = null;
  }

  async connect() {
    if (this.state === "connected") return this;
    if (this.connectPromise) return this.connectPromise;

    this.state = "starting";
    this.connectPromise = this.start().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  async start() {
    const cwd = __dirname;
    this.client = new Client(
      { name: "banai-backend-orchestrator", version: "1.0.0" },
      { capabilities: {} },
    );
    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(cwd, "mcp", "server.js")],
      cwd,
      env: this.childEnv,
      stderr: "pipe",
      maxBufferSize: 2 * 1024 * 1024,
    });

    let stderrBuffer = "";
    this.transport.stderr?.on("data", (chunk) => {
      stderrBuffer += chunk.toString("utf8");
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || "";
      for (const line of lines) {
        const storageMatch = line.match(/storage=(memory|mongodb)/);
        if (storageMatch) this.storage = storageMatch[1];
        const reasonMatch = line.match(/storageReason=([A-Z0-9_]+)/);
        if (reasonMatch) this.storageReason = reasonMatch[1];
        if (line.trim()) this.logger(`[mcp] ${line}`);
      }
    });

    this.client.onclose = () => {
      if (this.state !== "stopping" && this.state !== "stopped") {
        this.state = "disconnected";
      }
    };

    try {
      await this.client.connect(this.transport, { timeout: this.requestTimeoutMs });
      this.state = "connected";
      await this.listTools({ refresh: true });
      return this;
    } catch (error) {
      this.state = "unavailable";
      await this.close().catch(() => {});
      throw new McpGatewayError(
        "MCP_UNAVAILABLE",
        "No se pudo conectar con el servidor MCP",
        true,
        error,
      );
    }
  }

  assertConnected() {
    if (this.state !== "connected" || !this.client) {
      throw new McpGatewayError("MCP_UNAVAILABLE", "El servidor MCP no está disponible");
    }
  }

  async listTools({ refresh = false } = {}) {
    this.assertConnected();
    if (this.tools && !refresh) return this.tools;

    let response;
    try {
      response = await this.client.listTools(undefined, { timeout: this.requestTimeoutMs });
    } catch (error) {
      this.state = "unavailable";
      throw new McpGatewayError(
        "MCP_UNAVAILABLE",
        "No se pudo obtener el catálogo MCP",
        true,
        error,
      );
    }

    const names = response.tools.map((tool) => tool.name).sort();
    const expected = [...EXPECTED_TOOLS].sort();
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
      this.state = "invalid";
      throw new McpGatewayError(
        "MCP_TOOLSET_INVALID",
        `El servidor MCP debe publicar exactamente: ${EXPECTED_TOOLS.join(", ")}`,
        false,
      );
    }
    this.tools = response.tools;
    return this.tools;
  }

  async callTool(name, args) {
    this.assertConnected();
    if (!EXPECTED_TOOLS.includes(name)) {
      throw new McpGatewayError("MCP_TOOL_NOT_ALLOWED", `Tool MCP no permitida: ${name}`, false);
    }

    let result;
    try {
      result = await this.client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: this.requestTimeoutMs },
      );
    } catch (error) {
      throw new McpGatewayError(
        "MCP_CALL_FAILED",
        `No se pudo ejecutar ${name}`,
        true,
        error,
      );
    }

    if (result.isError) {
      throw extractToolError(result);
    }
    if (result.structuredContent && typeof result.structuredContent === "object") {
      return result.structuredContent;
    }
    const parsed = parseTextContent(result);
    if (parsed !== null) return parsed;
    throw new McpGatewayError("MCP_INVALID_RESULT", `${name} devolvió una respuesta inválida`);
  }

  getHealth() {
    return {
      status: this.state,
      storage: this.storage,
      storageReason: this.storageReason,
      tools: this.tools?.length || 0,
      server: this.client?.getServerVersion() || null,
    };
  }

  async close() {
    if (this.state === "stopped") return;
    this.state = "stopping";
    const client = this.client;
    const transport = this.transport;
    this.client = null;
    this.transport = null;
    this.tools = null;

    if (client) {
      await client.close().catch(() => {});
    } else if (transport) {
      await transport.close().catch(() => {});
    }
    this.state = "stopped";
  }
}

module.exports = {
  EXPECTED_TOOLS,
  McpGateway,
  McpGatewayError,
  extractToolError,
  parseTextContent,
};
