# Banorte Inteligente — aplicación móvil

Cliente Expo/React Native de banca generativa. Se conecta por WebSocket al
backend y renderiza payloads declarativos dentro de un catálogo seguro, sin
ejecutar código enviado por el modelo.

## Navegación

La sesión autenticada usa tres pestañas inferiores:

- **Inicio:** saldos y movimientos recientes.
- **Chat:** solicitudes por texto o voz, formularios y gráficas generadas.
- **Estadísticas:** saldo, crédito, actividad y utilidad de las respuestas.

El login inicia vacío: no enumera usuarios, no prellena credenciales y presenta
el error del backend cuando la identidad no existe.

## Ejecutar

```bash
npm install
npm start
```

`npm start` fuerza el modo Expo Go y genera un QR `exp://` compatible. El
micrófono queda deshabilitado de forma segura porque Expo Go no incluye
`ExpoSpeechRecognition`; en desarrollo se registra este diagnóstico en la
consola, sin detener la aplicación.

Las dependencias nativas identificadas son:

- `expo-speech-recognition`: requiere una build propia para dictado.
- `expo-dev-client`: solo se usa al ejecutar `npm run start:dev`.

No hay drivers de base de datos en el cliente móvil.

En desarrollo, la app obtiene automáticamente la IP del host y usa el puerto
`4000`. Para apuntarla a otro backend:

```bash
EXPO_PUBLIC_WS_URL=ws://192.168.1.50:4000 npm start
```

## Reconocimiento de voz nativo

`expo-speech-recognition` usa `SpeechRecognizer` y el servicio de Google en
Android. En iOS usa `SFSpeechRecognizer`, la API nativa disponible en esa
plataforma. El audio ya no se codifica ni se envía al backend o a Gemini: el
texto reconocido aparece en el compositor para que el usuario lo revise antes
de enviarlo.

El módulo requiere una development build; no está incluido en Expo Go:

```bash
npm run android
# o
npm run ios
```

Después de instalarla, Metro puede iniciarse con `npm run start:dev`.

### Paquete de idioma (español)

Android puede exigir el modelo offline de español cuando el servicio activo es
`com.google.android.as`. La app ya:

1. Usa primero el español ya instalado en el teléfono (`es-US`, `es-MX`, `es-ES`, …).
2. Prefiere Google Search / TTS antes que el motor on-device.
3. Si falta el paquete, abre la descarga del sistema (`androidTriggerOfflineModelDownload`)
   y muestra el botón **Instalar español**.

Si el diálogo no aparece, instálalo a mano:

1. Ajustes → Sistema → Idiomas → **Reconocimiento de voz en el dispositivo**
   (o Ajustes → Google → Ajustes de búsqueda → Voz).
2. Descarga **Español (México)** o **Español**.
3. Actualiza la app **Google** / **Speech Services by Google**.
4. Vuelve a tocar el micrófono en el chat.

La barra inferior se oculta con el teclado, Android usa modo `pan`, iOS ajusta
el contenido con `KeyboardAvoidingView` y el compositor respeta los insets del
dispositivo.

## Componentes generativos admitidos

- `balance_card`
- `contacts_list`
- `transfer_form`
- `transfer_success`
- `credit_plan_table`
- `financial_chart`
- `transactions_summary`
- `transaction_detail`
- `clarification_card`
- `quick_actions`

La tarjeta `transfer_form` recibe `initialValues` con `recipient`, `amount`,
`concept`, `accountNumber` y `bank`. Persona, monto y concepto son editables; la
cuenta validada cambia al seleccionar otro contacto. La confirmación envía el
registro canónico completo.

`financial_chart` acepta `chartType: "bar" | "pie" | "line"` y datos
estructurados. Las gráficas usan `react-native-svg`, que forma parte de los
módulos compatibles con Expo Go. El resumen de operaciones permite abrir el
detalle de cada movimiento dentro del mismo feed.

Todo payload con `interaction_id` incluye el control de calificación. Un toque
registra estrellas completas (2, 4, 6, 8, 10) y una pulsación larga registra
medias estrellas (1, 3, 5, 7, 9).
