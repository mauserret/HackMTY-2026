# Decisiones de diseño y arquitectura

Este documento registra las decisiones tomadas al convertir el prototipo en
una aplicación demostrable. Las restricciones del reto tienen prioridad sobre
estas decisiones.

## Producto y alcance

1. **La transferencia es el flujo principal cerrado.** Se priorizó que pedir,
   revisar, confirmar, ejecutar, actualizar saldos y notificar al receptor
   funcione de punta a punta. Saldo, contactos y reestructura complementan la
   demo, pero no simulan operaciones que el backend aún no puede formalizar.
2. **La interfaz generada se limita a un catálogo seguro.** El modelo envía
   datos declarativos y el cliente solo acepta componentes conocidos:
   `balance_card`, `contacts_list`, `transfer_form`, `transfer_success`,
   `credit_plan_table`, `financial_chart`, `transactions_summary`,
   `transaction_detail`, `clarification_card` y `quick_actions`. Nunca se
   evalúa código recibido por WebSocket.
3. **Los errores también son interfaz.** Datos faltantes, solicitudes ambiguas
   y fallos recuperables se convierten en tarjetas y opciones accionables; no
   se dejan como texto técnico sin salida.

## Seguridad e integridad

4. **La identidad pertenece al socket, no al payload.** Después del login, el
   servidor ignora cualquier `user_id` forjado y usa la identidad asociada a la
   conexión.
5. **Una transferencia requiere una intención pendiente del servidor.** El
   primer turno solo crea un `transfer_form` con `request_id`. La confirmación
   debe corresponder a esa solicitud, se consume una sola vez y la operación
   usa una clave idempotente para evitar cobros dobles.
6. **El LLM no recibe la tool de escritura durante mensajes ordinarios.**
   `createTransaction` solo se invoca desde el manejador de confirmación
   explícita y siempre a través de MCP.
7. **Las operaciones en Mongo intentan ser atómicas.** En Atlas se utiliza una
   transacción para débito, crédito y registro. El modo de memoria es solo un
   respaldo local de demo y se identifica como tal en `/health`.

## IA, MCP y resiliencia

8. **Se conserva `@modelcontextprotocol/sdk`.** Aunque existe una generación
   posterior del SDK, el reto exige explícitamente este paquete. El servidor
   MCP corre en un subproceso `stdio`; el orquestador descubre esquemas con
   `tools/list` y ejecuta con `tools/call`.
9. **Gemini se inicializa de forma diferida.** La app puede arrancar, autenticar
   y demostrar el flujo sin filtrar secretos ni fallar por una llave ausente.
   Con llave configurada, Gemini es el centro semántico; si el proveedor falla,
   un intérprete local conservador mantiene disponible la demo y también
   consulta datos mediante MCP.
10. **La voz se convierte a texto en el dispositivo.** Se eligió
    `expo-speech-recognition` porque integra `SpeechRecognizer` con el servicio
    de Google en Android y encaja con Expo SDK 57. En iOS usa la API nativa
    `SFSpeechRecognizer`. La app no empaqueta audio ni lo envía al backend o a
    Gemini; el servicio nativo aplica su propia política de procesamiento. El
    usuario puede revisar la transcripción antes de enviarla. Como Expo Go no
    admite módulos nativos de terceros, los scripts móviles generan una
    development build; una carga accidental en Expo Go degrada solo el
    micrófono y no cierra toda la aplicación.
11. **MongoDB Atlas es la persistencia objetivo, con memoria para onboarding.**
    Sin `MONGODB_URI`, o si Atlas no está disponible y Mongo no fue marcado como
    obligatorio, el subproceso MCP crea datos efímeros para ejecutar la demo.
    `/health` siempre comunica si hay persistencia y la causa del fallback.

## Datos y demo

12. **El formulario no enumera ni prellena identidades.** El fixture conserva
    usuarios para que la demo pueda autenticarlos, pero ni el socket ni la UI
    publican la lista. Usuario inexistente y contraseña incorrecta tienen
    códigos y mensajes distintos.
13. **Las calificaciones se almacenan en escala 1–10.** El cliente presenta
    cinco estrellas: toque para valores pares y pulsación larga para valores
    impares. Una vez enviada, la interacción se bloquea para evitar cambios
    accidentales.

