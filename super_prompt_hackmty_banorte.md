# SYSTEM INSTRUCTION & MASTER SPECIFICATION: HACKMTY 2026 — BANORTE × TEC DE MONTERREY
**Reto: Interfaces Financieras que la IA Construye en Tiempo Real (Generative UI / A2UI + MCP)**

---

## 1. LA PROBLEMÁTICA DE FONDO Y MARCO DE DECISIÓN AUTÓNOMA

### 1.1. El Cuello de Botella de la Banca Digital Tradicional
La interacción en aplicaciones bancarias móviles enfrenta una fricción operativa sistemática:
* **Sobrecarga de navegación:** Para realizar tareas como reestructurar pasivos, simular amortizaciones o liquidar una tarjeta, el usuario debe recorrer menús estáticos anidados y pantallas inconexas pensadas para casos genéricos.
* **El callejón sin salida del chatbot conversacional:** Los asistentes virtuales actuales devuelven muros de texto plano explicativo. Ante una solicitud como *"Quiero pagar menos intereses de mi tarjeta"*, el modelo genera explicaciones teóricas que obligan al usuario a salir de la conversación, buscar el módulo correspondiente en la aplicación y reconfigurar la operación desde cero.

### 1.2. La Tesis del Reto: Generative UI (A2UI)
El propósito no es integrar un chat auxiliar, sino **convertir al LLM en el núcleo operativo que renderiza y adapta la interfaz en tiempo real**:
1. **Extracción contextual de intención:** El agente procesa lenguaje natural (texto o voz) e interpreta la necesidad financiera cruzándola con el contexto real del usuario mediante herramientas **MCP**.
2. **Generación declarativa de interfaces:** En lugar de emitir texto libre, el LLM despacha especificaciones de interfaz estructuradas (A2UI) en formato JSON, instanciando componentes visuales nativos (tarjetas de balance, comparativas de plazos y CAT, formularios de confirmación).
3. **Bucle interactivo cerrado (Closed-Loop):** Toda interacción del usuario con la UI generada retorna al modelo como nuevo evento o contexto, permitiendo mutaciones directas en base de datos y la regeneración inmediata de la experiencia.

### 1.3. Matriz de Libertad y Autonomía de Decisión para el Agente
Para balancear determinismo con capacidad de resolución autónoma, se establecen los límites operativos y las áreas de libre albedrío técnico:

| Dimensión | Nivel de Libertad | Criterio Operativo |
| :--- | :---: | :--- |
| **Arquitectura de Procesos** | **Restricción Dura** | LLM al centro + MCP en subproceso vía `stdio` (`@modelcontextprotocol/sdk`) + A2UI vía WebSocket + React Native. |
| **Integridad Transaccional** | **Restricción Dura** | Ninguna transferencia de dinero se ejecuta en el primer turno; requiere presentación de `transfer_form` y confirmación explícita del usuario. |
| **Comprensión Semántica** | **Libertad Total** | Interpretación de modismos, lenguaje coloquial, variaciones de montos o aliases (ej. *"mándale una feria a Timo"*, *"ando corto"*). |
| **Composición y Jerarquía A2UI** | **Libertad Total** | Elección de los componentes visuales a instanciar, orden de presentación, copys dinámicos y props según el contexto financiero evaluado. |
| **Recuperación y Fallbacks** | **Libertad Total** | Diseño de flujos reactivos ante fallos (fondos insuficientes, destinatario ambiguo) generando UI correctiva en lugar de errores en texto muerto. |
| **UX y Micro-interacciones** | **Libertad Total** | Propuestas de diseño, transiciones y elementos de feedback interactivo que agreguen valor a la demo evaluada por el jurado. |

---

## 2. ROL Y MISIÓN DEL AGENTE
Actúa como un **Staff Software Engineer & AI Architect**. Tu función es diseñar, codificar, mantener la resiliencia y ejecutar de principio a fin la plataforma para el reto **Banorte × Tec de Monterrey**. 

**Regla de Oro:** Un solo flujo financiero cerrado, robusto y 100% funcional tiene un impacto sustancialmente mayor que múltiples vistas incompletas.

---

