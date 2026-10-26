// Layar TV Nexto (26 Okt 2026) - halaman /tv untuk ditampilkan di layar kantor.
// Satu layar, tanpa scroll: angka utama di atas, detail di bawah. Ukuran teks mengikuti tinggi layar,
// angka besar ditulis ringkas (Rp 127 jt) supaya tidak terpotong. Omzet mengikuti tab Deal (deal_transactions).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, LogOut, Volume2, VolumeX } from "lucide-react";
import * as db from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import TvLogin from "./TvLogin";
import { fmtRp } from "../lib/helpers";
import { formatAgo, initialsOf } from "../lib/winBoard";

const RELOAD_MS = 60000;
const DEBOUNCE_MS = 1500;
const RECENT_VISIT_DAYS = 7;
const TOAST_MS = 6000;
const HIGHLIGHT_MS = 60000;
const SEEN_LIMIT = 300;
const KEY = { seen: "nexto-tv-seen-deals", sound: "nexto-tv-sound" };
const EMPTY = { loaded: false, orgId: null, org: null, stages: [], leads: [], members: [], targets: {}, visits: [], deals: [] };

const pad = (n) => String(n).padStart(2, "0");
// Tanggal dalam WIB, format YYYY-MM-DD.
function wibDate(d = new Date()) {
  const w = new Date(d.getTime() + 7 * 3600000);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}
function wibTime(iso) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function wibHM(d) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function wibClock(d) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
}
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

