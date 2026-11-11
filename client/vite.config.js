import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const certPath = env.VITE_HTTPS_CERT;
  const keyPath = env.VITE_HTTPS_KEY;

  if (Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error("Set both VITE_HTTPS_CERT and VITE_HTTPS_KEY to enable HTTPS for phone testing.");
  }

  const https = certPath && keyPath
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: true,
      host: "0.0.0.0",
      https,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://127.0.0.1:5000",
          ws: true,
        },
      },
    },
  };
});