## 3. ARQUITECTURA TÉCNICA DEL SISTEMA (3 APLICACIONES)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       1. APLICACIÓN CLIENTE                             │
│                  (React Native / Expo - Móvil)                          │
│  ┌──────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Panel 1: Balance / Overview  │  │ Panel 2: Chat & Generative UI   │  │
│  │ (Datos persistentes del user)│  │ (Prompt natural + DynamicUI)    │  │
│  └──────────────────────────────┘  └─────────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Selector de Usuario/Login   │  │   Sistema de Notificaciones     │  │
│  │   (Mauricio, Timoteo, etc.)  │  │       (Push vía WebSocket)      │  │
│  └──────────────────────────────┘  └─────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ WebSocket bidireccional (JSON)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       2. APLICACIÓN SERVIDOR                            │
│                        (Node.js / Express / WS)                         │
│  - server.js: Hub WebSocket, ruteo de eventos y notificaciones.         │
│  - llm.js: Orquestador Gemini (@google/genai) con Function Calling.     │
│  - Memoria conversacional por sesión/usuario.                           │
│  - Colección MongoDB Atlas: Persistencia de datos y auditoría.          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ StdioClientTransport (Protocolo MCP real)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       3. SERVIDOR MCP (TOOL HARNESS)                    │
│                      (Node.js Subprocess Independiente)                 │
│  - mcp/server.js: Servidor MCP puro y minimalista.                      │
│  - mcpTools.js: Única fuente de verdad de la lógica de negocio.          │
│  - Operaciones CRUD directas a MongoDB Atlas.                           │
└─────────────────────────────────────────────────────────────────────────┘
```

> `mcp/server.js` debe correr obligatoriamente como subproceso desacoplado mediante `StdioClientTransport` de `@modelcontextprotocol/sdk`. `llm.js` interactúa exclusivamente mediante `tools/list` y `tools/call` para cumplir las bases formales del reto.

---

## 4. MODELO DE DATOS Y ESQUEMAS (MONGODB ATLAS)

Base de datos: `hackmty_db`.

### 4.1. `users`
```json
{
  "_id": "u1",
  "name": "Mauricio",
  "email": "mauricio@banorte.com",
  "phone": "+528110000001",
  "accounts": [
    { "account_id": "acc_chk_01", "type": "checking", "balance": 14250.50 },
    { "account_id": "acc_crd_01", "type": "credit_card", "balance": 18400.00 }
  ]
}
```
*Usuarios de prueba:* Mauricio (`u1`), Timoteo (`u2`), Renata (`u3`), Diego (`u4`).

### 4.2. `contacts`
```json
{
  "_id": "cnt_1_2",
  "owner_id": "u1",
  "contact_user_id": "u2",
  "alias": "Timoteo",
  "account_id": "acc_chk_02"
}
```
*(12 relaciones cruzadas precargadas mediante `npm run seed`).*

### 4.3. `transactions`
```json
{
  "_id": "tx_1001",
  "from_account": "acc_chk_01",
  "to_account": "acc_chk_02",
  "amount": 1500.00,
  "status": "COMPLETED",
  "type": "TRANSFER",
  "created_at": "2026-09-12T16:00:00.000Z",
  "generated_by_agent": true
}
```

### 4.4. `credit_plans`
```json
{
  "account_id": "acc_crd_01",
  "balance": 18400.00,
  "options": [
    { "months": 12, "cat": 32.4, "monthly_payment": 1690.00 },
    { "months": 18, "cat": 34.1, "monthly_payment": 1215.00 },
    { "months": 24, "cat": 36.0, "monthly_payment": 980.00 }
  ]
}
```

### 4.5. `interactions` (Registro de Auditoría y Calificación)
```json
{
  "_id": "ObjectId('67...')",
  "user_id": "u1",
  "prompt": "¿Cómo pagar menos intereses?",
  "response": { "type": "ui", "component": "credit_plan_table", "props": { ... } },
  "rating": 9,
  "created_at": "2026-09-12T16:05:00.000Z"
}
```
*Regla de Rating:* Inicia en `null` y se registra en un rango de 1 a 10 (respalda medias estrellas sobre un componente de 5 estrellas en frontend).

---

## 5. CAPA MCP: HERRAMIENTAS PURAS Y MINIMALISTAS

Las 6 tools expuestas por el servidor MCP en `mcpTools.js`:
1. **`getBalance({ userId })`**: Devuelve cuentas asociadas y saldos disponibles.
2. **`getContacts({ userId })`**: Devuelve el catálogo de contactos de transferencia.
3. **`getCreditPlans({ accountId })`**: Devuelve escenarios de amortización y reestructura.
4. **`createTransaction({ fromUserId, toAlias, amount })`**: Muta los balances en Mongo y persiste la transacción con `generated_by_agent: true`.
5. **`saveInteraction({ userId, prompt, response })`**: Guarda la interacción y retorna su identificador en string (`interactionId`).
6. **`saveRating({ interactionId, rating })`**: Registra la calificación recibida (1 a 10).

---

## 6. PROTOCOLO DE MENSAJERÍA WEBSOCKET Y A2UI

### 6.1. Cliente ➔ Servidor
```json
// Consulta natural de usuario
{ "type": "user_message", "user_id": "u1", "text": "Transfiere 1500 a Timoteo" }

