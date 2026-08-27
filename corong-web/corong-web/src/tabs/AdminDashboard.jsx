import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, Sparkles, MessageCircle, Loader2, RefreshCw, Zap } from "lucide-react";
import * as db from "../lib/db";

// Dashboard admin platform - CUMA keliatan buat email admin (dicek di
// App.jsx sebelum tab ini di-render sama sekali, DAN dicek ulang server-side
// di Edge Function admin-status/admin-trigger - jadi dua lapis, gak cuma
// disembunyiin di UI doang). Nunjukin status "karyawan AI" yang jalan di
// balik layar buat SELURUH platform Nexto (bukan cuma satu org).
export default function AdminDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggering, setTriggering] = useState(null); // "health-check" | "daily-digest" | null

  const load = async () => {
    setLoading(true); setError("");
    try { setStatus(await db.getAdminStatus()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const trigger = async (target) => {
    setTriggering(target);
    try {
      await db.callAdminTrigger(target);
      await load();
    } catch (e) {
      alert("Gagal manggil: " + e.message);
    } finally {
      setTriggering(null);
    }
  };

  const timeAgo = (iso) => {
    if (!iso) return "belum pernah";
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "barusan";
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    return `${Math.floor(hrs / 24)} hari lalu`;
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat status karyawan AI…</div>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10 text-center">
        <ShieldAlert size={28} className="mx-auto text-rose-400 mb-2" />
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  const security = status?.security;
  const securityHealthy = security?.status === "sehat";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Karyawan AI</h1>
          <p className="text-xs text-slate-400 mt-1">Status semua AI yang jaga & jalanin Nexto - platform-wide, bukan cuma org kamu.</p>
        </div>
        <button onClick={load} className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Security / Ops */}
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${securityHealthy ? "bg-emerald-50 text-emerald-600" : security ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"}`}>
              {securityHealthy ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            </span>
            <div>
              <div className="font-semibold text-sm">🛡️ Security / Ops</div>
              <div className="text-xs text-slate-400 mt-0.5">Jagain sistem, lapor kalau ada masalah (health-check)</div>
            </div>
          </div>
          <button onClick={() => trigger("health-check")} disabled={triggering === "health-check"} className="text-xs bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl px-3 py-1.5 font-medium flex items-center gap-1.5 shrink-0">
            {triggering === "health-check" ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Panggil Sekarang
          </button>
        </div>
        <div className="mt-3 pl-13 text-xs text-slate-500">
          {security ? (
            <>
              Terakhir dicek: <b>{timeAgo(security.checked_at)}</b> —{" "}
              {securityHealthy ? <span className="text-emerald-600 font-medium">semua sehat</span> : <span className="text-amber-600 font-medium">{security.issue_count} temuan</span>}
              {!securityHealthy && security.summary && <div className="mt-1.5 text-slate-500 bg-amber-50 rounded-lg p-2 whitespace-pre-wrap">{security.summary}</div>}
            </>
          ) : "Belum pernah kecatet - klik \"Panggil Sekarang\" buat tes pertama kalinya."}
        </div>
      </div>

      {/* Sales Advisor */}
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Sparkles size={18} /></span>
            <div>
              <div className="font-semibold text-sm">🧠 Sales Advisor</div>
              <div className="text-xs text-slate-400 mt-0.5">Analisis lead & rekomendasi tiap pagi (daily-digest)</div>
            </div>
          </div>
          <button onClick={() => trigger("daily-digest")} disabled={triggering === "daily-digest"} className="text-xs bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl px-3 py-1.5 font-medium flex items-center gap-1.5 shrink-0">
            {triggering === "daily-digest" ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Panggil Sekarang
          </button>
        </div>
        <div className="mt-3 pl-13 text-xs text-slate-500">
          <b>{status?.sales_advisor?.runs_today ?? 0}</b> user udah dapet digest hari ini.
        </div>
      </div>

      {/* Asisten Chat */}
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0"><MessageCircle size={18} /></span>
          <div>
            <div className="font-semibold text-sm">💬 Asisten Chat</div>
            <div className="text-xs text-slate-400 mt-0.5">Eksekusi perintah via Telegram (telegram-webhook)</div>
          </div>
        </div>
        <div className="mt-3 pl-13 text-xs text-slate-500">
          Aktivitas terakhir: <b>{timeAgo(status?.assistant?.last_activity)}</b>
          <span className="block text-[11px] text-slate-400 mt-0.5">(Gak ada tombol panggil - ini jalan pas ada yang chat, bukan jadwal.)</span>
        </div>
      </div>

      {/* Vector Memory */}
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-start gap-3">
          <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${(status?.vector_memory?.pending_embeddings ?? 0) > 0 ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600"}`}>
            <Sparkles size={18} />
          </span>
          <div>
            <div className="font-semibold text-sm">🧬 Vector Memory</div>
            <div className="text-xs text-slate-400 mt-0.5">Embed progress notes otomatis (embed-progress-note)</div>
          </div>
        </div>
        <div className="mt-3 pl-13 text-xs text-slate-500">
          <b>{status?.vector_memory?.pending_embeddings ?? 0}</b> catatan dari 24 jam terakhir belum ke-embed.
        </div>
      </div>
    </div>
  );
}
