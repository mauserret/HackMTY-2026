import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: Number(env.ADMIN_DEV_PORT || 5173),
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: false,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: Number(env.ADMIN_PREVIEW_PORT || 4173),
    },
  };
});
