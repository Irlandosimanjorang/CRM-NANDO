// Layar TV Nexto (25 Okt 2026) - halaman /tv untuk ditampilkan di layar kantor.
// Isi berputar tiap SCENE_MS: kunjungan hari ini, deal menang bulan ini, target tim.
// Tetap pakai login akun di browser TV (tidak ada token khusus). Data ikut berubah realtime.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2, LogOut } from "lucide-react";
import * as db from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import TvLogin from "./TvLogin";
import { fmtRp } from "../lib/helpers";
import { periodStart, collectWins, groupWinsBySales, initialsOf } from "../lib/winBoard";

const SCENE_MS = 12000;
const RELOAD_MS = 60000;
const DEBOUNCE_MS = 1500;
const SCENES = [
  { key: "visits", label: "Kunjungan hari ini", accent: "text-sky-300", bar: "bg-sky-300" },
  { key: "wins", label: "Deal menang bulan ini", accent: "text-emerald-300", bar: "bg-emerald-300" },
  { key: "target", label: "Target tim bulan ini", accent: "text-amber-300", bar: "bg-amber-300" },
];
const EMPTY = { loaded: false, orgId: null, org: null, stages: [], leads: [], members: [], targets: {}, visits: [] };

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
  const [sceneIdx, setSceneIdx] = useState(0);
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
    const [org, stages, leads, members, targetRows, visits] = await Promise.all([
      db.getMyOrg().catch(() => null),
      db.getStages().catch(() => []),
      db.getLeads().catch(() => []),
      db.getOrgMembers().catch(() => []),
      db.getTeamTargets(`${today.slice(0, 7)}-01`).catch(() => []),
      fetchVisits(today, today).catch(() => []),
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
    const t = setInterval(() => setSceneIdx((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nameOf = useCallback((uid) => data.members.find((m) => m.user_id === uid)?.display_name || "Tim", [data.members]);
  const wins = useMemo(
    () => collectWins(data.leads, data.stages, data.members, periodStart("month")),
    [data.leads, data.stages, data.members]
  );
  const groups = useMemo(() => groupWinsBySales(wins), [wins]);
  const monthTotal = wins.reduce((s, w) => s + w.value, 0);
  const targetTotal = Object.values(data.targets).reduce((s, v) => s + v, 0);

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

  const scene = SCENES[sceneIdx];
  const todayVisits = data.visits.length;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1020] text-slate-100 select-none">
      <style>{"@keyframes nxTvBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes nxTvIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.nx-tv-in{animation:nxTvIn .6s cubic-bezier(.2,.7,.2,1) both}@media (prefers-reduced-motion:reduce){.nx-tv-in{animation:none}.nx-tv-bar{animation:none!important}}"}</style>

      <header className="flex items-center justify-between gap-6 px-10 pt-8">
        <p className="truncate text-[22px] font-semibold tracking-[-0.01em] text-slate-300">{data.org?.name || "Nexto"}</p>
        <div className="flex items-center gap-4">
          <p className="text-[22px] font-medium tabular-nums text-slate-400">{wibClock(now)}</p>
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

      <div className="relative mx-10 mt-6 h-1 overflow-hidden rounded-full bg-white/10">
        <div key={sceneIdx} className="nx-tv-bar h-full origin-left bg-white/70" style={{ animation: `nxTvBar ${SCENE_MS}ms linear forwards` }} />
      </div>

      {!data.loaded ? (
        <main className="flex flex-1 items-center justify-center text-[24px] text-slate-500">Memuat data...</main>
      ) : (
        <main key={scene.key} className="nx-tv-in flex flex-1 flex-col px-10 pb-10 pt-10">
          <p className={"text-[20px] font-semibold " + scene.accent}>{scene.label}</p>

          {scene.key === "visits" && (
            <>
              <p className="mt-2 text-[72px] font-bold leading-none tracking-[-0.03em] tabular-nums">{todayVisits}<span className="ml-4 text-[28px] font-medium text-slate-400">kunjungan</span></p>
              <ul className="mt-10 grid gap-x-12 gap-y-6 md:grid-cols-2">
                {data.visits.slice(0, 8).map((v, i) => (
                  <li key={`${v.lead_id}-${v.checked_in_at}-${i}`} className="flex items-baseline gap-5 border-b border-white/10 pb-4">
                    <span className="w-20 shrink-0 text-[22px] tabular-nums text-sky-300">{wibTime(v.checked_in_at)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[30px] font-semibold tracking-[-0.02em]">{v.lead_name || "Tanpa nama"}</p>
                      <p className="text-[18px] text-slate-400">{nameOf(v.user_id)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {todayVisits === 0 && <p className="mt-10 text-[26px] text-slate-500">Belum ada kunjungan hari ini.</p>}
            </>
          )}

          {scene.key === "wins" && (
            <>
              <p className="mt-2 text-[72px] font-bold leading-none tracking-[-0.03em] tabular-nums">{monthTotal > 0 ? fmtRp(monthTotal) : "Belum diisi"}</p>
              <p className="mt-3 text-[22px] text-slate-400">{wins.length} deal menang</p>
              <ul className="mt-10 grid gap-x-12 gap-y-6 md:grid-cols-2">
                {wins.slice(0, 6).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-6 border-b border-white/10 pb-4">
                    <div className="min-w-0">
                      <p className="truncate text-[30px] font-semibold tracking-[-0.02em]">{w.name}</p>
                      <p className="text-[18px] text-slate-400">{w.sales} · {w.ago}</p>
                    </div>
                    <p className="shrink-0 text-[26px] font-semibold tabular-nums text-emerald-300">{w.value > 0 ? fmtRp(w.value) : "Nilai belum diisi"}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {scene.key === "target" && (
            <>
              <p className="mt-2 text-[72px] font-bold leading-none tracking-[-0.03em] tabular-nums">{monthTotal > 0 ? fmtRp(monthTotal) : "Rp 0"}<span className="ml-4 text-[28px] font-medium text-slate-400">{targetTotal > 0 ? `dari ${fmtRp(targetTotal)}` : "belum ada target"}</span></p>
              <ul className="mt-10 grid gap-6">
                {data.members.filter((m) => (data.targets[m.user_id] || 0) > 0).map((m) => {
                  const target = data.targets[m.user_id];
                  const value = groups.find((g) => g.uid === m.user_id)?.total || 0;
                  const pct = Math.min(100, Math.round((value / target) * 100));
                  return (
                    <li key={m.user_id} className="flex items-center gap-6">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/5 text-[18px] font-semibold text-slate-300 ring-1 ring-white/10">{initialsOf(m.display_name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="truncate text-[26px] font-semibold">{m.display_name || "Tim"}</p>
                          <p className="shrink-0 text-[20px] tabular-nums text-slate-300">{pct}%</p>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                          <div className={"h-full rounded-full transition-[width] duration-700 " + scene.bar} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1.5 text-[16px] tabular-nums text-slate-500">{fmtRp(value)} dari {fmtRp(target)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {targetTotal === 0 && <p className="mt-10 text-[26px] text-slate-500">Target belum diisi di tab Team.</p>}
            </>
          )}
        </main>
      )}

      <footer className="flex items-center justify-center gap-3 pb-8">
        {SCENES.map((s, i) => (
          <span key={s.key} className={"h-2 rounded-full transition-all " + (i === sceneIdx ? `w-8 ${s.bar}` : "w-2 bg-white/20")} />
        ))}
      </footer>
    </div>
  );
}
