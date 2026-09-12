import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  connectSocket,
  disconnectSocket,
  onConnectionChange,
  onSocketMessage,
  sendSocketMessage,
} from "../services/socket";

const ASSISTANT_STATUS_MESSAGES = {
  thinking: "Construyendo tu interfaz…",
  transferring: "Protegiendo y enviando tu transferencia…",
};

const BankingContext = createContext(null);

function makeId(prefix = "event") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BankingProvider({ children }) {
  const [connection, setConnection] = useState("idle");
  const [session, setSession] = useState(null);
  const [overview, setOverview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [assistantStatus, setAssistantStatus] = useState("");
  const [notification, setNotification] = useState(null);

  const sessionRef = useRef(null);
  const credentialsRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const authTimerRef = useRef(null);

  const clearAuthTimer = () => {
    if (authTimerRef.current) clearTimeout(authTimerRef.current);
    authTimerRef.current = null;
  };

  const appendMessage = useCallback((role, data, extra = {}) => {
    setMessages((current) => [
      ...current,
      {
        id: data.interaction_id || data.interactionId || makeId(role),
        role,
        data,
        ...extra,
      },
    ]);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const unsubscribeConnection = onConnectionChange((nextState) => {
      setConnection(nextState);
      if (
        nextState === "connected" &&
        sessionRef.current &&
        credentialsRef.current
      ) {
        sendSocketMessage({
          type: "auth_login",
          ...credentialsRef.current,
        });
      }
    });

    const unsubscribeMessages = onSocketMessage((message) => {
      switch (message.type) {
        case "auth_success": {
          clearAuthTimer();
          const previousId = sessionRef.current?.id;
          const nextUser = message.user;
          setSession(nextUser);
          sessionRef.current = nextUser;
          setOverview(
            message.overview || { ...nextUser, accounts: nextUser.accounts }
          );
          setAuthLoading(false);
          setAuthError("");
          setAssistantStatus("");
          if (previousId && previousId !== nextUser?.id) setMessages([]);
          break;
        }

        case "auth_error":
          clearAuthTimer();
          credentialsRef.current = null;
          setAuthLoading(false);
          setAuthError(message.message || "No pudimos iniciar tu sesión.");
          break;

        case "auth_logged_out":
          setSession(null);
          setOverview(null);
          setMessages([]);
          break;

        case "assistant_status":
          setAssistantStatus(
            ["done", "idle", "ready"].includes(message.status)
              ? ""
              : message.message ||
                  ASSISTANT_STATUS_MESSAGES[message.status] ||
                  "Preparando tu interfaz…"
          );
          break;

        case "overview_update":
          setOverview(message.overview || message.props || message.data);
          break;

        case "ui":
        case "text":
          setAssistantStatus("");
          appendMessage("assistant", message);
          break;

        case "notification":
          setNotification(
            message.notification
              ? {
                  ...message.notification,
                  title: message.title || message.notification.title,
                  body:
                    message.body ||
                    message.notification.body ||
                    message.notification.message,
                  timestamp:
                    message.timestamp || message.notification.timestamp,
                }
              : message
          );
          if (notificationTimerRef.current) {
            clearTimeout(notificationTimerRef.current);
          }
          notificationTimerRef.current = setTimeout(
            () => setNotification(null),
            6000
          );
          break;

        case "rating_saved": {
          const interactionId =
            message.interaction_id || message.interactionId;
          setMessages((current) =>
            current.map((item) =>
              (item.data.interaction_id || item.data.interactionId) ===
              interactionId
                ? { ...item, rating: message.rating }
                : item
            )
          );
          break;
        }

        case "error":
          setAssistantStatus("");
          if (message.code?.startsWith("AUTH")) {
            clearAuthTimer();
            credentialsRef.current = null;
            setAuthLoading(false);
            setAuthError(
              message.code === "AUTH_USER_NOT_FOUND"
                ? "El usuario no existe."
                : message.message || "No pudimos iniciar tu sesión.",
            );
          } else {
            appendMessage("assistant", message);
          }
          break;

        default:
          break;
      }
    });

    connectSocket();
    return () => {
      unsubscribeConnection();
      unsubscribeMessages();
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      clearAuthTimer();
      disconnectSocket();
    };
  }, [appendMessage]);

  const login = useCallback((username, password) => {
    const normalized = username.trim();
    if (!normalized || !password) {
      setAuthError("Escribe tu usuario y contraseña.");
      return false;
    }

    credentialsRef.current = { username: normalized, password };
    setAuthLoading(true);
    setAuthError("");
    clearAuthTimer();
    authTimerRef.current = setTimeout(() => {
      setAuthLoading(false);
      setAuthError(
        "La conexión está tardando más de lo esperado. Verifica que el backend esté activo."
      );
    }, 12000);
    sendSocketMessage({
      type: "auth_login",
      username: normalized,
      password,
    });
    return true;
  }, []);

  const logout = useCallback(() => {
    sendSocketMessage({ type: "auth_logout" });
    clearAuthTimer();
    credentialsRef.current = null;
    sessionRef.current = null;
    setSession(null);
    setOverview(null);
    setMessages([]);
    setAssistantStatus("");
    setAuthError("");
  }, []);

  const sendMessage = useCallback(
    (text, { inputMode = "text" } = {}) => {
      const cleanText = text.trim();
      if (!cleanText || !sessionRef.current) return false;

      const sent = sendSocketMessage({
        type: "user_message",
        user_id: sessionRef.current.id,
        text: cleanText,
      });

      if (sent) {
        appendMessage(
          "user",
          { type: "text", text: cleanText },
          { inputMode },
        );
        setAssistantStatus("Analizando tu solicitud…");
      }
      return sent;
    },
    [appendMessage]
  );

  const confirmTransfer = useCallback((transfer) => {
    if (!sessionRef.current) return false;
    return sendSocketMessage({
      type: "confirm_transfer",
      user_id: sessionRef.current.id,
      request_id: transfer.request_id || transfer.requestId,
      contact_id: transfer.contact_id || transfer.contactId,
      to_alias:
        transfer.suggested_contact ||
        transfer.to_alias ||
        transfer.recipient ||
        transfer.alias,
      account_number:
        transfer.account_number || transfer.accountNumber,
      bank: transfer.bank,
      amount: Number(transfer.amount),
      concept: transfer.concept?.trim() || "",
    });
  }, []);

  const rateInteraction = useCallback((interactionId, rating) => {
    if (!interactionId || !sessionRef.current) return false;
    return sendSocketMessage({
      type: "rate_interaction",
      interaction_id: interactionId,
      rating,
    });
  }, []);

  const value = useMemo(
    () => ({
      connection,
      session,
      overview,
      messages,
      authLoading,
      authError,
      assistantStatus,
      notification,
      login,
      logout,
      sendMessage,
      confirmTransfer,
      rateInteraction,
      dismissNotification: () => setNotification(null),
    }),
    [
      connection,
      session,
      overview,
      messages,
      authLoading,
      authError,
      assistantStatus,
      notification,
      login,
      logout,
      sendMessage,
      confirmTransfer,
      rateInteraction,
    ]
  );

  return (
    <BankingContext.Provider value={value}>
      {children}
    </BankingContext.Provider>
  );
}

export function useBanking() {
  const context = useContext(BankingContext);
  if (!context) {
    throw new Error("useBanking debe usarse dentro de BankingProvider");
  }
  return context;
}
