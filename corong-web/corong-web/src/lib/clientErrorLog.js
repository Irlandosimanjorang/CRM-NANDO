// Pelaporan error dari app ke tabel client_error_log (28 Sep 2026).
//
// Kenapa ada: bug trigger database bikin user gak bisa nutup deal ~12 hari
// dan gak ada yang tau - yang muncul cuma alert "Gagal simpan: ..." di layar
// customer, gak ada jejak di sisi server. Health check (edge function
// health-check -> checkClientErrors) sekarang ngitung pesan yang berulang
// dan ngabarin lewat Telegram.
//
// Cara kerja: app ini udah konsisten nampilin kegagalan lewat alert("Gagal
// ..."), jadi cukup dibungkus window.alert SEKALI di sini - semua tempat yang
// udah ada (dan yang bakal ditambah) otomatis ke-cover tanpa ngubah tiap
// catch block. Alert asli TETEP jalan persis sama. Semua di sini fire-and-
// forget & gak pernah boleh throw/ngeblok UI.
import { supabase } from "./supabaseClient";

const RECENT = new Map();
let installed = false;

export async function report(text) {
  try {
    const message = String(text).replace(/\s+/g, " ").trim().slice(0, 500);
    const now = Date.now();
    const last = RECENT.get(message);
    if (last && now - last < 10000) return;
    RECENT.set(message, now);
    if (RECENT.size > 50) RECENT.clear();
    await supabase.from("client_error_log").insert({ message, page: (window.location.pathname || "/").slice(0, 200) });
  } catch (_) { /* pelaporan gak boleh ngeganggu app */ }
}

export function installClientErrorLog() {
  if (installed || typeof window === "undefined" || typeof window.alert !== "function") return;
  installed = true;
  const originalAlert = window.alert.bind(window);
  window.alert = (msg) => {
    try {
      const text = String(msg ?? "");
      if (/^\s*gagal/i.test(text)) report(text);
    } catch (_) {}
    return originalAlert(msg);
  };
}