export default function TvScreen({ fetchVisits = db.listVisitCheckins } = {}) {
  // undefined = belum dicek, null = belum login.
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState(EMPTY);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  // null = belum dicek, true = akun wajib 2FA dan belum diverifikasi di browser ini.
  const [mfaNeeded, setMfaNeeded] = useState(null);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toast, setToast] = useState(null);
  const [highlight, setHighlight] = useState(() => new Set());
  const [sound, setSound] = useState(() => readLS(KEY.sound, "1") === "1");
  const audioRef = useRef(null);

  // Browser baru mengizinkan bunyi setelah ada interaksi. Klik pertama di layar membuka audio-nya.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = audioRef.current || (audioRef.current = new Ctx());
        ctx.resume?.();
      } catch (_) {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Judul tab browser untuk halaman TV (login maupun layar).
  useEffect(() => {
    const prev = document.title;
    document.title = "Layar TV Nexto";
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    if (!session) { setMfaNeeded(null); return; }
    let alive = true;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: d, error }) => {
      if (!alive) return;
      if (error) { setMfaNeeded(null); return; }
      setMfaNeeded(d.nextLevel === "aal2" && d.currentLevel !== "aal2");
    });
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Tombol layar penuh bisa dipakai bolak-balik: masuk saat biasa, keluar saat sudah penuh.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: d }) => { if (alive) setSession(d?.session || null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s || null));
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  const load = useCallback(async () => {
    const today = wibDate();
    const weekAgo = wibDate(new Date(Date.now() - RECENT_VISIT_DAYS * 86400000));
    const [org, stages, leads, members, targetRows, visits, deals] = await Promise.all([
      db.getMyOrg().catch(() => null),
      db.getStages().catch(() => []),
      db.getLeads().catch(() => []),
      db.getOrgMembers().catch(() => []),
      db.getTeamTargets(`${today.slice(0, 7)}-01`).catch(() => []),
      fetchVisits(weekAgo, today).catch(() => []),
      db.getDealTransactions().catch(() => []),
    ]);
    setData({
      loaded: true,
      orgId: org?.id || null,
      org,
      stages: stages || [],
      leads: leads || [],
      members: members || [],
      targets: Object.fromEntries((targetRows || []).map((r) => [r.user_id, Number(r.target) || 0])),
      visits: visits || [],
      deals: deals || [],
    });
    setLastUpdated(new Date());
  }, [fetchVisits]);

  useEffect(() => {
    if (!session || mfaNeeded !== false) return undefined;
    load();
    const t = setInterval(load, RELOAD_MS);
    return () => clearInterval(t);
  }, [session, mfaNeeded, load]);

  // Realtime: begitu ada lead, kunjungan, atau transaksi baru, muat ulang (dibatasi sekali per DEBOUNCE_MS).
  useEffect(() => {
    if (!session || !data.orgId || typeof supabase.channel !== "function") return undefined;
    let timer = null;
    const reload = () => { clearTimeout(timer); timer = setTimeout(load, DEBOUNCE_MS); };
    const channel = supabase.channel(`tv-${data.orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `org_id=eq.${data.orgId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_checkins", filter: `org_id=eq.${data.orgId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_transactions", filter: `org_id=eq.${data.orgId}` }, reload)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { clearTimeout(timer); setLive(false); supabase.removeChannel?.(channel); };
  }, [session, data.orgId, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nameOf = useCallback((uid) => data.members.find((m) => m.user_id === uid)?.display_name || "Tim", [data.members]);

  // Omzet mengikuti tab Deal: catatan transaksi deal (deal_transactions), bukan tahap lead.
  const wins = useMemo(() => {
    const ym = wibDate().slice(0, 7);
    return data.deals
      .filter((d) => (d.deal_date || "").slice(0, 7) === ym)
      .map((d) => ({
        id: d.id,
        name: d.lead_name || "Tanpa nama",
        value: Number(d.deal_value) || 0,
        uid: d.user_id,
        sales: nameOf(d.user_id),
        when: new Date(d.created_at).getTime(),
      }))
      .sort((a, b) => b.when - a.when)
      .map((w) => ({ ...w, ago: formatAgo(Date.now() - w.when) }));
  }, [data.deals, nameOf]);
  const monthTotal = wins.reduce((s, w) => s + w.value, 0);
  const targetTotal = Object.values(data.targets).reduce((s, v) => s + v, 0);

  const salesRows = useMemo(() => {
    const perUser = new Map();
    for (const w of wins) perUser.set(w.uid, (perUser.get(w.uid) || 0) + w.value);
    return data.members
      .filter((m) => (data.targets[m.user_id] || 0) > 0)
      .map((m) => {
        const target = data.targets[m.user_id];
        const value = perUser.get(m.user_id) || 0;
        return { uid: m.user_id, name: m.display_name || "Tim", target, value, pct: Math.min(100, Math.round((value / target) * 100)) };
      })
      .sort((a, b) => b.value - a.value || b.pct - a.pct);
  }, [data.members, data.targets, wins]);

  // Sisa hari bulan ini (termasuk hari ini) dan kebutuhan per hari untuk mengejar target tim.
  const [yy, mm, dd] = wibDate(now).split("-").map(Number);
  const daysLeft = new Date(yy, mm, 0).getDate() - dd + 1;
  const perDay = targetTotal > monthTotal ? Math.ceil((targetTotal - monthTotal) / daysLeft) : 0;

  // Kunjungan hari ini; kalau kosong, tampilkan kunjungan 7 hari terakhir.
  const today = wibDate(now);
  const visitsToday = data.visits.filter((v) => wibDate(new Date(v.checked_in_at)) === today);
  const visitRows = visitsToday.length ? visitsToday : data.visits;
  const visitLabel = visitsToday.length ? "Kunjungan hari ini" : `Kunjungan ${RECENT_VISIT_DAYS} hari terakhir`;

  // Pipeline: jumlah lead aktif per tahap (tahap menang/kalah tidak dihitung).
  const pipeline = useMemo(() => {
    const open = (data.stages || []).filter((s) => s.type !== "won" && s.type !== "lost");
    const counts = new Map(open.map((s) => [s.key, 0]));
    for (const l of data.leads) {
      if (l.deleted_at || !counts.has(l.stage_key)) continue;
      counts.set(l.stage_key, counts.get(l.stage_key) + 1);
    }
    return open.map((s) => ({ key: s.key, label: s.label, count: counts.get(s.key) || 0 }));
  }, [data.stages, data.leads]);

  // Deal baru: toast + sorot sebentar, sekali per deal. Saat pertama kali dibuka hanya dicatat.
  useEffect(() => {
    if (!data.loaded) return;
    const raw = readLS(KEY.seen, null);
    if (raw === null) { writeLS(KEY.seen, JSON.stringify(wins.map((w) => w.id).slice(0, SEEN_LIMIT))); return; }
    let seen;
    try { seen = new Set(JSON.parse(raw)); } catch (_) { seen = new Set(); }
    const fresh = wins.filter((w) => !seen.has(w.id));
    if (!fresh.length) return;
    writeLS(KEY.seen, JSON.stringify([...fresh.map((w) => w.id), ...seen].slice(0, SEEN_LIMIT)));
    setToast(fresh[0]);
    setHighlight(new Set(fresh.map((w) => w.id)));
    if (readLS(KEY.sound, "1") === "1") playChime(audioRef);
  }, [wins, data.loaded]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!highlight.size) return undefined;
    const t = setTimeout(() => setHighlight(new Set()), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlight]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    writeLS(KEY.sound, next ? "1" : "0");
    if (next) playChime(audioRef);
  };

  if (session === undefined) return <div className="min-h-screen bg-[#0b1020]" />;
  if (!session) return <TvLogin />;
  if (mfaNeeded === null) return <div className="min-h-screen bg-[#0b1020]" />;
  if (mfaNeeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 text-slate-100">
        <p className="max-w-md text-center text-[18px] leading-relaxed text-slate-300">
          Akun ini memakai verifikasi dua langkah. Selesaikan dulu di nexto.site/app pada browser ini, lalu buka lagi nexto.site/tv.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b1020] px-[3vw] py-[2.5vh] text-slate-100 select-none">
      <style>{"@keyframes nxTvIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.nx-tv-in{animation:nxTvIn .7s cubic-bezier(.2,.7,.2,1) both}@keyframes nxTvFlash{0%{background-color:rgba(52,211,153,.22)}100%{background-color:transparent}}.nx-tv-flash{animation:nxTvFlash 4s ease-out both}@media (prefers-reduced-motion:reduce){.nx-tv-in,.nx-tv-flash{animation:none}}"}</style>

      {/* Header: nama org, tanggal, jam, status koneksi, dan kontrol */}
      <header className="flex shrink-0 items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="truncate text-[clamp(14px,1.6vh,20px)] text-slate-500">{wibDate(now).split("-").reverse().join("/")}</p>
          <p className="truncate text-[clamp(22px,3.2vh,40px)] font-semibold tracking-[-0.02em]">{data.org?.name || "Nexto"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 text-right">
            <p className="text-[clamp(24px,3.6vh,44px)] font-medium tabular-nums text-slate-300">{wibClock(now)}</p>
            <p className="flex items-center justify-end gap-2 text-[clamp(12px,1.5vh,16px)] text-slate-500">
              <span className={"h-2 w-2 rounded-full " + (live ? "bg-emerald-400" : "bg-amber-400")} />
              {live ? "Langsung" : "Tidak tersambung"}{lastUpdated ? ` · diperbarui ${wibHM(lastUpdated)}` : ""}
            </p>
          </div>
          <button type="button" onClick={toggleSound} aria-label={sound ? "Matikan suara" : "Nyalakan suara"}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200">
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Keluar dari akun"
            className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200">
            <LogOut size={18} />
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Keluar dari layar penuh" : "Layar penuh"}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200">
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {!data.loaded ? (
        <main className="flex flex-1 items-center justify-center text-[clamp(20px,3vh,32px)] text-slate-500">Memuat data...</main>
      ) : (
        <main className="nx-tv-in flex min-h-0 flex-1 flex-col gap-[2.5vh] pt-[3vh]">
          {/* Angka utama: tiga kartu besar, angka ditulis ringkas supaya tidak terpotong */}
          <section className="grid shrink-0 grid-cols-3 gap-[2vw]">
            <div className="rounded-2xl bg-white/[0.04] px-[2vw] py-[2.5vh]">
              <p className="text-[clamp(14px,1.8vh,20px)] text-emerald-300">Omzet bulan ini</p>
              <p className="mt-[1vh] whitespace-nowrap text-[min(5.5vh,3.4vw)] font-bold leading-none tracking-[-0.03em] tabular-nums">{monthTotal > 0 ? fmtRp(monthTotal) : "Rp 0"}</p>
              <p className="mt-[1vh] text-[clamp(13px,1.6vh,18px)] text-slate-400">{wins.length} deal menang{targetTotal > 0 ? ` · target ${fmtRp(targetTotal)}` : ""}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] px-[2vw] py-[2.5vh]">
              <p className="text-[clamp(14px,1.8vh,20px)] text-sky-300">{visitLabel}</p>
              <p className="mt-[1vh] whitespace-nowrap text-[min(5.5vh,3.4vw)] font-bold leading-none tracking-[-0.03em] tabular-nums">{visitsToday.length}</p>
              <p className="mt-[1vh] text-[clamp(13px,1.6vh,18px)] text-slate-400">kunjungan tercatat hari ini</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] px-[2vw] py-[2.5vh]">
              <p className="text-[clamp(14px,1.8vh,20px)] text-amber-300">Sisa hari bulan ini</p>
              <p className="mt-[1vh] whitespace-nowrap text-[min(5.5vh,3.4vw)] font-bold leading-none tracking-[-0.03em] tabular-nums">{daysLeft}</p>
              <p className="mt-[1vh] text-[clamp(13px,1.6vh,18px)] text-slate-400">{perDay > 0 ? `perlu ${fmtRp(perDay)} per hari lagi` : targetTotal > 0 ? "target tim sudah tercapai" : "target belum diisi di tab Team"}</p>
            </div>
          </section>

          {/* Detail: deal, target per sales, kunjungan, dan pipeline */}
          <section className="grid min-h-0 flex-1 grid-cols-3 gap-[2vw]">
            <div className="flex min-h-0 flex-col">
              <p className="text-[clamp(14px,1.8vh,20px)] font-semibold text-emerald-300">Deal terbaru</p>
              <ul className="mt-[1.5vh] min-h-0 flex-1 overflow-hidden">
                {wins.slice(0, 5).map((w) => (
                  <li key={w.id} className={"flex items-start justify-between gap-3 border-t border-white/10 py-[1.2vh] " + (highlight.has(w.id) ? "nx-tv-flash" : "")}>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[clamp(16px,2.4vh,26px)] font-semibold leading-tight">{w.name}</p>
                      <p className="text-[clamp(12px,1.6vh,17px)] text-slate-400">{w.sales} · {w.ago}</p>
                    </div>
                    <p className="shrink-0 text-[clamp(15px,2.2vh,24px)] font-semibold tabular-nums text-emerald-300">{w.value > 0 ? fmtRp(w.value) : "Belum diisi"}</p>
                  </li>
                ))}
              </ul>
              {wins.length === 0 && <p className="text-[clamp(15px,2vh,22px)] text-slate-500">Belum ada deal menang bulan ini.</p>}
            </div>

            <div className="flex min-h-0 flex-col">
              <p className="text-[clamp(14px,1.8vh,20px)] font-semibold text-amber-300">Target per sales</p>
              <ul className="mt-[1.5vh] min-h-0 flex-1 overflow-hidden">
                {salesRows.map((r, i) => (
                  <li key={r.uid} className="flex items-center gap-[1vw] border-t border-white/10 py-[1.2vh]">
                    <span className="w-[1.6vw] shrink-0 text-center text-[clamp(13px,1.8vh,20px)] font-bold text-slate-500">{i + 1}</span>
                    <span className="grid h-[clamp(32px,5vh,48px)] w-[clamp(32px,5vh,48px)] shrink-0 place-items-center rounded-full bg-white/5 text-[clamp(12px,1.6vh,16px)] font-semibold text-slate-300">{initialsOf(r.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[clamp(15px,2.2vh,24px)] font-semibold">{r.name}</p>
                        <p className="shrink-0 text-[clamp(14px,2vh,22px)] font-bold tabular-nums text-amber-300">{r.pct}%</p>
                      </div>
                      <div className="mt-[0.6vh] h-[1vh] overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-amber-300 transition-[width] duration-700" style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {salesRows.length === 0 && <p className="text-[clamp(15px,2vh,22px)] text-slate-500">Target belum diisi di tab Team.</p>}
            </div>

            <div className="flex min-h-0 flex-col">
              <p className="text-[clamp(14px,1.8vh,20px)] font-semibold text-sky-300">{visitsToday.length ? "Kunjungan terbaru" : "Kunjungan terakhir"}</p>
              <ul className="mt-[1.5vh] min-h-0 flex-1 overflow-hidden">
                {visitRows.slice(0, 5).map((v, i) => (
                  <li key={`${v.lead_id}-${v.checked_in_at}-${i}`} className="flex items-baseline gap-3 border-t border-white/10 py-[1.2vh]">
                    <span className="w-[5.5vw] shrink-0 text-[clamp(12px,1.6vh,17px)] tabular-nums text-sky-300">
                      {visitsToday.length ? wibTime(v.checked_in_at) : new Date(v.checked_in_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" })}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[clamp(15px,2.2vh,24px)] font-semibold leading-tight">{v.lead_name || "Tanpa nama"}</p>
                      <p className="truncate text-[clamp(12px,1.6vh,17px)] text-slate-400">{nameOf(v.user_id)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {visitRows.length === 0 && <p className="text-[clamp(15px,2vh,22px)] text-slate-500">Belum ada kunjungan tercatat.</p>}
              {pipeline.length > 0 && (
                <div className="mt-[1.5vh] border-t border-white/10 pt-[1.2vh]">
                  <p className="text-[clamp(12px,1.6vh,16px)] text-slate-500">Lead aktif per tahap</p>
                  <div className="mt-[0.8vh] flex flex-wrap gap-[0.6vw]">
                    {pipeline.map((p) => (
                      <span key={p.key} className="rounded-full bg-white/5 px-[0.9vw] py-[0.6vh] text-[clamp(12px,1.6vh,16px)] text-slate-300">
                        {p.label} <b className="font-semibold text-slate-100 tabular-nums">{p.count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {toast && (
        <div key={toast.id} role="status" className="nx-tv-in fixed bottom-[4vh] right-[3vw] z-50 flex max-w-md items-center gap-4 rounded-2xl bg-slate-100 px-6 py-4 text-slate-900 shadow-2xl">
          <div className="min-w-0">
            <p className="text-[15px] text-slate-600"><span className="font-semibold text-slate-900">{toast.sales}</span> baru menutup deal</p>
            <p className="truncate text-[20px] font-semibold">{toast.name}{toast.value > 0 ? ` · ${fmtRp(toast.value)}` : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}
