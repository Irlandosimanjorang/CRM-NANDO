import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check, Clock, Globe, MapPin, User, Package, Factory, Phone, Mail, ArrowRight, TrendingUp, Info, X } from "lucide-react";
import * as db from "../lib/db";

function ScoreRing({ score }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#94a3b8";
  const bg = score >= 70 ? "#ecfdf5" : score >= 40 ? "#fffbeb" : "#f8fafc";
  const circumference = 2 * Math.PI * 26;
  const dash = (score / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: 60, height: 60 }}>
      <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
        <circle cx="30" cy="30" r="26" fill={bg} stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="30" cy="30" r="26" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// Field SELALU ditampilin (walau kosong pake "—") biar layout stabil,
// gak lompat-lompat tergantung data ketemu apa engga.
function Field({ icon: Icon, value }) {
  const I = Icon;
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
      <I size={12} className="text-slate-400 shrink-0" />
      <span className="truncate">{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

export default function GenerateLeads({ stages, onChanged }) {
  const [keyword, setKeyword] = useState("");
  const [province, setProvince] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [productSold, setProductSold] = useState("");
  const [companyScale, setCompanyScale] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [cooldown, setCooldown] = useState({ canGenerate: true, usedThisWeek: 0, nextAvailableAt: null });
  const [importingId, setImportingId] = useState(null);

  const defaultStageKey = stages?.[0]?.key || "";

  const load = () => {
    setLoadingResults(true);
    Promise.all([db.getGeneratedLeads(), db.getLeadGenCooldown()])
      .then(([r, cd]) => { setResults(r); setCooldown(cd); })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!productSold.trim() || !keyword.trim() || !targetRole.trim()) {
      setMsg("Gagal: kolom barang yang dijual, kata kunci, dan jabatan wajib diisi (provinsi opsional).");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const res = await db.generateLeads({ keyword, province, targetRole, productSold, companyScale });
      setMsg(`✅ Ketemu ${res.count} calon lead baru, cek daftar di bawah.`);
      load();
    } catch (e) {
      setMsg("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Sekali klik kartu langsung import ke Leads. Kartunya TETAP tampil abis
  // itu (bukan ilang) - cuma statusnya berubah jadi "Sudah di Leads".
  const importLead = async (gl) => {
    if (gl.status === "imported" || importingId) return;
    setImportingId(gl.id);
    try {
      await db.importGeneratedLead(gl, defaultStageKey);
      setResults((prev) => prev.map((r) => (r.id === gl.id ? { ...r, status: "imported" } : r)));
      onChanged();
    } catch (e) {
      alert("Gagal import: " + e.message);
    } finally {
      setImportingId(null);
    }
  };

  const nextDate = cooldown.nextAvailableAt ? new Date(cooldown.nextAvailableAt) : null;
  const daysLeft = nextDate ? Math.max(1, Math.ceil((nextDate - new Date()) / 86400000)) : 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Generate Leads</h1>
          <button onClick={() => setShowInfo((v) => !v)} className="shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors" title="Gimana cara AI cari lead?">
            <Info size={14} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">AI cari calon CUSTOMER buat produk lo — bukan cuma perusahaan sejenis. Provinsi opsional (kosongin buat cari se-Indonesia), kolom lain wajib diisi biar AI ngarahin ke pembeli potensial yang paling akurat. Maks 15 lead per generate, 2x seminggu (gak boleh di hari yang sama).</p>

        {showInfo && (
          <div className="mt-3 bg-orange-50/60 border border-orange-100 rounded-2xl p-4 relative">
            <button onClick={() => setShowInfo(false)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            <div className="text-sm font-bold text-slate-800 mb-2 pr-6">Gimana cara AI-nya nyari lead?</div>
            <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
              <li><b>Cari dari 4 sumber publik</b>: Google Maps, cuplikan LinkedIn (company page & profil, bukan buka halamannya), Instagram/TikTok bisnis, dan direktori resmi (Kemenperin, dst).</li>
              <li><b>Diarahin ke calon PEMBELI</b>, bukan sesama penjual — kalau lo isi "barang yang dijual", AI khusus nyari perusahaan yang kemungkinan BUTUH BELI itu, bukan kompetitor.</li>
              <li><b>Belajar dari deal yang udah closing</b> — kalau lo udah punya lead yang statusnya "Menang" di pipeline, AI jadiin itu contoh "ideal customer" biar hasil generate makin mirip yang beneran closing.</li>
              <li><b>Cari sinyal lagi berkembang</b> — lowongan kerja baru, buka cabang, ekspansi — biar diprioritasin ke yang lagi butuh, bukan yang stagnan.</li>
              <li><b>Otomatis skip yang udah ada</b> di daftar lead lo, biar gak muncul dobel buang-buang kuota.</li>
              <li><b>Kalau hasilnya kesikit</b> (kebanyakan kena skip karena dobel), AI otomatis coba nyari lagi 1x dengan sudut pencarian yang beda.</li>
              <li><b>Tiap lead dikasih skor 3 komponen</b> (match industri, kelengkapan kontak, sinyal butuh beli) + skor keseluruhan, diurutin dari yang paling tinggi.</li>
              <li>AI dilarang keras <b>ngarang data</b> — kalau info kayak nama PIC gak ketemu di sumber publik, dikosongin aja, bukan ditebak.</li>
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-center gap-2 mb-4">
          {[0, 1].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < cooldown.usedThisWeek ? "bg-orange-500" : "bg-slate-100"}`} />
          ))}
          <span className="text-[11px] text-slate-400 shrink-0 ml-1">{cooldown.usedThisWeek}/2 minggu ini</span>
        </div>

        {!cooldown.canGenerate ? (
          <div className="flex items-center gap-2.5 text-sm text-amber-700 bg-amber-50 rounded-2xl p-4">
            <Clock size={18} className="shrink-0" />
            <span>{cooldown.usedThisWeek >= 2 ? "Kuota 2x/minggu udah abis" : "Udah generate hari ini"} — bisa lagi dalam <b>{daysLeft} hari</b>{nextDate ? ` (${nextDate.toLocaleDateString("id-ID")})` : ""}.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Barang/jasa yang lo jual <span className="text-rose-500">*</span></span>
                <input required className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: resin PVC, kompon kabel" value={productSold} onChange={(e) => setProductSold(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Kata kunci / industri <span className="text-rose-500">*</span></span>
                <input required className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: distributor kabel listrik" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Provinsi (opsional - kosongin buat cari se-Indonesia)</span>
                <input className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: Jawa Timur" value={province} onChange={(e) => setProvince(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Jabatan yang dicari <span className="text-rose-500">*</span></span>
                <input required className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="misal: Purchasing Manager" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Skala perusahaan (opsional)</span>
                <select className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" value={companyScale} onChange={(e) => setCompanyScale(e.target.value)}>
                  <option value="">Semua skala</option>
                  <option value="UMKM / Kecil">UMKM / Kecil</option>
                  <option value="Menengah">Menengah</option>
                  <option value="Besar / Korporat">Besar / Korporat</option>
                </select>
              </label>
            </div>
            <button onClick={generate} disabled={busy || !productSold.trim() || !keyword.trim() || !targetRole.trim()} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Lagi nyari (bisa 1-2 menit)…" : "Generate 15 Leads"}
            </button>
          </div>
        )}
        {msg && <p className={`text-xs mt-3 ${msg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{msg}</p>}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Riwayat hasil pencarian ({results.length})</h3>
        {loadingResults ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : results.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-slate-100 rounded-2xl p-6 text-center">Belum ada hasil. Klik "Generate Leads" buat mulai nyari.</div>
        ) : (
          <div className="space-y-2.5">
            {(() => {
              // Kelompokin hasil per-batch generate (run_id) - backend udah
              // ngurutin run_started_at DESC lalu score DESC, di sini kita
              // cuma nentuin kapan nampilin header pemisah batch baru.
              const runCounts = {};
              for (const r of results) {
                const k = r.run_id || "legacy";
                runCounts[k] = (runCounts[k] || 0) + 1;
              }
              let lastRunKey = null;
              return results.map((r) => {
                const imported = r.status === "imported";
                const runKey = r.run_id || "legacy";
                const showHeader = runKey !== lastRunKey;
                lastRunKey = runKey;
                const headerLabel = r.run_started_at
                  ? new Date(r.run_started_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Generate sebelumnya";
                return (
                  <div key={r.id}>
                    {showHeader && (
                      <div className={`flex items-center gap-2 pb-2 ${lastRunKey === null ? "" : "pt-3"}`}>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{headerLabel}</span>
                        <span className="text-[11px] text-slate-300">· {runCounts[runKey]} hasil, diurut score tertinggi</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                    )}
                    <button
                      onClick={() => importLead(r)}
                      disabled={imported || importingId === r.id}
                      className={`w-full text-left bg-white border rounded-2xl shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4 transition-colors ${imported ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 hover:border-orange-300 hover:bg-orange-50/20 cursor-pointer"}`}
                    >
                      <div className="flex items-start gap-3.5">
                        <ScoreRing score={r.score ?? 50} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate">{r.name}</div>
                              {r.category && <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{r.category}</span>}
                            </div>
                            <div className="shrink-0">
                              {imported ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-3 py-1.5 flex items-center gap-1"><Check size={13} /> Sudah di Leads</span>
                              ) : importingId === r.id ? (
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Menambah…</span>
                              ) : (
                                <span className="text-xs font-medium text-orange-600 flex items-center gap-1">Tambah ke Leads <ArrowRight size={13} /></span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5">
                            <Field icon={Globe} value={r.website} />
                            <Field icon={MapPin} value={r.city} />
                            <Field icon={User} value={r.key_person ? `${r.key_person}${r.key_person_title ? " · " + r.key_person_title : ""}` : ""} />
                            <Field icon={Package} value={r.product} />
                            <Field icon={Phone} value={r.phone} />
                            <Field icon={Mail} value={r.email} />
                          </div>
                          {r.growth_signal && <div className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-2 flex items-center gap-1 w-fit"><TrendingUp size={11} /> {r.growth_signal}</div>}
                          {(r.score_industry_match || r.score_contact_quality || r.score_buying_signal) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-slate-400">
                              {r.score_industry_match != null && <span>Industri <b className="text-slate-600">{r.score_industry_match}</b></span>}
                              {r.score_contact_quality != null && <span>Kontak <b className="text-slate-600">{r.score_contact_quality}</b></span>}
                              {r.score_buying_signal != null && <span>Sinyal beli <b className="text-slate-600">{r.score_buying_signal}</b></span>}
                            </div>
                          )}
                          {r.source_note && <div className="text-[11px] text-slate-400 mt-1.5 italic flex items-center gap-1"><Factory size={11} /> via {r.source_note}</div>}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
