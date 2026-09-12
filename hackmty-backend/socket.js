// src/services/socket.js
// Un solo WebSocket compartido por toda la app. Cambia SERVER_URL a la IP de
// tu laptop en la red del hackathon (no "localhost" — el celular no la resuelve).
//
// Ej: si tu backend corre en tu laptop con IP 192.168.1.50:
//   export const SERVER_URL = "ws://192.168.1.50:4000";

export const SERVER_URL = "ws://192.168.1.50:4000";

let socket = null;
const listeners = new Set();

export function connectSocket() {
  if (socket) return socket;

  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => console.log("Conectado al backend");
  socket.onclose = () => console.log("Desconectado del backend");
  socket.onerror = (e) => console.log("Error de socket:", e.message);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    listeners.forEach((cb) => cb(data));
  };

  return socket;
}

/** Suscribirse a mensajes entrantes (componentes A2UI, texto, errores). */
export function onMessage(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback); // función para desuscribirse
}

/** Mandar un mensaje de texto del usuario (escrito o ya transcrito de voz). */
export function sendUserMessage(userId, text) {
  socket?.send(JSON.stringify({ type: "user_message", user_id: userId, text }));
}

/** Confirmar una transferencia generada por la UI. */
export function confirmTransfer(userId, toAlias, amount) {
  socket?.send(
    JSON.stringify({ type: "confirm_transfer", user_id: userId, to_alias: toAlias, amount })
  );
}
