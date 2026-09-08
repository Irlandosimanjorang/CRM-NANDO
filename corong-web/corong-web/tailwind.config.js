/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Sora jadi font default SELURUH app (landing page + CRM di dalamnya) -
      // font-mono (dipake buat label/tag ala "command center") gak kesentuh,
      // itu tetep pake default monospace-nya sendiri.
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
