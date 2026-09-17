import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import GrokBotMcp from "./pages/GrokBotMcp.jsx";
import "./index.css";

// Gak pake router library (app ini emang cuma 1 "halaman" App/Auth) - ini
// satu-satunya path publik yang butuh render terpisah, jadi cukup dicek
// manual di sini, gak sentuh App.jsx sama sekali.
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const RootComponent = path === "/grok-bot" ? GrokBotMcp : App;

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
