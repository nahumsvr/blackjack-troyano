/**
 * Configuración de Vite para el cliente React.
 * En desarrollo, Vite sirve la app en :5173 (accesible por IP en la LAN) y reenvía `/ws`
 * al servidor Bun en :3000; así el cliente siempre usa el mismo host para el WebSocket,
 * igual que en producción, donde Bun sirve `client/dist` (T-38).
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Puerto del servidor Bun al que se reenvía el WebSocket en desarrollo. */
const PUERTO_SERVIDOR = 3000;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      "/ws": { target: `ws://localhost:${PUERTO_SERVIDOR}`, ws: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
