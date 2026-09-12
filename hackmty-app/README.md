# Banorte A2UI — aplicación móvil

Cliente Expo/React Native del demo de banca generativa. Se conecta por
WebSocket al backend, autentica una identidad de prueba y renderiza los
payloads A2UI sin ejecutar código enviado por el modelo.

## Ejecutar

```bash
npm install
npm start
```

En desarrollo, la app obtiene automáticamente la IP del host de Expo y usa el
puerto `4000`. Para apuntarla a otro backend:

```bash
EXPO_PUBLIC_WS_URL=ws://192.168.1.50:4000 npm start
```

El teléfono y la computadora deben estar en la misma red. Las cuentas de demo
son `Mau`, `Timo`, `Esteban` y `Brau`; la contraseña predeterminada es `1234`.
También puede abrirse con `npm run web`, útil para mantener una segunda sesión
conectada y demostrar la notificación al destinatario.

## Voz

El botón de micrófono graba hasta 15 segundos con `expo-audio`, codifica el
archivo local y lo envía como `audio_stream`. La transcripción ocurre en el
backend, por lo que requiere una llave de Gemini configurada ahí.

## Componentes A2UI admitidos

- `balance_card`
- `contacts_list`
- `transfer_form`
- `transfer_success`
- `credit_plan_table`
- `clarification_card`
- `quick_actions`

Todo payload con `interaction_id` incluye el control de calificación. Un toque
registra estrellas completas (2, 4, 6, 8, 10) y una pulsación larga registra
medias estrellas (1, 3, 5, 7, 9).
