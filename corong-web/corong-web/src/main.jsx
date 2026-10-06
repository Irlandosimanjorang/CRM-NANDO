import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import GrokBotMcp from "./pages/GrokBotMcp.jsx";
import PublicDemo from "./pages/PublicDemo.jsx";
import InvoicePublic from "./pages/InvoicePublic.jsx";
import DocumentPublic from "./pages/DocumentPublic.jsx";
import { installClientErrorLog } from "./lib/clientErrorLog";
import { reloadForNewVersion } from "./lib/staleBuild";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Catat alert "Gagal ..." yang dialami user ke client_error_log biar health
// check bisa ngabarin kalau ada error berulang (lihat lib/clientErrorLog.js).
installClientErrorLog();

// Chunk versi lama gagal dimuat setelah deploy -> muat ulang sekali ke versi
// terbaru (lihat lib/staleBuild.js). Event ini dipancarkan Vite untuk
// kegagalan import dinamis & preload CSS.
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});

// Gak pake router library (app ini emang cuma "halaman" App/Auth) - path
// publik yang butuh render terpisah dicek manual di sini, gak sentuh
// App.jsx sama sekali. /demo (18 Sep 2026) - demo interaktif publik buat
// dilampirin ke proposal sales, gak perlu login.
const path = window.location.pathname.replace(/\/+$/, "") || "/";
// /invoice (2 Okt 2026) - halaman invoice untuk klien dari link email.
const RootComponent = path === "/grok-bot" ? GrokBotMcp : path === "/demo" ? PublicDemo : path === "/invoice" ? InvoicePublic : path === "/dokumen" ? DocumentPublic : App;

// Vercel Analytics (17 Sep 2026, permintaan Nando) - biar bisa liat jumlah
// pengunjung nexto.site tiap hari dari dashboard Vercel yang udah ada.
// Gak pake cookie, gak perlu consent banner - dipasang di root biar kehitung
// di SEMUA halaman (landing page, /grok-bot, dan app abis login).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary name="app" fullScreen>
      <RootComponent />
    </ErrorBoundary>
    {/* Halaman invoice klien tidak dilacak (URL-nya memuat token rahasia). */}
    {path !== "/invoice" && path !== "/dokumen" && <Analytics />}
  </React.StrictMode>
);
