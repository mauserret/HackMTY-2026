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

- `hackmty-app/`: login, overview, conversación, renderizador A2UI, voz,
  notificaciones y rating.
- `hackmty-backend/`: autenticación, hub WebSocket, orquestador Gemini, cliente
  MCP, servidor MCP, datos y auditoría.
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

Usuarios: `Mau`, `Timo`, `Esteban`, `Brau`. Contraseña de demo: `1234`.

## Recorrido recomendado

1. Inicia como `Mau`.
2. Pregunta: **“¿Cuánto dinero tengo?”**
3. Pide: **“Mándale una feria de 1,500 a Timo.”**
4. Revisa el formulario generado y confirma.
5. Observa el comprobante, el nuevo saldo y la notificación en una sesión
   conectada como `Timo`.
6. Mantén presionada una estrella para registrar una media estrella.
7. Prueba: **“Quiero pagar menos intereses de mi tarjeta.”**

## Variables principales

Consulta `hackmty-backend/.env.example` para la lista completa:

- `MONGODB_URI`: conexión Atlas; si falta se activa el modo efímero.
- `MONGODB_DB_NAME`: por defecto `hackmty_db`.
- `GEMINI_API_KEY` o `LLM_API_KEY`: habilita Gemini y transcripción.
- `GEMINI_MODEL`: por defecto `gemini-3.6-flash`.
- `DEMO_PASSWORD`: por defecto `1234`.
- `PORT`: por defecto `4000`.

## Verificación

```bash
cd hackmty-backend && npm test
cd ../hackmty-app && npm run check
```

El segundo comando genera bundles de validación para iOS, Android y web sin
necesitar un simulador.
