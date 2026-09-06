import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    // The SDK is linked from outside this package, so force its React peer
    // imports to resolve from the frontend application's dependency tree.
    dedupe: ["react", "react-dom"],
  },
  plugins: [
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
  ],
  build: { outDir: "dist" },
  server: {
    proxy: { "/api": "http://localhost:3456" },
  },
});