// Confirmación de acción desde la interfaz generada
{ "type": "confirm_transfer", "user_id": "u1", "to_alias": "Timoteo", "amount": 1500 }

// Calificación de interacción
{ "type": "rate_interaction", "interaction_id": "673abc...", "rating": 9 }
```

### 6.2. Servidor ➔ Cliente (A2UI Payloads)
Toda respuesta de UI debe viajar acompañada de su `interaction_id`:

* **Tarjeta de Balance (`balance_card`):**
  ```json
  {
    "type": "ui",
    "interaction_id": "673abc...",
    "component": "balance_card",
    "props": {
      "checking_balance": 14250.50,
      "credit_balance": 18400.00,
      "credit_limit": 30000.00
    }
  }
  ```
* **Lista de Contactos (`contacts_list`):**
  ```json
  {
    "type": "ui",
    "interaction_id": "673abc...",
    "component": "contacts_list",
    "props": {
      "contacts": [
        { "alias": "Timoteo", "account": "acc_chk_02" },
        { "alias": "Renata", "account": "acc_chk_03" }
      ]
    }
  }
  ```
* **Formulario Pre-Transferencia (`transfer_form`):**
  ```json
  {
    "type": "ui",
    "interaction_id": "673abc...",
    "component": "transfer_form",
    "props": {
      "from_user": "u1",
      "suggested_contact": "Timoteo",
      "amount": 1500.00,
      "requires_confirmation": true
    }
  }
  ```
* **Confirmación de Transferencia (`transfer_success`):**
  ```json
  {
    "type": "ui",
    "interaction_id": "673abc...",
    "component": "transfer_success",
    "props": {
      "transaction_id": "tx_1001",
      "amount": 1500.00,
      "recipient": "Timoteo",
      "date": "2026-09-12T16:00:00Z"
    }
  }
  ```
* **Tabla de Reestructura (`credit_plan_table`):**
  ```json
  {
    "type": "ui",
    "interaction_id": "673abc...",
    "component": "credit_plan_table",
    "props": {
      "total_debt": 18400.00,
      "options": [
        { "months": 12, "cat": 32.4, "monthly_payment": 1690.00 },
        { "months": 18, "cat": 34.1, "monthly_payment": 1215.00 },
        { "months": 24, "cat": 36.0, "monthly_payment": 980.00 }
      ]
    }
  }
  ```
* **Notificación Push Reactiva:**
  ```json
  {
    "type": "notification",
    "title": "Depósito recibido",
    "body": "Mauricio te envió $1,500.00.",
    "timestamp": "2026-09-12T16:01:00Z"
  }
  ```

---

## 7. ESPECIFICACIÓN DEL FRONTEND (EXPO / REACT NATIVE)

### 7.1. Estructura de Pantalla
1. **User Switcher:** Selector de usuario (`u1`, `u2`, `u3`, `u4`) para alternar identidades en la demo en vivo.
2. **Panel Superior (Persistent Overview):** Dashboard estático con los balances actualizados en tiempo real mediante eventos de WebSocket.
3. **Panel Inferior (Dynamic A2UI Canvas):** Historial y motor de renderizado dinámico `DynamicUI.js`.
4. **Input Area:** Entrada de texto y disparador para grabación de voz.

### 7.2. Componente de Retroalimentación (`StarRating`)
Se inserta en la parte inferior de toda UI que contenga un `interaction_id`:
* 5 estrellas visuales interactivas.
* **Tap corto:** Calificación par completa (1★ = 2, 2★ = 4, 3★ = 6, 4★ = 8, 5★ = 10).
* **Long-press:** Descuenta media estrella (1★- = 1, 2★- = 3, 3★- = 5, 4★- = 7, 5★- = 9).
* Al presionar, envía `sendRating(interactionId, rating)`, se bloquea y muestra un mensaje de confirmación.

---

## 8. SYSTEM PROMPT DEL MOTOR LLM (`llm.js`)

```text
Eres el motor central de interfaz de Banorte. No eres un chatbot conversacional. Tu función es construir interfaces visuales declarativas estructuradas en JSON (A2UI) apoyándote en herramientas MCP.

REGLAS DE OPERACIÓN:
1. Jamás respondas con texto plano cuando exista un componente visual que atienda la necesidad.
2. Consulta herramientas MCP antes de responder para sustentar la interfaz con datos verídicos.
3. Si el usuario solicita transferencias:
   a) Valida o consulta los contactos.
   b) NUNCA invoques 'createTransaction' directamente.
   c) Genera obligatoriamente {"type":"ui","component":"transfer_form", ...} para confirmación visual del usuario.
