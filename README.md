# Banorte × Tec — Generative UI con MCP

> **HackMTY 2026** · Plataforma de banca generativa que convierte solicitudes en lenguaje natural en interfaces financieras interactivas construidas por IA en tiempo real.

El usuario escribe o dicta una solicitud (por ejemplo *"Transfiere $500 a Timo"*), Gemini la interpreta, consulta herramientas de negocio a través de un servidor **MCP** real y devuelve componentes **A2UI** por WebSocket que el cliente renderiza como pantallas nativas listas para operar.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│              APLICACIÓN MÓVIL  (Expo / React Native)            │
│   Login · Saldos · Movimientos · Chat IA · Estadísticas · Voz  │
└──────────────────────────┬──────────────────────────────────────┘
                           │  WebSocket bidireccional (JSON + A2UI)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVIDOR  (Node.js / Express / ws)                  │
│   Auth · Hub WS · Orquestador Gemini · Cliente MCP · Admin API  │
└──────────────────────────┬──────────────────────────────────────┘
                           │  MCP sobre stdio (@modelcontextprotocol/sdk)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVIDOR MCP  (Subproceso independiente)            │
│   19 tools (14 de negocio + 5 de auditoría) · MongoDB Atlas     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              PORTAL ADMINISTRATIVO  (React / Vite)               │
│   Dashboard · Usuarios · Interfaces A2UI · Calificaciones       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tecnologías

### Aplicación móvil — `hackmty-app/`

| Tecnología | Propósito |
|---|---|
| **React Native 0.86** | Framework para la UI nativa multiplataforma (iOS / Android) |
| **Expo SDK 57** | Toolchain de desarrollo, bundling y ejecución móvil |
| **React Navigation** | Navegación inferior con pestañas (Inicio, Chat, Estadísticas) |
| **WebSocket (nativo)** | Comunicación bidireccional en tiempo real con el backend |
| **expo-speech-recognition** | Reconocimiento de voz nativo (STT) en el dispositivo |
| **react-native-svg** | Renderizado de gráficas (barras, pastel, línea) sin librerías incompatibles con Expo Go |
| **Expo Vector Icons** | Iconografía consistente en toda la app |

### Servidor — `hackmty-backend/`

| Tecnología | Propósito |
|---|---|
| **Node.js ≥ 20.19** | Runtime del servidor |
| **Express 5** | API HTTP para el portal admin y endpoints de salud |
| **ws** | Servidor WebSocket que gestiona conexiones, eventos y notificaciones push |
| **@google/genai (Gemini)** | Motor de IA generativa con Function Calling para interpretar intención y generar A2UI |
| **@modelcontextprotocol/sdk** | Protocolo MCP — el servidor MCP corre como subproceso `stdio` |
| **MongoDB 7 (driver)** | Persistencia en Atlas con transacciones atómicas (débito + crédito + registro) |
| **ElevenLabs TTS** | Narración de voz (Text-to-Speech) al tocar el speaker en el chat |
| **Zod** | Validación de esquemas de las tools MCP |
| **dotenv** | Carga de variables de entorno |

### Portal administrativo — `hackmty-admin/`

| Tecnología | Propósito |
|---|---|
| **React 19** | Librería de UI para el portal web |
| **React Router 7** | Enrutamiento SPA (login, dashboard, usuarios, interfaces, ratings) |
| **Axios** | Cliente HTTP para consumir la API administrativa protegida |
| **Vite 7** | Bundler y dev server con HMR ultra-rápido |

---

## Estructura del proyecto

```
HackMTY-2026/
├── hackmty-app/                 # App móvil (Expo / React Native)
│   ├── src/
│   │   ├── screens/             # LoginScreen, DashboardScreen, ChatScreen, StatisticsScreen
│   │   ├── components/          # DynamicUI, Composer, StarRating, AccountOverview, etc.
│   │   ├── context/             # Estado global (BankingProvider)
│   │   ├── navigation/          # Configuración de tabs
│   │   ├── services/            # Lógica de WebSocket
│   │   └── theme.js             # Paleta Banorte (#EB0029, #323E48, #F6F6F6)
│   └── app.json
│
├── hackmty-backend/             # Servidor Node.js
│   ├── server.js                # Hub WebSocket + Express + admin API
│   ├── llm.js                   # Orquestador Gemini con Function Calling
│   ├── mcpClient.js             # Cliente MCP (StdioClientTransport)
│   ├── mcpTools.js              # 19 tools de negocio y auditoría
│   ├── mcp/server.js            # Servidor MCP puro (subproceso)
│   ├── db.js                    # Conexión MongoDB Atlas + fallback a memoria
│   ├── adminRoutes.js           # Rutas HTTP del portal admin
│   ├── adminSession.js          # Sesión admin con cookie HMAC HttpOnly
│   ├── demoData.js              # Fixtures de usuarios de prueba
│   ├── seed.js / seedAdmin.js   # Scripts de seed para datos y admin
│   └── test/                    # Tests con node:test
│
├── hackmty-admin/               # Portal web administrativo (React / Vite)
│   ├── src/
│   │   ├── pages/               # LoginPage, DashboardPage, UsersPage, InterfacesPage, RatingsPage
│   │   ├── components/          # Componentes reutilizables
│   │   ├── api/                 # Cliente Axios configurado
│   │   ├── auth/                # Contexto de autenticación
│   │   └── styles.css           # Estilos globales
│   └── vite.config.js
│
├── DECISIONES_DE_DISENO.md      # 30 decisiones de arquitectura documentadas
└── super_prompt_hackmty_banorte.md  # Especificación completa del reto
```

