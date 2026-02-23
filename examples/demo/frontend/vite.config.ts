import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    // Stub Node crypto for browser — useAuth lazy-imports ClaudeAuth which needs crypto,
    // but these functions are never called in browser (server-mediated auth).
    {
      name: "stub-crypto",
      enforce: "pre" as const,
      resolveId(source: string) {
        if (source === "crypto" || source === "node:crypto") return "\0stub-crypto";
        return null;
      },
      load(id: string) {
        if (id === "\0stub-crypto") {
          return "export const createHash = () => ({ update() { return this; }, digest() { return ''; } }); export function randomBytes(n) { return new Uint8Array(n); }";
        }
        return null;
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": "http://localhost:3456",
    },
  },
});
