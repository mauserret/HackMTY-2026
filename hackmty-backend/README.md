# BanAI backend

Backend de la demo Banorte: HTTP y WebSocket en un mismo servidor, generación
de interfaces declarativas y ejecución de toda lógica financiera mediante un
servidor MCP aislado por `stdio`.

Requiere Node.js 20.19 o posterior.

## Inicio rápido

```bash
npm install
npm start
```

Sin `MONGODB_URI`, el subproceso MCP inicia con un fixture efímero. Con una URI
configurada intenta usar Atlas; si el servicio no está disponible, el servidor
continúa en memoria salvo que `MONGODB_REQUIRED=true`.

```bash
curl http://localhost:4000/health
```

La respuesta distingue `storage: "mongodb"` de `storage: "memory"`, expone
`persistent` y, cuando hay fallback, agrega `storage_reason`.

## MongoDB Atlas

```bash
cp .env.example .env
# Configura MONGODB_URI sin compartir el secreto
npm run seed
npm start
```

La base por defecto es `hackmty_db`. `npm run seed` reemplaza las colecciones
del fixture, por lo que no debe ejecutarse contra datos que se quieran
conservar. Si existe `MONGODB_URI`, el seed exige una conexión persistente y no
se degrada silenciosamente a memoria.

Al iniciar:

1. se comprueba la conexión con `ping`;
2. se migran índices anteriores con opciones incompatibles;
3. los índices únicos de campos nuevos usan filtros parciales para no chocar
   con documentos legacy;
4. el servidor MCP se conecta al transporte `stdio`.

El error `ATLAS_TLS_HANDSHAKE_REJECTED` indica que Atlas cerró TLS antes de la
autenticación. Revisa en Atlas que el clúster esté activo y que **Network
Access** permita la IP pública actual. `MONGODB_REQUIRED=true` convierte este
diagnóstico en un fallo de arranque; el valor predeterminado mantiene la demo
operativa en memoria.

## Arquitectura

```text
cliente
  └─ HTTP/WebSocket → server.js
                         ├─ llm.js → Gemini o fallback local
                         └─ mcpClient.js
                              └─ stdio JSON-RPC → mcp/server.js
                                                    ├─ mcpTools.js
                                                    └─ db.js → Atlas o memoria
```

- `server.js` administra autenticación, sesiones y confirmaciones.
- `mcpClient.js` inicia el subproceso y valida su catálogo.
- `mcpTools.js` concentra validación, consultas y mutaciones financieras.
- `llm.js` solo entrega a Gemini tools de lectura; una transferencia se ejecuta
  exclusivamente desde la confirmación del servidor.

El catálogo MCP publica 19 tools. Las seis originales se conservan para
compatibilidad:

- `getBalance({ userId })`
- `getContacts({ userId })`
- `getCreditPlans({ accountId })`
- `createTransaction({ fromUserId, toAlias|registeredName, amount, clabe?, requestId? })`
- `saveInteraction({ userId, prompt, response })`
- `saveRating({ interactionId, rating })`

Las nuevas operaciones son:

- `get_contacts({ userId })`
- `register_account({ userId, name, clabe, bank? })`
- `add_contact({ userId, name, alias?, accountNumber?, clabe?, bank? })`
- `update_contact({ userId, contactId, ...changes })`
- `delete_contact({ userId, contactId })`
- `add_account({ userId, type, name?, clabe?, accountNumber?, bank?, ... })`
- `get_financial_summary({ userId, startDate?, endDate?, groupBy? })`
- `get_transaction_detail({ userId, transactionId })`

Cinco tools internas respaldan el portal administrativo y no se entregan al
LLM: `authenticateAdmin`, `getAdminOverview`, `listAdminUsers`,
`listAdminInteractions` y `getAdminInteraction`.

`get_contacts` y `register_account` usan el contrato canónico (`name`, `clabe`,
`bank`). Las transferencias resuelven por el **nombre registrado** y exigen que
la CLABE exista; si no, responden `CLABE_NOT_FOUND`.

