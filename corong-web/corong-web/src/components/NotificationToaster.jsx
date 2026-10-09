import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import * as db from "../lib/db";

// Pop up notifikasi (9 Okt 2026, permintaan Nando): saat ada notifikasi baru, muncul kartu di pojok layar yang hilang sendiri
// dalam 5 detik, selain angka di lonceng dan bunyi pendek. Notifikasi lama yang sudah ada saat aplikasi dibuka tidak ikut muncul.
// Memeriksa tiap 15 detik dan saat tab kembali aktif (bukan realtime), cukup untuk "muncul tidak lama setelah kejadian".
const POLL_MS = 15000;
const SHOW_MS = 5000;
const FRESH_MS = 10 * 60 * 1000; // notifikasi yang lebih tua dari ini tidak dimunculkan sebagai pop up

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close().catch(() => {});
  } catch { /* bunyi diblokir peramban sebelum ada interaksi: abaikan */ }
}

export default function NotificationToaster({ onNavigate }) {
  const [toasts, setToasts] = useState([]);
  const seen = useRef(null); // null = pemeriksaan pertama belum selesai
  const timers = useRef(new Map());

  const dismiss = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  };

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const rows = await db.getMyNotifications(10);
        if (!alive) return;
        if (seen.current === null) { seen.current = new Set(rows.map((r) => r.id)); return; }
        const fresh = rows.filter((r) => !seen.current.has(r.id));
        rows.forEach((r) => seen.current.add(r.id));
        const show = fresh.filter((r) => !r.read_at && Date.now() - new Date(r.created_at).getTime() < FRESH_MS).slice(0, 3);
        if (fresh.length) window.dispatchEvent(new Event("nexto:notifications-changed"));
        if (!show.length) return;
        setToasts((t) => [...t, ...show.map((r) => ({ id: r.id, title: r.title, body: r.body, link_tab: r.link_tab, photo_url: r.photo_url }))].slice(-3));
        beep();
        show.forEach((r) => timers.current.set(r.id, setTimeout(() => dismiss(r.id), SHOW_MS)));
      } catch { /* jaringan putus: coba lagi di putaran berikutnya */ }
    };
    check();
    const iv = setInterval(check, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (t) => {
    db.markNotificationRead(t.id).catch(() => {});
    window.dispatchEvent(new Event("nexto:notifications-changed"));
    dismiss(t.id);
    if (t.link_tab) onNavigate?.(t.link_tab);
  };

  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`@keyframes nexto-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes nexto-toast-bar{from{width:100%}to{width:0}}@media (prefers-reduced-motion:reduce){.nexto-toast{animation:none!important}}`}</style>
      <div role="region" aria-label="Notifikasi baru" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[72px] z-[1250] flex flex-col items-center gap-2 px-4 md:left-auto md:right-5 md:top-[76px] md:items-end">
        {toasts.map((t) => (
          <div key={t.id} className="nexto-toast pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float" style={{ animation: "nexto-toast-in .22s ease-out" }}>
            <button type="button" onClick={() => open(t)} className="flex w-full items-start gap-3 px-4 py-3 pr-9 text-left hover:bg-slate-50">
              {t.photo_url ? <img src={t.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover" /> : <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><Bell size={15} /></span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800 line-clamp-2">{t.title}</span>
                {t.body && <span className="mt-0.5 block text-[12px] text-slate-500 line-clamp-2">{t.body}</span>}
              </span>
            </button>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi" className="absolute right-2 top-2 rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"><X size={14} /></button>
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-100"><span className="nexto-toast block h-full bg-orange-400" style={{ animation: `nexto-toast-bar ${SHOW_MS}ms linear forwards` }} /></span>
          </div>
        ))}
      </div>
    </>
  );
}
