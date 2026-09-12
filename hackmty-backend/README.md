# BanAI backend

Backend de la demo Banorte para HackMTY. Expone HTTP y WebSocket desde un mismo
servidor, genera respuestas A2UI y ejecuta toda operación financiera mediante un
servidor MCP aislado por stdio.

Requiere Node.js 20 o posterior.

## Inicio rápido sin secretos

```bash
npm install
npm start
```

Sin `MONGODB_URI`, el subproceso MCP inicia automáticamente con cuatro usuarios,
12 contactos y un plan de crédito en memoria. Esta modalidad es funcional pero
efímera: todos los cambios se pierden al reiniciar.

La contraseña maestra de la demo es `1234`, salvo que `DEMO_PASSWORD` indique
otra. Los usuarios son:

- `Mau` — Mauricio Rey (`u1`)
- `Timo` — Timoteo Aguilar (`u2`)
- `Esteban` — Esteban Esquivel (`u3`)
- `Brau` — Braulio Garcia (`u4`)

Comprueba el proceso:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/demo-users
```

`/health` reporta explícitamente `storage: "memory"` o `storage: "mongodb"` y
si la persistencia está activa.

## MongoDB Atlas

```bash
cp .env.example .env
# Configura MONGODB_URI en .env
npm run seed
npm start
```

La base por defecto es `hackmty_db`. `npm run seed` reemplaza los datos de las
colecciones demo, por lo que no debe ejecutarse contra una base con información
que se quiera conservar.

Se crean índices únicos para usernames, cuentas, contactos, planes de crédito e
idempotency keys, además de índices para historiales. En Atlas, las transferencias
usan una transacción MongoDB con `snapshot` y escritura `majority`. En un servidor
Mongo que no soporte transacciones se usa una ruta serializada con compensación;
esa ruta no ofrece las mismas garantías ACID ante la caída completa del proceso.

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

- `server.js` nunca importa la lógica de negocio.
- `mcpClient.js` inicia `mcp/server.js` con `StdioClientTransport`.
- `mcp/server.js` publica las tools y reserva stdout exclusivamente para
  JSON-RPC; sus diagnósticos van a stderr.
- `mcpTools.js` concentra validación y lógica financiera.
- `llm.js` obtiene los esquemas con `listTools` y ejecuta consultas con
  `callTool`. `createTransaction` nunca se expone a Gemini.

Las seis tools MCP publicadas son exactamente:

- `getBalance({ userId })`
- `getContacts({ userId })`
- `getCreditPlans({ accountId })`
- `createTransaction({ fromUserId, toAlias, amount, requestId? })`
- `saveInteraction({ userId, prompt, response })`
- `saveRating({ interactionId, rating })`

## WebSocket

Conecta a `ws://localhost:4000`. Al abrirse, el servidor envía:

```json
{"type":"demo_users","users":[{"id":"u1","name":"Mauricio Rey","username":"Mau"}]}
```

Inicia sesión:

```json
{"type":"auth_login","username":"Mau","password":"1234"}
```

El servidor responde `auth_success` con el usuario y su overview. Una vez
autenticado admite:

```json
{"type":"user_message","text":"¿Cuál es mi saldo?"}
{"type":"audio_stream","audio_base64":"BASE64","mime_type":"audio/webm"}
{"type":"confirm_transfer","request_id":"UUID_DEL_FORMULARIO"}
{"type":"rate_interaction","interaction_id":"ID_RECIBIDO","rating":10}
{"type":"auth_logout"}
```

Cualquier `user_id`, `userId` o identidad adicional del cliente se descarta. La
sesión autenticada es la única fuente de identidad.

Las respuestas operativas son `assistant_status`, `ui`, `overview_update`,
`notification`, `transcription`, `rating_saved` y `error`. Los errores incluyen
`code`, `message` y `recoverable`.

`audio` y `data` se conservan como aliases compatibles de `audio_base64`, pero
el último es el nombre canónico del contrato A2UI.

### Confirmación de transferencias

Una petición conversacional nunca mueve dinero. El primer turno genera
`transfer_form` con un `request_id` aleatorio. Solo `confirm_transfer` con ese
identificador puede invocar `createTransaction`.

El servidor conserva una única transferencia pendiente por socket, la expira a
los diez minutos, bloquea confirmaciones paralelas y recuerda requests ya
completados. El mismo `request_id` también es la llave idempotente en MCP, por lo
que un retry no duplica el cargo. Al completar:

1. guarda `transfer_success` en `interactions`;
2. añade su `interaction_id` al mensaje `ui`;
3. actualiza overviews de emisor y receptor conectados;
4. notifica al receptor.

Toda respuesta `ui`, incluso cards de aclaración, se guarda con
`saveInteraction` antes de enviarse.

## Gemini y fallback

Configura `GEMINI_API_KEY` o su alias compatible `LLM_API_KEY`. El SDK se carga de
forma lazy y el modelo por defecto es `gemini-3.6-flash`, configurable con
`GEMINI_MODEL`.

Sin key o si Gemini falla, el fallback local sigue consultando MCP y cubre:

- saldos y cuentas;
- contactos;
- reestructura, CAT e intereses;
- transferencia coloquial con monto y alias;
- datos faltantes mediante `clarification_card`;
- opciones generales mediante `quick_actions`.

El fallback no ejecuta mutaciones. Una frase como “confirmo” enviada como
`user_message` pide usar el botón seguro; no transfiere.

## Audio

La transcripción usa audio inline de `@google/genai`. Requiere una API key aunque
el chat de texto pueda operar en fallback. Por defecto acepta hasta 4 MiB de
audio base64 en formatos AAC, FLAC, MP4, MPEG, OGG, WAV y WebM. Los límites y el
modelo se ajustan con `MAX_AUDIO_BYTES` y `GEMINI_TRANSCRIPTION_MODEL`.

`audio_stream` recibe un clip completo, no chunks incrementales.

## Seguridad operativa

- autenticación por socket y límite de intentos;
- payload WebSocket máximo, audio validado y compresión desactivada;
- aliases normalizados sin expresiones regulares dinámicas;
- montos positivos, finitos, con máximo dos decimales;
- ratings enteros de 1 a 10 y restringidos a interacciones de la sesión;
- cola por socket, rate limit, heartbeat ping/pong y apagado limpio;
- allowlist opcional de origins mediante `WS_ALLOWED_ORIGINS`.

La contraseña maestra es adecuada solo para esta demo, no para producción.

## Scripts

```bash
npm start       # servidor HTTP + WebSocket y subproceso MCP
npm run dev     # reinicio automático de Node
npm run seed    # reemplaza el seed en Atlas; en memoria solo valida el fixture
npm test        # pruebas unitarias e integración MCP sin credenciales
npm run test:mcp
```

Las pruebas fuerzan storage en memoria y no contactan MongoDB ni Gemini.
