// Layar TV Nexto (25 Okt 2026) - halaman /tv untuk ditampilkan di layar kantor.
// Satu layar penuh, tanpa berganti-ganti: kunjungan hari ini, deal menang bulan ini, target tim.
// Tetap pakai login akun di browser TV (tidak ada token khusus). Data ikut berubah realtime.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2, LogOut } from "lucide-react";
import * as db from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import TvLogin from "./TvLogin";
import { fmtRp } from "../lib/helpers";
import { formatAgo, initialsOf } from "../lib/winBoard";

const RELOAD_MS = 60000;
const DEBOUNCE_MS = 1500;
const VISIT_ROWS = 7;
const WIN_ROWS = 6;
const EMPTY = { loaded: false, orgId: null, org: null, stages: [], leads: [], members: [], targets: {}, visits: [], deals: [] };

const pad = (n) => String(n).padStart(2, "0");
// Tanggal hari ini dalam WIB, format YYYY-MM-DD.
function wibDate(d = new Date()) {
  const w = new Date(d.getTime() + 7 * 3600000);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}
function wibTime(iso) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function wibClock(d) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
}

export default function TvScreen({ fetchVisits = db.listVisitCheckins } = {}) {
  // undefined = belum dicek, null = belum login.
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState(EMPTY);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  // null = belum dicek, true = akun wajib 2FA dan belum diverifikasi di browser ini.
  const [mfaNeeded, setMfaNeeded] = useState(null);

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
    const [org, stages, leads, members, targetRows, visits, deals] = await Promise.all([
      db.getMyOrg().catch(() => null),
      db.getStages().catch(() => []),
      db.getLeads().catch(() => []),
      db.getOrgMembers().catch(() => []),
      db.getTeamTargets(`${today.slice(0, 7)}-01`).catch(() => []),
      fetchVisits(today, today).catch(() => []),
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
  }, [fetchVisits]);

  useEffect(() => {
    if (!session || mfaNeeded !== false) return undefined;
    load();
    const t = setInterval(load, RELOAD_MS);
    return () => clearInterval(t);
  }, [session, mfaNeeded, load]);

  // Realtime: begitu ada lead atau kunjungan baru, muat ulang (dibatasi sekali per DEBOUNCE_MS).
  useEffect(() => {
    if (!session || !data.orgId || typeof supabase.channel !== "function") return undefined;
    let timer = null;
    const reload = () => { clearTimeout(timer); timer = setTimeout(load, DEBOUNCE_MS); };
    const channel = supabase.channel(`tv-${data.orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `org_id=eq.${data.orgId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_checkins", filter: `org_id=eq.${data.orgId}` }, reload)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel?.(channel); };
  }, [session, data.orgId, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nameOf = useCallback((uid) => data.members.find((m) => m.user_id === uid)?.display_name || "Tim", [data.members]);
  // Angka omzet mengikuti tab Deal: catatan transaksi deal (deal_transactions), bukan tahap lead.
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
  const groups = useMemo(() => {
    const m = new Map();
    for (const w of wins) {
      const g = m.get(w.uid) || { uid: w.uid, total: 0 };
      g.total += w.value;
      m.set(w.uid, g);
    }
    return [...m.values()];
  }, [wins]);
  const monthTotal = wins.reduce((s, w) => s + w.value, 0);
  const targetTotal = Object.values(data.targets).reduce((s, v) => s + v, 0);
  const targetRows = data.members
    .filter((m) => (data.targets[m.user_id] || 0) > 0)
    .map((m) => {
      const target = data.targets[m.user_id];
      const value = groups.find((g) => g.uid === m.user_id)?.total || 0;
      return { uid: m.user_id, name: m.display_name || "Tim", target, value, pct: Math.min(100, Math.round((value / target) * 100)) };
    })
    .sort((a, b) => b.pct - a.pct);

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
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b1020] text-slate-100 select-none">
      <style>{"@keyframes nxTvIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.nx-tv-in{animation:nxTvIn .7s cubic-bezier(.2,.7,.2,1) both}@media (prefers-reduced-motion:reduce){.nx-tv-in{animation:none}}"}</style>

      <header className="flex shrink-0 items-center justify-between gap-6 px-12 pt-8">
        <div className="min-w-0">
          <p className="truncate text-[15px] text-slate-500">{wibDate(now).split("-").reverse().join("/")}</p>
          <p className="truncate text-[30px] font-semibold tracking-[-0.02em] text-slate-100">{data.org?.name || "Nexto"}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="mr-3 text-[30px] font-medium tabular-nums text-slate-400">{wibClock(now)}</p>
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
        <main className="flex flex-1 items-center justify-center text-[24px] text-slate-500">Memuat data...</main>
      ) : (
        <main className="nx-tv-in grid min-h-0 flex-1 grid-cols-3 gap-0 px-12 pb-12 pt-10">
          {/* Kolom 1: kunjungan hari ini */}
          <section className="flex min-h-0 flex-col pr-10">
            <p className="text-[18px] font-semibold text-sky-300">Kunjungan hari ini</p>
            <p className="mt-3 text-[104px] font-bold leading-none tracking-[-0.04em] tabular-nums">{data.visits.length}</p>
            <p className="mt-2 text-[20px] text-slate-400">kunjungan tercatat</p>
            <ul className="mt-10 min-h-0 flex-1 overflow-hidden">
              {data.visits.slice(0, VISIT_ROWS).map((v, i) => (
                <li key={`${v.lead_id}-${v.checked_in_at}-${i}`} className="flex items-baseline gap-4 border-t border-white/10 py-4">
                  <span className="w-16 shrink-0 text-[18px] tabular-nums text-sky-300">{wibTime(v.checked_in_at)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[24px] font-semibold tracking-[-0.01em]">{v.lead_name || "Tanpa nama"}</p>
                    <p className="truncate text-[16px] text-slate-400">{nameOf(v.user_id)}</p>
                  </div>
                </li>
              ))}
            </ul>
            {data.visits.length === 0 && <p className="mt-10 text-[22px] text-slate-500">Belum ada kunjungan hari ini.</p>}
          </section>

          {/* Kolom 2: deal menang bulan ini */}
          <section className="flex min-h-0 flex-col border-l border-white/10 px-10">
            <p className="text-[18px] font-semibold text-emerald-300">Deal menang bulan ini</p>
            <p className="mt-3 truncate text-[56px] font-bold leading-none tracking-[-0.04em] tabular-nums">{monthTotal > 0 ? fmtRp(monthTotal) : "Belum diisi"}</p>
            <p className="mt-2 text-[20px] text-slate-400">{wins.length} deal menang</p>
            <ul className="mt-10 min-h-0 flex-1 overflow-hidden">
              {wins.slice(0, WIN_ROWS).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-5 border-t border-white/10 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[24px] font-semibold tracking-[-0.01em]">{w.name}</p>
                    <p className="truncate text-[16px] text-slate-400">{w.sales} · {w.ago}</p>
                  </div>
                  <p className="shrink-0 text-[22px] font-semibold tabular-nums text-emerald-300">{w.value > 0 ? fmtRp(w.value) : "Belum diisi"}</p>
                </li>
              ))}
            </ul>
            {wins.length === 0 && <p className="mt-10 text-[22px] text-slate-500">Belum ada deal menang bulan ini.</p>}
          </section>

          {/* Kolom 3: target tim */}
          <section className="flex min-h-0 flex-col border-l border-white/10 pl-10">
            <p className="text-[18px] font-semibold text-amber-300">Target tim bulan ini</p>
            <p className="mt-3 truncate text-[56px] font-bold leading-none tracking-[-0.04em] tabular-nums">{fmtRp(monthTotal)}</p>
            <p className="mt-2 text-[20px] text-slate-400">{targetTotal > 0 ? `dari ${fmtRp(targetTotal)}` : "target belum diisi di tab Team"}</p>
            <ul className="mt-10 min-h-0 flex-1 overflow-hidden">
              {targetRows.map((r) => (
                <li key={r.uid} className="flex items-center gap-5 border-t border-white/10 py-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/5 text-[16px] font-semibold text-slate-300 ring-1 ring-white/10">{initialsOf(r.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="truncate text-[22px] font-semibold">{r.name}</p>
                      <p className="shrink-0 text-[18px] font-semibold tabular-nums text-amber-300">{r.pct}%</p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-300 transition-[width] duration-700" style={{ width: `${r.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[14px] tabular-nums text-slate-500">{fmtRp(r.value)} dari {fmtRp(r.target)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}
    </div>
  );
}
