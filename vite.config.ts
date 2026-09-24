import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow any host so the sandboxed live-preview proxy (and any dev tunnel) works.
    allowedHosts: true,
    // Forward API calls to the local Express backend scaffold (`npm run server`).
    // If the backend is not running, the frontend service layer transparently falls
    // back to its in-browser mock adapter — see src/services/http.ts.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        // Do not hard-fail the page when the backend is down.
        configure: (proxy) => {
          proxy.on("error", () => {
            /* backend offline — service layer falls back to mock adapter */
          });
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});
