import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// lib/db & lib/supabaseClient diganti versi palsu (mockdb.js, mock-supabase.js)
// supaya tes tidak pernah menyentuh database asli.
const MOCKS = [
  [/\/lib\/db(\.js)?$/, "mockdb.js"],
  [/\/lib\/supabaseClient(\.js)?$/, "mock-supabase.js"],
];

export default defineConfig({
  root: path.resolve(__dirname, "../.."),
  plugins: [react(), {
    name: "smoke-mocks",
    enforce: "pre",
    resolveId(s, imp) {
      if (!imp || imp.includes("scripts/smoke")) return null;
      const hit = MOCKS.find(([re]) => re.test(s));
      return hit ? path.resolve(__dirname, hit[1]) : null;
    },
  }],
  server: { port: 5174 }, // buka http://localhost:5174/scripts/smoke/runner.html (tab) atau /scripts/smoke/app.html (App lengkap)
});