---

## Cómo correr la aplicación

### Requisitos previos

- **Node.js ≥ 20.19** instalado
- **Expo Go** en el teléfono (para la app móvil) o un emulador Android/iOS
- **MongoDB Atlas** configurado (opcional — sin URI el backend usa datos en memoria)
- **Gemini API Key** para habilitar la IA generativa

### Opción 1 — Inicio manual (tres terminales)

**Terminal 1 — Backend:**
```bash
cd hackmty-backend
npm install
cp .env.example .env       # Configurar GEMINI_API_KEY y MONGODB_URI
npm run seed               # (Opcional) Poblar MongoDB con datos de demo
npm start                  # → http://localhost:4000
```

**Terminal 2 — Portal admin:**
```bash
cd hackmty-admin
npm install
npm run dev                # → http://localhost:5173
```

**Terminal 3 — App móvil:**
```bash
cd hackmty-app
npm install
npx expo start --go --lan --clear
```

Escanear el código QR con Expo Go desde el teléfono.

### Opción 2 — Script automático (PowerShell en Windows)

Este script mata procesos anteriores en los puertos relevantes e inicia las tres aplicaciones en terminales separadas:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\nodejs;$env:Path"
$root = "C:\Users\esvan\esvan\2026\HackMTY-2026"
$node = "$env:LOCALAPPDATA\Programs\nodejs"

@(4000, 5173, 4173, 8081, 8082, 19000, 19001, 19002) | ForEach-Object {
  $port = $_
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

Get-Process node, expo -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit","-Command","`$env:Path='$node;' + `$env:Path; cd '$root\hackmty-backend'; npm start"
Start-Process powershell -ArgumentList "-NoExit","-Command","`$env:Path='$node;' + `$env:Path; cd '$root\hackmty-admin'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit","-Command","`$env:Path='$node;' + `$env:Path; cd '$root\hackmty-app'; npx expo start --go --lan --clear"
```

### Puertos

| Servicio | Puerto | URL |
|---|---|---|
| Backend (API + WebSocket) | `4000` | `http://localhost:4000` |
| Portal admin | `5173` | `http://localhost:5173` |
| Expo (Metro Bundler) | `8081` | Código QR en terminal |

---

## Ejemplo de uso

### 1. Login
Abrir la app → ingresar con uno de los usuarios de prueba (ej. `Mau`, contraseña `1234`).

### 2. Consultar saldo
En la pestaña **Chat**, escribir:
> *"¿Cuánto dinero tengo?"*

La IA consulta las cuentas vía MCP y responde con una **tarjeta de balance** interactiva.

### 3. Visualizar movimientos
Escribir:
> *"Muéstrame una gráfica de mis movimientos"*

Se genera una **gráfica** (barras, pastel o línea) con datos reales del usuario.

### 4. Transferir dinero
Escribir o dictar por voz:
> *"Transfiere $500 a Timo por la cena"*

La IA genera un **formulario precargado** con destinatario, monto y concepto. El usuario revisa, edita si es necesario y confirma. Aparece el **comprobante**, se actualiza el saldo y el destinatario recibe una **notificación push** en tiempo real.

### 5. Portal admin
Desde el navegador en `http://localhost:5173`, ingresar con `admin` / `1`. Se puede auditar: usuarios registrados, interfaces A2UI generadas y calificaciones de las interacciones.

---

## Variables de entorno

Consultar `hackmty-backend/.env.example` para la lista completa:

| Variable | Descripción | Default |
|---|---|---|
| `MONGODB_URI` | Conexión a Atlas; sin ella se activa modo efímero en memoria | — |
| `MONGODB_REQUIRED` | Impide fallback a memoria cuando es `true` | `false` |
| `MONGODB_DB_NAME` | Nombre de la base de datos | `hackmty_db` |
| `GEMINI_API_KEY` / `LLM_API_KEY` | Llave para habilitar Gemini | — |
| `GEMINI_MODEL` | Modelo de Gemini a usar | `gemini-3.6-flash` |
| `ELEVENLABS_API_KEY` | Llave de ElevenLabs para narración TTS en el chat | — |
| `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL_ID` | Voz y modelo de ElevenLabs | — |
| `ELEVENLABS_SPEED` | Velocidad de narración (`0.7`–`1.2`) | `1.0` |
| `DEMO_PASSWORD` | Contraseña compartida para usuarios demo | `1234` |
| `ADMIN_SESSION_SECRET` | Firma las sesiones del portal admin | — |
| `ADMIN_ALLOWED_ORIGINS` | Orígenes web adicionales permitidos para CORS | — |
| `PORT` | Puerto del backend | `4000` |

---

## Verificación

```bash
cd hackmty-backend && npm test
cd ../hackmty-app && npm run check
cd ../hackmty-admin && npm run build
```

- `npm test` — ejecuta los tests del backend con `node:test`.
- `npm run check` — genera bundles de validación para iOS, Android y web sin necesidad de simulador.
- `npm run build` — compila el portal admin para producción.

---

## Equipo

Desarrollado para **HackMTY 2026** — Reto **Banorte × Tec de Monterrey**: *Interfaces Financieras que la IA Construye en Tiempo Real.*
