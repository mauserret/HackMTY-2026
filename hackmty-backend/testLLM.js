// testLLM.js
// Prueba processMessage() directo desde la terminal, sin necesidad del
// WebSocket ni de Expo. Útil para confirmar que Gemini + function calling +
// MongoDB están bien conectados antes de meterte al front.
//
// Uso:
//   node testLLM.js "¿Cuál es mi saldo?"
//   node testLLM.js "Haz una transacción a Timoteo de 1500 pesos"
//   node testLLM.js "Confirmo"

const { connectDB, closeDB } = require("./db");
const { processMessage } = require("./llm");

const USER_ID = "u1";

async function main() {
  const text = process.argv.slice(2).join(" ");
  if (!text) {
    console.log('Uso: node testLLM.js "tu mensaje aquí"');
    process.exit(1);
  }

  await connectDB();
  console.log(`\nUsuario (${USER_ID}): ${text}`);

  const response = await processMessage(USER_ID, text);
  console.log("\nRespuesta del agente:");
  console.log(JSON.stringify(response, null, 2));

  await closeDB();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
