// Papan kemenangan tim (25 Okt 2026) - tampil di atas Dashboard untuk owner dulu.
// Data: lead yang masuk tahap menang (lib/winBoard.js). Target: sales_targets bulan ini (tab Team).
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Volume2, VolumeX, Trophy, Eye } from "lucide-react";
import * as db from "../lib/db";
import { Panel, PanelHeader } from "../ui";
import { fmtRp } from "../lib/helpers";
import { WIN_WINDOW_DAYS, WIN_PERIODS, periodStart, collectDealWins, groupWinsBySales, initialsOf } from "../lib/winBoard";

const KEY = { hidden: "nexto-win-board-hidden", period: "nexto-win-period", sound: "nexto-win-sound", seen: "nexto-win-seen" };
const SEEN_LIMIT = 300;
const TOAST_MS = 5000;

// localStorage bisa tidak tersedia (private window, site data diblokir), jadi selalu dibungkus try/catch.
function readLS(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function playChime(audioRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = audioRef.current || (audioRef.current = new Ctx());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

export default function WinBoard({ leads, deals, members, onOpenLead }) {
  const [hidden, setHidden] = useState(() => readLS(KEY.hidden, "0") === "1");
  const [period, setPeriod] = useState(() => readLS(KEY.period, "7"));
  const [sound, setSound] = useState(() => readLS(KEY.sound, "0") === "1");
  const [toast, setToast] = useState(null);
  const [targets, setTargets] = useState({});
  const audioRef = useRef(null);

  // Kemenangan periode terpilih, dan kemenangan bulan ini (untuk progres target).
  const wins = useMemo(() => collectDealWins(deals, members, periodStart(period)), [deals, members, period]);
  const groups = useMemo(() => groupWinsBySales(wins), [wins]);
  const monthBySales = useMemo(
    () => new Map(groupWinsBySales(collectDealWins(deals, members, periodStart("month"))).map((g) => [g.uid, g])),
    [deals, members]
  );

  // Target sales bulan ini. Kosong kalau belum diisi atau akun tidak punya akses.
  useEffect(() => {
    let alive = true;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    db.getTeamTargets(ym)
      .then((rows) => { if (alive) setTargets(Object.fromEntries((rows || []).map((r) => [r.user_id, Number(r.target) || 0]))); })
      .catch(() => { if (alive) setTargets({}); });
    return () => { alive = false; };
  }, []);

  // Deal baru yang menang: toast + suara, sekali per deal. Saat pertama kali dibuka hanya dicatat, tidak ada toast.
  const recent = useMemo(() => collectDealWins(deals, members, periodStart(String(WIN_WINDOW_DAYS))), [deals, members]);
  useEffect(() => {
    const raw = readLS(KEY.seen, null);
    const ids = recent.map((w) => w.id);
    if (raw === null) { writeLS(KEY.seen, JSON.stringify(ids.slice(0, SEEN_LIMIT))); return; }
    let seen;
    try { seen = JSON.parse(raw); } catch (_) { seen = []; }
    const seenSet = new Set(seen);
    const fresh = recent.filter((w) => !seenSet.has(w.id));
    if (!fresh.length) return;
    writeLS(KEY.seen, JSON.stringify([...fresh.map((w) => w.id), ...seen].slice(0, SEEN_LIMIT)));
    setToast(fresh[0]);
    if (readLS(KEY.sound, "0") === "1") playChime(audioRef);
  }, [recent]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const hide = () => { setHidden(true); writeLS(KEY.hidden, "1"); };
  const show = () => { setHidden(false); writeLS(KEY.hidden, "0"); };
  const pickPeriod = (key) => { setPeriod(key); writeLS(KEY.period, key); };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    writeLS(KEY.sound, next ? "1" : "0");
    if (next) playChime(audioRef);
  };

  const total = wins.reduce((s, w) => s + w.value, 0);
  const withValue = wins.filter((w) => w.value > 0).length;
  const average = withValue ? total / withValue : 0;
  const periodMeta = period === "month" ? "bulan ini" : `${period} hari terakhir`;

  const style = (
    <style>{"@keyframes nxWinIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.nx-win-in{animation:nxWinIn .45s cubic-bezier(.2,.7,.2,1) both}@media (prefers-reduced-motion:reduce){.nx-win-in{animation:none}}"}</style>
  );

  if (hidden) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-2.5">
        <p className="text-[12.5px] text-slate-500">Papan kemenangan disembunyikan</p>
        <button type="button" onClick={show} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700 hover:text-ink">
          <Eye size={14} /> Tampilkan
        </button>
      </div>
    );
  }

  return (
    <>
      {style}
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeader title="Kemenangan tim" meta={`${wins.length} deal menang ${periodMeta}`} />
          <div className="flex items-center gap-1.5">
            <div role="group" aria-label="Periode kemenangan" className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {WIN_PERIODS.map((p) => (
                <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => pickPeriod(p.key)}
                  className={"rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors " + (period === p.key ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" aria-label={sound ? "Matikan suara" : "Nyalakan suara"} onClick={toggleSound} className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink">
              {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button type="button" aria-label="Sembunyikan papan kemenangan" onClick={hide} className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink">
              <X size={14} />
            </button>
          </div>
        </div>

        {wins.length === 0 ? (
          <p className="mt-4 text-[13px] text-slate-500">Belum ada deal menang {periodMeta}.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11.5px] text-slate-500">Total menang</p>
                <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{total > 0 ? fmtRp(total) : "Belum diisi"}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-500">Jumlah deal</p>
                <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{wins.length}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-500">Rata-rata per deal</p>
                <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{average > 0 ? fmtRp(Math.round(average)) : "-"}</p>
              </div>
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((g, i) => {
                const target = targets[g.uid] || 0;
                const monthly = monthBySales.get(g.uid);
                const monthValue = monthly?.total || 0;
                const pct = target > 0 ? Math.min(100, Math.round((monthValue / target) * 100)) : 0;
                const reached = target > 0 && monthValue >= target;
                const firstThisMonth = monthly?.count === 1;
                return (
                  <li key={g.uid || g.sales}>
                    <button type="button" onClick={() => onOpenLead?.(leads.find((x) => x.id === g.latest.leadId))} className="flex w-full flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">{initialsOf(g.sales)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline gap-2 truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">
                            <span className="truncate">{g.sales}</span>
                            <span className="shrink-0 text-[11px] font-medium text-slate-400">#{i + 1}</span>
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-slate-500">{g.count} deal · {g.latest.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {g.total > 0
                            ? <p className="text-[15px] font-semibold tabular-nums text-orange-700">{fmtRp(g.total)}</p>
                            : <p className="text-[12px] text-slate-400">Nilai belum diisi</p>}
                          <p className="mt-0.5 text-[11px] text-slate-400">{g.latest.ago}</p>
                        </div>
                      </div>

                      {target > 0 && (
                        <div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres target ${g.sales}`}>
                            <div className="h-full rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-1.5 text-[11.5px] text-slate-500 tabular-nums">{pct}% dari target bulan ini ({fmtRp(target)})</p>
                        </div>
                      )}

                      {(reached || firstThisMonth) && (
                        <div className="flex flex-wrap gap-1.5">
                          {reached && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Trophy size={11} /> Tembus target</span>}
                          {firstThisMonth && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Deal pertama bulan ini</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      {toast && (
        <div key={toast.id + toast.when} role="status" className="nx-win-in fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-lg">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-emerald-300"><Trophy size={16} /></span>
          <div className="min-w-0">
            <p className="text-[12.5px] text-slate-300"><span className="font-semibold text-white">{toast.sales}</span> baru menutup deal</p>
            <p className="truncate text-[14px] font-semibold">{toast.name}{toast.value > 0 ? ` · ${fmtRp(toast.value)}` : ""}</p>
          </div>
          <button type="button" aria-label="Tutup notifikasi" onClick={() => setToast(null)} className="ml-1 shrink-0 text-slate-400 hover:text-white"><X size={14} /></button>
        </div>
      )}
    </>
  );
}
