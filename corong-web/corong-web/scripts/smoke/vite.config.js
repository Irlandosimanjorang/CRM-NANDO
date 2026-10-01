import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  root: path.resolve(__dirname, "../.."),
  plugins: [react(), { name: "mockdb", enforce: "pre", resolveId(s, imp) { if (/\/lib\/db(\.js)?$/.test(s) && imp && !imp.includes("scripts/smoke")) return path.resolve(__dirname, "mockdb.js"); } }],
  server: { port: 5174 }, // buka http://localhost:5174/scripts/smoke/runner.html
});
