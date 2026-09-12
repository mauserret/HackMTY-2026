// server.js
// Servidor WebSocket: recibe mensajes del chat (texto ya transcrito o escrito),
// llama a "processMessage" (donde va tu orquestación LLM + MCP) y regresa
// un mensaje de tipo "ui" con el componente A2UI que el front debe renderizar.
//
// Uso: node server.js

require("dotenv").config();
const { WebSocketServer } = require("ws");
const { connectDB } = require("./db");
const { createTransaction } = require("./mcpTools");
const { processMessage } = require("./llm");

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();

  const wss = new WebSocketServer({ port: PORT });
  console.log(`Servidor WebSocket escuchando en ws://localhost:${PORT}`);

  wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Contrato esperado desde el front:
        // { type: "user_message", user_id: "u1", text: "..." }
        if (msg.type === "user_message") {
          const response = await processMessage(msg.user_id, msg.text);
          ws.send(JSON.stringify(response));
        }

        // Contrato esperado cuando el usuario confirma una acción en la UI generada:
        // { type: "confirm_transfer", user_id, to_alias, amount }
        if (msg.type === "confirm_transfer") {
          const tx = await createTransaction(msg.user_id, msg.to_alias, msg.amount);
          ws.send(
            JSON.stringify({
              type: "ui",
              component: "transfer_success",
              props: tx,
            })
          );
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
    });

    ws.on("close", () => console.log("Cliente desconectado"));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