## WebSocket

Conecta a `ws://localhost:4000` e inicia sesión:

```json
{"type":"auth_login","username":"USUARIO","password":"CONTRASEÑA"}
```

El servidor no enumera cuentas al abrir el socket. Un usuario inexistente
produce `AUTH_USER_NOT_FOUND`; una contraseña incorrecta,
`AUTH_INVALID_PASSWORD`.

Una vez autenticado admite:

```json
{"type":"user_message","text":"Muéstrame una gráfica de mis movimientos"}
{"type":"confirm_transfer","request_id":"UUID_DEL_FORMULARIO","to_alias":"Timo","amount":500,"concept":"Cena"}
{"type":"rate_interaction","interaction_id":"ID_RECIBIDO","rating":10}
{"type":"auth_logout"}
```

El reconocimiento de voz ocurre en el cliente con APIs nativas y llega como
`user_message`; el backend ya no recibe archivos o base64 de audio. Cualquier
identidad adicional enviada por el cliente se descarta: la sesión del socket es
la única fuente de identidad.

Las respuestas son `assistant_status`, `ui`, `overview_update`,
`notification`, `rating_saved` y `error`.

## Confirmación de transferencias

Una petición conversacional nunca mueve dinero. El primer turno genera
`transfer_form` con un `request_id`; solo `confirm_transfer` puede invocar
`createTransaction`.

El formulario incluye `initialValues.recipient`, `initialValues.amount`,
`initialValues.concept`, `initialValues.accountNumber` e
`initialValues.bank`. Antes de confirmar, el resolver vincula alias, apodo,
primer nombre, nombre completo o typo corto con un `contact_id` canónico. La
confirmación envía juntos id, alias y cuenta; MCP rechaza combinaciones de
registros distintos.

El servidor mantiene una única transferencia pendiente por socket, la expira,
bloquea confirmaciones paralelas y usa el mismo `request_id` como llave
idempotente. Después actualiza saldos y movimientos de ambas partes y notifica
al receptor.

## Gemini y fallback

`GEMINI_API_KEY` o `LLM_API_KEY` habilitan la interpretación semántica. El
modelo se configura con `GEMINI_MODEL`. Sin llave o si Gemini falla, el
intérprete local consulta MCP y cubre:

- saldos, cuentas y contactos;
- planes de crédito;
- gráficas con datos financieros reales;
- resumen global y detalle de una sola operación;
- transferencias coloquiales con confirmación;
- aclaraciones y acciones rápidas.

`ELEVENLABS_API_KEY` habilita la narración bajo demanda (`POST /api/tts`).
El cliente solo habla cuando el usuario toca el icono de speaker de una
respuesta. `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` y `ELEVENLABS_SPEED`
(`0.7`–`1.2`, por defecto `1.0`) son opcionales.

Gemini no participa en la conversión de voz.

## Portal administrativo

Antes del primer acceso crea o actualiza la cuenta configurada, sin modificar
las demás colecciones:

```bash
npm run seed:admin
```

Los valores predeterminados requeridos para la demo son `admin` / `1`. La
contraseña se almacena con `scrypt`; el API emite una cookie firmada `HttpOnly`
y limita intentos fallidos. En producción configura `ADMIN_SESSION_SECRET`,
`ADMIN_COOKIE_SECURE=true` y los orígenes adicionales en
`ADMIN_ALLOWED_ORIGINS`.

La API protegida se monta en `/api/admin` y expone sesión, resumen, usuarios,
interfaces, detalle A2UI y análisis de calificaciones. La aplicación
independiente `hackmty-admin` consume estas rutas; no consulta MongoDB desde el
navegador.

## Scripts

```bash
npm start
npm run dev
npm run seed
npm run seed:admin
npm test
npm run test:mcp
```

Las pruebas fuerzan memoria y no contactan MongoDB ni Gemini.
