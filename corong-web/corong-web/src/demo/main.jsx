import { createRoot } from "react-dom/client";
import "../index.css";
import App from "../App.jsx";
import { buildDemo } from "./data";
import { saveActiveTab } from "../lib/uiPersist";

// Demo publik: aplikasi asli dengan database palsu (src/demo/mockdb.js) dan data contoh. Tidak ada yang tersimpan.
window.__D = buildDemo();
document.title = "Nexto - Demo Interaktif";
try {
  const t = new URLSearchParams(window.location.search).get("tab");
  const map = { team: "team", tim: "team", leads: "leads", deal: "deal", dashboard: "dashboard", visit: "visitfollowup", kompetitor: "kompetitor" };
  // Selalu mulai dari tab yang diminta (atau Dashboard) supaya demo tidak melanjutkan tab kunjungan sebelumnya.
  saveActiveTab(map[t] || "dashboard");
  localStorage.setItem("nexto_tour_team_seen", "1");
} catch (_) { /* tanpa tab awal */ }

// Kunjungan demo dicatat sebagai /demo (komponen Auth sempat tampil sekilas dan mencatat "/"), supaya statistik landing page tidak tercemar.
const rawFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("/functions/v1/track-visit") && init?.body) {
      const body = JSON.parse(init.body);
      body.page_path = "/demo";
      return rawFetch(input, { ...init, body: JSON.stringify(body) });
    }
  } catch (_) { /* kirim apa adanya */ }
  return rawFetch(input, init);
};

function DemoBadge() {
  return (
    <a href="/" className="fixed bottom-4 right-4 z-[60] rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-orange-700">
      Demo dengan data contoh. Daftar gratis
    </a>
  );
}

createRoot(document.getElementById("root")).render(<><App /><DemoBadge /></>);