## Interfaz

14. **Se siguió el kit de Banorte como sistema, no como una sola pantalla.**
    Se respetan el rojo `#EB0029`, gris `#323E48`, fondos `#F6F6F6`, campos de
    50 px, botón primario de 45 px, radios contenidos y jerarquía tipográfica
    en múltiplos de cinco cuando aplica.
15. **El logotipo se representa únicamente como wordmark completo.** No se usa
    la brújula aislada, en línea con la restricción del kit.
16. **Gotham no se incrusta porque el repositorio no incluye archivos de fuente
    ni licencia.** Se usa una familia de sistema de geometría cercana
    (`Avenir Next` en iOS y sans-serif en Android). Si se entregan archivos
    Gotham autorizados, el tema central permite sustituirla en un solo punto.
17. **El contenido principal se separó en tres pestañas.** Inicio conserva
    saldos y movimientos, Chat concentra la interfaz generativa y Estadísticas
    presenta métricas derivadas. Se eligió React Navigation para obtener una
    barra inferior accesible y con estado independiente por pestaña.
18. **Chat tiene una política explícita para teclado e insets.** La barra
    inferior se oculta con el teclado, Android usa layout `pan`, iOS usa
    `KeyboardAvoidingView` y el compositor reserva el inset inferior. Micrófono
    y envío comparten una fila de 44 px para permanecer alcanzables.
19. **La sigla técnica no aparece como etiqueta de producto.** Se sustituyó en
    wordmark, encabezados, login y nombre visible de la app por lenguaje
    orientado al usuario; solo se conserva en documentación y contratos
    internos cuando es técnicamente necesario. El nombre, slug, scheme y los
    identificadores de paquete móviles también se renombraron para evitar que
    la sigla reaparezca en superficies del sistema operativo.
20. **Las gráficas se hidratan con datos del servidor.** El modelo puede elegir
    `financial_chart`, pero el backend reemplaza sus valores con agregaciones
    de `get_financial_summary`, evitando cifras inventadas.
21. **Se corrigió la frontera MongoDB–MCP en dos capas.** El rechazo TLS de
    Atlas se clasifica sin exponer la URI y permite fallback controlado; el seed
    exige Mongo cuando hay URI. Además, los índices nuevos son parciales y el
    seed conecta antes de crearlos, lo que permite migrar bases con documentos
    legacy.
22. **La URL WebSocket se detecta desde Expo.** Esto evita editar código para
    probar en un teléfono; `EXPO_PUBLIC_WS_URL` sigue disponible para redes o
    despliegues particulares.
23. **El comando predeterminado prioriza Expo Go.** La presencia de
    `expo-dev-client` hacía que Expo generara por defecto un enlace para el
    cliente personalizado. `npm start` ahora fuerza `--go`; el modo nativo se
    inicia explícitamente con `npm run start:dev`. El reconocimiento de voz se
    obtiene con `requireOptionalNativeModule`, así que su ausencia nunca impide
    abrir el resto de la app.
24. **Las transferencias se representan como formularios adaptativos.** El
    backend extrae persona, monto y concepto y los entrega en `initialValues`.
    La tarjeta siempre muestra inputs editables, incluso si la extracción quedó
    incompleta. La confirmación explícita usa los valores revisados por el
    usuario y MCP conserva la validación de contacto, fondos e idempotencia.
25. **El catálogo MCP se amplió sin romper consumidores anteriores.** Se
    conservaron las seis tools camelCase y se agregaron seis operaciones
    snake_case para contactos, cuentas y analítica. El gateway valida las 12 y
    las pruebas invocan cada nueva familia de operaciones.
26. **Contacto visible y destino bancario son un solo registro canónico.** Un
    resolver puntúa alias, apodo, primer nombre, nombre completo, cuenta y
    errores tipográficos cortos. La transferencia transporta `contact_id`,
    alias y `accountNumber`; si pertenecen a registros distintos, MCP rechaza
    la operación.
27. **Las gráficas no incorporan otro módulo incompatible con Expo Go.**
    Barras, pastel y línea se renderizan con `react-native-svg`, versión
    alineada por Expo. El backend decide el tipo a partir de la solicitud y
    entrega únicamente datos estructurados.
