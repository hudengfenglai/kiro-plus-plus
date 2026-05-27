import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
