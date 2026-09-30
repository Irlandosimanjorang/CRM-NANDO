// Pengaman build (1 Okt 2026). Dua kali app layar putih gara-gara kesalahan
// yang sebenarnya bisa ketahuan sebelum deploy:
//  - hook React dipanggil setelah `return` awal (crash setelah login)
//  - variabel dipakai di komponen yang tidak menerimanya (`industry` di
//    VisitView -> tab Visit & Follow-up putih)
// `npm run build` (yang dijalankan Vercel) sekarang menjalankan cek ini dulu.
// Kalau ada error, build gagal -> Vercel TIDAK deploy, versi lama tetap live.
// Sengaja cuma aturan yang pasti bikin crash, bukan soal gaya penulisan.
import hooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, __APP_VERSION__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": hooks, react },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-uses-vars": "error",
    },
  },
];
