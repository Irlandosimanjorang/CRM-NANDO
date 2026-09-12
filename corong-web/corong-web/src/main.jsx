import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import GrokBotMcp from "./pages/GrokBotMcp.jsx";
import "./index.css";

// Gak pake router library (app ini emang cuma 1 "halaman" App/Auth) - ini
// satu-satunya path publik yang butuh render terpisah, jadi cukup dicek
// manual di sini, gak sentuh App.jsx sama sekali.
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const RootComponent = path === "/grok-bot" ? GrokBotMcp : App;

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><RootComponent /></React.StrictMode>);
