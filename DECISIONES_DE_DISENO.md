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
   `credit_plan_table`, `clarification_card` y `quick_actions`. Nunca se evalúa
   código recibido por WebSocket.
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
10. **La transcripción usa Gemini con audio inline.** Evita sumar otro
    proveedor y otra credencial. La grabación se limita a 15 segundos y el
    servidor valida tipo y tamaño antes de enviarla al modelo.
11. **MongoDB Atlas es la persistencia objetivo, con memoria para onboarding.**
    Sin `MONGODB_URI` el subproceso MCP crea datos efímeros para ejecutar la
    demo inmediatamente. Esta modalidad no se presenta como persistente y se
    reinicia con el proceso.

## Datos y demo

12. **Se resolvió la discrepancia de usuarios a favor del bloque de
    autenticación y del backend existente.** Las identidades son Mauricio
    (`Mau`, `u1`), Timoteo (`Timo`, `u2`), Esteban (`Esteban`, `u3`) y Braulio
    (`Brau`, `u4`), con contraseña maestra configurable cuyo valor de demo es
    `1234`.
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
17. **El overview permanece visible y el lienzo A2UI es desplazable.** Así el
    usuario conserva contexto financiero mientras la conversación produce
    formularios, comparativas y comprobantes.
18. **La URL WebSocket se detecta desde Expo.** Esto evita editar código para
    probar en un teléfono; `EXPO_PUBLIC_WS_URL` sigue disponible para redes o
    despliegues particulares.
