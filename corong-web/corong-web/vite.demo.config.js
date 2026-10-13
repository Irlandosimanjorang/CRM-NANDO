import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Build kedua untuk demo publik: aplikasi yang sama, tetapi lib/db dan lib/supabaseClient diganti versi palsu.
// Hasilnya masuk dist/demo (disajikan di /demo lewat rewrite di vercel.json).
const dir = path.dirname(fileURLToPath(import.meta.url));
const MOCKS = [
  [/\/lib\/db(\.js)?$/, "src/demo/mockdb.js"],
  [/\/lib\/supabaseClient(\.js)?$/, "src/demo/mock-supabase.js"],
];

export default defineConfig({
  base: "/demo/",
  publicDir: false,
  plugins: [react(), {
    name: "demo-mocks",
    enforce: "pre",
    resolveId(s, imp) {
      if (!imp || imp.split(path.sep).join("/").includes("/src/demo/")) return null;
      const hit = MOCKS.find(([re]) => re.test(s));
      return hit ? path.resolve(dir, hit[1]) : null;
    },
  }],
  build: { outDir: "dist/demo", emptyOutDir: true, rollupOptions: { input: path.resolve(dir, "demo.html") } },
});
