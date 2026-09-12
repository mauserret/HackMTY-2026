#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { closeDB, connectDB } = require("../db");
const { handlers, ToolError, toolDefinitions } = require("../mcpTools");

const server = new McpServer({
  name: "banai-financial-tools",
  version: "1.0.0",
});

for (const definition of toolDefinitions) {
  server.registerTool(
    definition.name,
    {
      description: definition.description,
      inputSchema: z.object(definition.inputSchema).strict(),
      annotations: definition.annotations,
    },
    async (input) => {
      try {
        const result = await handlers[definition.name](input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const toolError =
          error instanceof ToolError
            ? error
            : new ToolError("INTERNAL_ERROR", "La operación no pudo completarse");
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: {
                  code: toolError.code,
                  message: toolError.message,
                  recoverable: toolError.recoverable,
                },
              }),
            },
          ],
        };
      }
    },
  );
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled([server.close(), closeDB()]);
}

async function main() {
  const storage = await connectDB();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const reason = storage.fallbackReason
    ? `; storageReason=${storage.fallbackReason}`
    : "";
  console.error(`MCP listo; storage=${storage.kind}${reason}`);
}

process.once("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

main().catch((error) => {
  console.error("No se pudo iniciar el servidor MCP:", error.message);
  process.exitCode = 1;
});