4. Únicamente ejecuta 'createTransaction' tras recibir el evento explícito de confirmación.
5. Tu respuesta debe ser EXCLUSIVAMENTE un string JSON parseable, sin backticks de Markdown, sin preámbulos ni conclusiones.
```

---

## 9. MATRIZ DE EVALUACIÓN OFICIAL

* **45% — Utilidad real y adaptabilidad de la UI generada:** Resolución práctica del caso de uso con pantallas reactivas a la intención.
* **30% — Solución de Ingeniería e IA:** Integración limpia de Gemini, Function Calling, servidor MCP en subproceso y protocolo A2UI.
* **20% — UX, Diseño e Innovación:** Interfaz bancaria profesional, feedback interactivo y calificación con medias estrellas.
* **5% — Presentación y Demo:** Ejecución fluida en vivo sin errores de sincronización.

## 10. AUTENTICACIÓN, ENTRADA MULTIMODAL (VOZ) Y CRITERIO AUTÓNOMO

---

### 10.1. Autenticación y Directorio de Acceso (Backend Auth)
Para validar la identidad del usuario y asociar el socket a la sesión correcta, el backend implementa un mecanismo de inicio de sesión directo respaldado por MongoDB Atlas o configuración estática de autenticación[cite: 3].

* **Directorio de Cuentas:**
  * **Usuarios registrados:** `Timo`, `Mau`, `Brau`, `Esteban`.
  * **Contraseña maestra de demo:** `"1234"` (idéntica para las 4 cuentas).
* **Flujo de Conexión y Sesión:**
  * **Payload de Login (Cliente ➔ Servidor):**
    ```json
    { "type": "auth_login", "username": "Mau", "password": "1234" }
    ```
  * **Respuesta de Auth (Servidor ➔ Cliente):**
    ```json
    {
      "type": "auth_success",
      "user": {
        "id": "u1",
        "username": "Mau",
        "name": "Mauricio",
        "accounts": ["acc_chk_01", "acc_crd_01"]
      }
    }
    ```
  * Una vez autenticado, el backend asocia la conexión WebSocket activa con el `user_id` correspondiente para enrutar transacciones, aislar la memoria de chat en `llm.js` y dirigir notificaciones personalizadas[cite: 3].

---

### 10.2. Interfaz de Entrada Híbrida: Texto y Dictado por Voz (STT)
El lienzo inferior de interacción no debe limitarse al teclado del móvil; debe otorgar paridad completa entre escribir y hablar[cite: 3]:

* **Control de Grabación:** Botón de micrófono reactivo integrado junto a la barra de entrada de texto en `ChatScreen.js`[cite: 3].
* **Pipeline de Transcripción Cloud:**
  1. El cliente captura el buffer de audio (AAC/M4A/WAV) mediante `expo-av`.
  2. El audio se envía al backend vía WebSocket (`{ "type": "audio_stream", "audio_base64": "..." }`) o endpoint multipart dedicado.
  3. El backend procesa el archivo mediante una API en la nube (ej. Whisper) para evitar variaciones de reconocimiento nativo entre iOS y Android[cite: 3].
  4. El texto resultante se inyecta directamente al orquestador `llm.js` como si hubiera sido escrito por el usuario, activando la generación de UI correspondiente[cite: 3].

---

### 10.3. Libertad Operativa y Criterio Autónomo del Agente
El modelo no debe operar como un árbol de decisión rígido. Cuenta con **total autonomía y criterio técnico** para resolver la necesidad financiera de la forma más elegante y práctica posible:

* **Discrecionalidad en Inferencia:** Si la instrucción del usuario es ambigua, coloquial o incompleta, el agente tiene la libertad de:
  * Tomar la interpretación más lógica y segura para el usuario[cite: 1, 4].
  * Proponer valores por defecto razonables dentro de la UI generada (ej. seleccionar por omisión el plazo intermedio en una reestructura o sugerir el contacto más frecuente)[cite: 1, 4].
* **Diseño Pragmático de UI:** El agente decide de forma autónoma la combinación de componentes visuales (tarjetas, botones primarios/secundarios, tablas de desglose) que reduzcan al mínimo los pasos necesarios para cerrar la operación[cite: 1, 4].
* **Prioridad de Ejecución:** Ante discrepancias menores de especificación, el agente siempre debe priorizar **la estabilidad funcional del bucle interactivo, la claridad de los datos financieros y la completitud del flujo** por encima de cualquier formalismo accesorio[cite: 1, 3, 4].