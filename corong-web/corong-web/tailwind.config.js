/** @type {import('tailwindcss').Config} */
// Token desain Nexto - aturan lengkapnya di docs/DESIGN.md.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Plus Jakarta Sans = teks biasa (default), Sora = judul & angka besar
      // (font-display; h1-h3 otomatis lewat index.css). font-mono gak disentuh.
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["Sora", "'Plus Jakarta Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0f172a",
        brand: { DEFAULT: "#f97316", strong: "#ea580c", soft: "#fff3e8", line: "#fed7aa" },
        ai: { DEFAULT: "#6d5dfc", soft: "#f1efff" },
      },
      borderRadius: {
        panel: "20px",
        inner: "12px",
      },
      boxShadow: {
        float: "0 18px 50px -24px rgba(15,23,42,.35)",
      },
    },
  },
  plugins: [],
};
