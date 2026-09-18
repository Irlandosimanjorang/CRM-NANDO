import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import GrokBotMcp from "./pages/GrokBotMcp.jsx";
import PublicDemo from "./pages/PublicDemo.jsx";
import "./index.css";

// Gak pake router library (app ini emang cuma "halaman" App/Auth) - path
// publik yang butuh render terpisah dicek manual di sini, gak sentuh
// App.jsx sama sekali. /demo (18 Sep 2026) - demo interaktif publik buat
// dilampirin ke proposal sales, gak perlu login.
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const RootComponent = path === "/grok-bot" ? GrokBotMcp : path === "/demo" ? PublicDemo : App;

// Vercel Analytics (17 Sep 2026, permintaan Nando) - biar bisa liat jumlah
// pengunjung nexto.site tiap hari dari dashboard Vercel yang udah ada.
// Gak pake cookie, gak perlu consent banner - dipasang di root biar kehitung
// di SEMUA halaman (landing page, /grok-bot, dan app abis login).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootComponent />
    <Analytics />
  </React.StrictMode>
);
