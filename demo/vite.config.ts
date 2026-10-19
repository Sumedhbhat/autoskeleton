import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { autoskeleton: fileURLToPath(new URL("../src/index.ts", import.meta.url)) },
  },
  server: { port: 5173, strictPort: true, host: "127.0.0.1" },
});
