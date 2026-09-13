import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 15000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = String(error.config?.url || "").endsWith("/login");
    if (error.response?.status === 401 && !isLogin) {
      window.dispatchEvent(new Event("admin-session-expired"));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  if (error.code === "ECONNABORTED") {
    return "El servidor tardó demasiado en responder.";
  }
  if (!error.response) {
    return "No fue posible conectar con el backend.";
  }
  return (
    error.response.data?.error?.message ||
    "No fue posible completar la solicitud."
  );
}

export const adminApi = {
  async login(username, password) {
    return (await client.post("/api/admin/login", { username, password })).data;
  },
  async logout() {
    await client.post("/api/admin/logout");
  },
  async session() {
    return (await client.get("/api/admin/session")).data;
  },
  async overview() {
    return (await client.get("/api/admin/overview")).data;
  },
  async users(params = {}) {
    return (await client.get("/api/admin/users", { params })).data;
  },
  async interactions(params = {}) {
    return (await client.get("/api/admin/interactions", { params })).data;
  },
  async ratings(params = {}) {
    return (await client.get("/api/admin/ratings", { params })).data;
  },
  async interaction(interactionId) {
    return (
      await client.get(
        `/api/admin/interactions/${encodeURIComponent(interactionId)}`,
      )
    ).data;
  },
};
