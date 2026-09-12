# HackMTY 2026 — Banorte × Tec de Monterrey

Interfaces que la IA construye en tiempo real: un chatbot conectado a un
servidor MCP que genera componentes de UI (A2UI) según la intención del usuario.

## Estructura

```
HackMTY_2026/
├── hackmty-backend/     Node.js — MongoDB Atlas, tools de MCP, servidor WebSocket
└── hackmty-app/         React Native (Expo) — chat + renderizado dinámico de A2UI
```

## 1. Backend

```bash
cd hackmty-backend
npm install
copy .env.example .env      # Windows (o "cp" en Mac/Linux)
# edita .env con tu MONGODB_URI real
npm run seed                # carga los 4 usuarios de prueba
npm start                   # levanta el servidor WebSocket en ws://localhost:4000
```

`server.js` ahora mismo usa reglas simples (`processMessage`) en vez del LLM real —
es un stub para poder probar el flujo completo (front ↔ WebSocket ↔ Mongo) antes
de tener la orquestación con el modelo lista. Ahí es donde conecta MCP de verdad:
cuando lo tengan, reemplacen `processMessage` por la llamada al agente, que a su vez
invoca `getBalance`, `getContacts`, `createTransaction` o `getCreditPlans` de
`mcpTools.js` como tools.

## 2. Frontend (Expo / React Native)

```bash
cd hackmty-app
npm install
```

Antes de correrlo, abre `src/services/socket.js` y cambia `SERVER_URL` por la IP
local de la laptop donde corre el backend (no uses `localhost` — el celular no
la puede resolver). Para saber tu IP:

- Windows: `ipconfig` → busca "IPv4 Address"
- Mac: `ifconfig | grep inet`

Ambos dispositivos (laptop y celular) deben estar en la **misma red WiFi**.

```bash
npm start
```

Esto abre Expo Dev Tools; escanea el QR con la app **Expo Go** en tu celular
(Android o iOS) para probar la app sin necesidad de compilarla nativamente.

## 3. Flujo de la demo

1. Usuario escribe (o dice) "¿Cuál es mi saldo?" → backend regresa `balance_card`.
2. "Quiero pagar menos intereses" → backend regresa `credit_plan_table`.
3. "Haz una transacción a Timoteo" → backend regresa `transfer_form` con botón de confirmar.
4. Al confirmar, el front manda `confirm_transfer` por el mismo socket → backend
   actualiza los balances en MongoDB y regresa `transfer_success`.

## Pendientes

- [ ] Reemplazar `processMessage` en `server.js` por la orquestación real con el LLM + MCP.
- [ ] Agregar el botón de micrófono en `ChatScreen.js` (grabar audio → transcribir → `sendUserMessage`).
- [ ] Decidir Whisper API vs. transcripción integrada del LLM (ver conversación con Claude).
- [ ] Servidor MCP formal envolviendo `mcpTools.js` (protocolo MCP real, no llamadas directas).
