// llm.js
// Conecta el chat con Gemini usando function calling: el modelo decide cuándo
// llamar getBalance/getContacts/createTransaction/getCreditPlans, y al final
// regresa el componente A2UI que el front debe renderizar.
//
// Usa el SDK vigente @google/genai (el paquete @google/generative-ai quedó
// deprecado y ya no funciona bien con los modelos actuales de Gemini).

require("dotenv").config();
const { GoogleGenAI, Type } = require("@google/genai");
const { getBalance, getContacts, createTransaction, getCreditPlans } = require("./mcpTools");

if (!process.env.LLM_API_KEY) {
  throw new Error("Falta LLM_API_KEY en tu .env (tu key gratis de Gemini de Google AI Studio).");
}

const ai = new GoogleGenAI({ apiKey: process.env.LLM_API_KEY });

// Modelo Flash de la generación 2.5: está en el tier gratis con rate limits
// razonables para un hackathon. Si en algún momento Google lo retira, el
// mensaje de error te va a decir el modelo de reemplazo recomendado.
const MODEL = "gemini-3.6-flash";

// --- Declaración de las tools para Gemini (mismo shape que mcpTools.js) ---
const functionDeclarations = [
  {
    name: "getBalance",
    description: "Obtiene el balance y las cuentas de un usuario.",
    parameters: {
      type: Type.OBJECT,
      properties: { userId: { type: Type.STRING, description: "id del usuario, ej. u1" } },
      required: ["userId"],
    },
  },
  {
    name: "getContacts",
    description: "Obtiene la lista de contactos de transferencia de un usuario.",
    parameters: {
      type: Type.OBJECT,
      properties: { userId: { type: Type.STRING } },
      required: ["userId"],
    },
  },
  {
    name: "createTransaction",
    description: "Ejecuta una transferencia del usuario a un contacto por alias.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fromUserId: { type: Type.STRING },
        toAlias: { type: Type.STRING, description: "alias del contacto, ej. Timoteo" },
        amount: { type: Type.NUMBER },
      },
      required: ["fromUserId", "toAlias", "amount"],
    },
  },
  {
    name: "getCreditPlans",
    description: "Obtiene opciones de reestructura de una cuenta de crédito.",
    parameters: {
      type: Type.OBJECT,
      properties: { accountId: { type: Type.STRING } },
      required: ["accountId"],
    },
  },
];

// Mapa nombre -> función real (las mismas de mcpTools.js)
const toolImpl = {
  getBalance: ({ userId }) => getBalance(userId),
  getContacts: ({ userId }) => getContacts(userId),
  createTransaction: ({ fromUserId, toAlias, amount }) => createTransaction(fromUserId, toAlias, amount),
  getCreditPlans: ({ accountId }) => getCreditPlans(accountId),
};

const SYSTEM_INSTRUCTION = `
Eres el agente financiero de una app bancaria. Tu trabajo es interpretar lo que
pide el usuario, usar las tools disponibles para consultar o modificar datos
reales, y al final responder SOLO con un JSON (sin texto extra, sin \`\`\`)
que describe qué componente de UI debe mostrar la app. No inventes datos:
todo debe venir de las tools.

Formato de respuesta final, exactamente uno de estos:
{"type":"ui","component":"balance_card","props":{...resultado de getBalance...}}
{"type":"ui","component":"contacts_list","props":{"contacts":[...resultado de getContacts...]}}
{"type":"ui","component":"transfer_form","props":{"from_user":"u1","suggested_contact":"Timoteo","amount":1500}}
{"type":"ui","component":"transfer_success","props":{...resultado de createTransaction...}}
{"type":"ui","component":"credit_plan_table","props":{...resultado de getCreditPlans...}}
{"type":"text","text":"respuesta breve si no aplica ningún componente"}

Reglas:
- Si el usuario pide transferir/depositar dinero, primero solo arma el
  "transfer_form" con el alias y el monto que haya dicho (NO llames a
  createTransaction todavía) — la app pide confirmación al usuario.
- Solo llama a createTransaction cuando el mensaje del usuario indique que ya
  confirmó (ej. "confirmo", "sí, hazlo").
- accountId de crédito del usuario actual siempre termina en "_credit".
`;

const chatConfig = {
  systemInstruction: SYSTEM_INSTRUCTION,
  tools: [{ functionDeclarations }],
};

// Una sesión de chat por usuario, para que el modelo recuerde el contexto
// entre mensajes (necesario para el paso de "¿cuánto? -> confirmo").
// Vive solo en memoria del proceso — se resetea si reinicias el server,
// lo cual está bien para un hackathon.
const chatSessions = new Map();

function getChatSession(userId) {
  if (!chatSessions.has(userId)) {
    chatSessions.set(userId, ai.chats.create({ model: MODEL, config: chatConfig }));
  }
  return chatSessions.get(userId);
}

/**
 * Procesa un mensaje del usuario con Gemini + function calling.
 * Regresa el objeto ya listo para mandarse tal cual por el WebSocket.
 */
async function processMessage(userId, text) {
  const chat = getChatSession(userId);
  let response = await chat.sendMessage({ message: `[user_id: ${userId}] ${text}` });

  // Bucle de function calling: mientras el modelo pida ejecutar tools, se las damos.
  let calls = response.functionCalls;
  let safety = 0;
  while (calls && calls.length > 0 && safety < 5) {
    safety++;

    // Ejecutamos todas las llamadas que haya pedido en este turno y regresamos
    // las respuestas juntas, en el mismo orden.
    const functionResponseParts = [];
    for (const call of calls) {
      const fn = toolImpl[call.name];
      let output;
      try {
        output = fn ? await fn(call.args) : { error: `Tool desconocida: ${call.name}` };
      } catch (err) {
        output = { error: err.message };
      }
      functionResponseParts.push({ functionResponse: { name: call.name, response: output } });
    }

    response = await chat.sendMessage({ message: functionResponseParts });
    calls = response.functionCalls;
  }

  const raw = (response.text || "").trim();
  try {
    return JSON.parse(raw.replace(/^```json|```$/g, "").trim());
  } catch {
    // Si el modelo no regresó JSON limpio, cae a texto plano para no tronar la demo.
    return { type: "text", text: raw };
  }
}

module.exports = { processMessage };
