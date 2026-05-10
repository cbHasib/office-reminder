import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@office-reminder/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  // Tauri serves the dev UI from this port
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri expects a relative base
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: {
      input: {
        main:    path.resolve(__dirname, "index.html"),
        overlay: path.resolve(__dirname, "overlay.html"),
      },
    },
  },
});
