import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import * as db from "../lib/db";

// Pop up notifikasi (9 Okt 2026, permintaan Nando): saat ada notifikasi baru, muncul kartu di pojok layar yang hilang sendiri
// dalam 15 detik (diubah dari 5 detik atas permintaan Nando), selain angka di lonceng dan bunyi pendek. Notifikasi lama yang sudah ada saat aplikasi dibuka tidak ikut muncul.
// Memeriksa tiap 15 detik dan saat tab kembali aktif (bukan realtime), cukup untuk "muncul tidak lama setelah kejadian".
const POLL_MS = 15000;
const SHOW_MS = 15000;
const FRESH_MS = 10 * 60 * 1000; // notifikasi yang lebih tua dari ini tidak dimunculkan sebagai pop up
const OPEN_FRESH_MS = 2 * 60 * 1000; // saat aplikasi baru dibuka, hanya yang belum dibaca dan berumur kurang dari ini yang ikut muncul

// Peramban memblokir bunyi sebelum pengguna menyentuh halaman, jadi satu AudioContext dibuat dan "dibuka" pada sentuhan/klik/tombol
// pertama, lalu dipakai ulang untuk setiap notifikasi. Bunyi: dua nada pendek (chime) yang cukup terdengar; di HP ditambah getar.
let audioCtx = null;
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch { /* tidak didukung */ }
}
function tone(ctx, freq, start, dur, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(start); osc.stop(start + dur + 0.02);
}
function beep() {
  try { navigator.vibrate?.([90, 60, 90]); } catch { /* tidak didukung */ }
  try {
    unlockAudio();
    if (!audioCtx) return;
    const go = () => { const t = audioCtx.currentTime; tone(audioCtx, 880, t, 0.22, 0.22); tone(audioCtx, 1175, t + 0.16, 0.3, 0.22); };
    if (audioCtx.state === "running") go(); else audioCtx.resume().then(go).catch(() => {});
  } catch { /* bunyi diblokir: abaikan */ }
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
        const first = seen.current === null;
        if (first) seen.current = new Set();
        const fresh = rows.filter((r) => !seen.current.has(r.id) && (!first || (!r.read_at && Date.now() - new Date(r.created_at).getTime() < OPEN_FRESH_MS)));
        rows.forEach((r) => seen.current.add(r.id));
        const show = fresh.filter((r) => !r.read_at && Date.now() - new Date(r.created_at).getTime() < FRESH_MS).slice(0, 3);
        if (fresh.length) window.dispatchEvent(new Event("nexto:notifications-changed"));
        if (!show.length) return;
        setToasts((t) => [...t, ...show.map((r) => ({ id: r.id, title: r.title, body: r.body, link_tab: r.link_tab, photo_url: r.photo_url }))].slice(-3));
        beep();
        show.forEach((r) => timers.current.set(r.id, setTimeout(() => dismiss(r.id), SHOW_MS)));
      } catch { /* jaringan putus: coba lagi di putaran berikutnya */ }
    };
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    check();
    const iv = setInterval(check, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
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
          <div key={t.id} className="nexto-toast pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.28),0_2px_8px_rgba(15,23,42,0.08)]" style={{ animation: "nexto-toast-in .22s ease-out" }}>
            <div className="flex items-center gap-2 px-4 pt-3 text-[11px] text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 text-white"><Bell size={11} /></span>
              <span className="font-semibold text-slate-600">Nexto</span>
              <span aria-hidden="true">·</span>
              <span>baru saja</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi" className="ml-auto rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"><X size={14} /></button>
            </div>
            <button type="button" onClick={() => open(t)} className="flex w-full items-start gap-3 px-4 pb-4 pt-1.5 text-left hover:bg-slate-50/70">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-snug text-slate-900 line-clamp-2">{t.title}</span>
                {t.body && <span className="mt-1 block text-[12.5px] leading-snug text-slate-500 line-clamp-2">{t.body}</span>}
                {t.link_tab && <span className="mt-2 inline-block text-[12px] font-semibold text-orange-600">Lihat sekarang</span>}
              </span>
              {t.photo_url && <img src={t.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover" />}
            </button>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-slate-100"><span className="nexto-toast block h-full bg-orange-400" style={{ animation: `nexto-toast-bar ${SHOW_MS}ms linear forwards` }} /></span>
          </div>
        ))}
      </div>
    </>
  );
}
