import Constants from "expo-constants";

const messageListeners = new Set();
const connectionListeners = new Set();

let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let pendingAuth = null;
let manuallyClosed = false;
let connectionState = "idle";

function resolveServerUrl() {
  const configured = process.env.EXPO_PUBLIC_WS_URL?.trim();
  if (configured) {
    return configured.replace(/^http/, "ws").replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(":")[0] || "localhost";
  return `ws://${host}:4000`;
}

export function getServerUrl() {
  return resolveServerUrl();
}

export function getHttpServerUrl() {
  return resolveServerUrl().replace(/^ws/i, "http").replace(/^wss/i, "https");
}

export const SERVER_URL = resolveServerUrl();
export const HTTP_SERVER_URL = getHttpServerUrl();

function emitConnection(nextState) {
  connectionState = nextState;
  connectionListeners.forEach((listener) => listener(nextState));
}

function emitMessage(message) {
  messageListeners.forEach((listener) => listener(message));
}

function scheduleReconnect() {
  if (manuallyClosed || reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, 10000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

export function connectSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return socket;
  }

  manuallyClosed = false;
  emitConnection("connecting");

  try {
    const nextSocket = new WebSocket(SERVER_URL);
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket) return;
      reconnectAttempt = 0;
      emitConnection("connected");
      if (pendingAuth) {
        nextSocket.send(JSON.stringify(pendingAuth));
        pendingAuth = null;
      }
    };

    nextSocket.onmessage = (event) => {
      try {
        emitMessage(JSON.parse(event.data));
      } catch {
        emitMessage({
          type: "error",
          code: "INVALID_SERVER_MESSAGE",
          message: "El servidor envió una respuesta que no se pudo leer.",
        });
      }
    };

    nextSocket.onerror = () => {
      if (socket === nextSocket) emitConnection("error");
    };

    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      socket = null;
      emitConnection("disconnected");
      scheduleReconnect();
    };
  } catch {
    socket = null;
    emitConnection("error");
    scheduleReconnect();
  }

  return socket;
}

export function disconnectSocket() {
  manuallyClosed = true;
  pendingAuth = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  socket?.close();
  socket = null;
  emitConnection("idle");
}

export function sendSocketMessage(payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }

  if (payload.type === "auth_login") pendingAuth = payload;
  connectSocket();
  return payload.type === "auth_login";
}

export function onSocketMessage(listener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function onConnectionChange(listener) {
  connectionListeners.add(listener);
  listener(connectionState);
  return () => connectionListeners.delete(listener);
}
