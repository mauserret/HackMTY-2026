# Banorte × Tec — Generative UI con MCP

Plataforma de banca generativa para HackMTY 2026. Una solicitud en lenguaje
natural se interpreta con Gemini, consulta herramientas de negocio a través de
un servidor MCP real y devuelve componentes A2UI por WebSocket.

## Arquitectura

```text
Expo / React Native
        │  WebSocket (eventos + A2UI)
        ▼
Node.js / Express / ws
        │  MCP sobre stdio
        ▼
Subproceso MCP ── mcpTools ── MongoDB Atlas
```

- `hackmty-app/`: login, navegación inferior, saldos, movimientos, chat
  generativo, métricas, voz nativa, notificaciones y rating.
- `hackmty-backend/`: autenticación, hub WebSocket, orquestador Gemini, cliente
  MCP, servidor MCP, datos y auditoría.
- `hackmty-admin/`: portal web React/Vite independiente para auditar usuarios,
  interfaces A2UI y calificaciones mediante una API protegida.
- `DECISIONES_DE_DISENO.md`: decisiones y discrepancias resueltas durante la
  implementación.

## Inicio rápido

### 1. Backend

```bash
cd hackmty-backend
npm install
cp .env.example .env
npm start
```

Sin `MONGODB_URI`, el backend usa datos efímeros en memoria para facilitar la
demo. Para persistencia real, configura Atlas y ejecuta:

```bash
npm run seed
npm start
```

El servidor queda en `http://localhost:4000`; el WebSocket comparte el mismo
puerto. Verifica el estado en `GET /health`.

### 2. Aplicación móvil

```bash
cd hackmty-app
npm install
npm start
```

Expo detecta la IP de la computadora. Si la red requiere una dirección
explícita:

```bash
EXPO_PUBLIC_WS_URL=ws://192.168.1.50:4000 npm start
```

El formulario no muestra usuarios ni credenciales predeterminadas. Para probar
el reconocimiento de voz se necesita una development build:

```bash
npm run android # o: npm run ios
npm run start:dev
```

El módulo de voz no está incluido en Expo Go; allí se omite de forma segura.

### 3. Portal administrativo

En una terminal prepara la cuenta administrativa e inicia el backend:

```bash
cd hackmty-backend
npm run seed:admin
npm start
```

En otra terminal:

```bash
cd hackmty-admin
npm install
npm run dev
```

Abre `http://localhost:5173` e ingresa con `admin` / `1`. Vite escucha en todas
las interfaces de red, por lo que también puede abrirse en
`http://IP_LOCAL:5173`.

## Recorrido recomendado

1. Inicia con un usuario existente del fixture.
2. Revisa el saldo y los movimientos en **Inicio**.
3. En **Chat**, pregunta: **“¿Cuánto dinero tengo?”**
4. Pide: **“Muéstrame una gráfica de mis movimientos.”**
5. Escribe **“Transfiere $500 a Timo por la cena”**, revisa los campos
   precargados, modifica alguno y confirma.
6. Observa el comprobante, el nuevo saldo y la notificación en una sesión
   conectada como `Timo`.
7. Abre **Estadísticas** para ver las métricas actualizadas.
8. Mantén presionada una estrella para registrar una media estrella.

## Variables principales

Consulta `hackmty-backend/.env.example` para la lista completa:

- `MONGODB_URI`: conexión Atlas; si falta o falla puede activarse el modo
  efímero.
- `MONGODB_REQUIRED`: impide fallback a memoria cuando es `true`.
- `MONGODB_DB_NAME`: por defecto `hackmty_db`.
- `GEMINI_API_KEY` o `LLM_API_KEY`: habilita Gemini para el chat.
- `GEMINI_MODEL`: por defecto `gemini-3.6-flash`.
- `DEMO_PASSWORD`: por defecto `1234`.
- `ADMIN_SESSION_SECRET`: firma las sesiones administrativas.
- `ADMIN_ALLOWED_ORIGINS`: orígenes web adicionales permitidos.
- `PORT`: por defecto `4000`.

## Verificación

```bash
cd hackmty-backend && npm test
cd ../hackmty-app && npm run check
cd ../hackmty-admin && npm run build
```

El segundo comando genera bundles de validación para iOS, Android y web sin
necesitar un simulador.
