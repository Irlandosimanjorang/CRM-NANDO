import { useState, useEffect } from "react";
import { Save, Plus, X, Trash2, Download, Loader2, Send, CheckCircle2, Copy, Calendar, RefreshCw, Sparkles, KeyRound, Users, UserPlus, Crown, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";
import DataCleanupModal from "../components/DataCleanupModal";
import RecycleBinModal from "../components/RecycleBinModal";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";

export default function Settings({ settings, stages, leads, onChanged }) {
  const [names, setNames] = useState((settings.sales_names || []).join(", "));
  const [st, setSt] = useState(stages.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [tgLink, setTgLink] = useState(null);
  const [tgCode, setTgCode] = useState("");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgLoading, setTgLoading] = useState(true);
  const [gcalLink, setGcalLink] = useState(null);
  const [gcalBusy, setGcalBusy] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showCleanup, setShowCleanup] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwMsgOk, setPwMsgOk] = useState(false);

  // ---- 2FA (Multi-Factor Authentication via TOTP - Google Authenticator dkk) ----
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaFactor, setMfaFactor] = useState(null); // factor TOTP yang udah verified, kalau ada
  const [mfaEnrolling, setMfaEnrolling] = useState(false); // lagi di tengah proses daftar (nunjukin QR)
  const [mfaPendingFactorId, setMfaPendingFactorId] = useState(null);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMsg, setMfaMsg] = useState("");
  const [mfaMsgOk, setMfaMsgOk] = useState(false);

  // ---- KODE RECOVERY 2FA - tambalan buat celah "HP hilang = terkunci
  // permanen". Plaintext-nya CUMA ada di state ini sesaat setelah generate,
  // gak pernah disimpen ke mana pun (server cuma nyimpen hash-nya) - begitu
  // di-refresh/pindah tab, ilang dari layar dan gak bisa diliat ulang. ----
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoverySavedConfirm, setRecoverySavedConfirm] = useState(false);

  const generateRecoveryCodes = async () => {
    setRecoveryBusy(true); setRecoveryMsg(""); setRecoverySavedConfirm(false);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", { body: { action: "generate" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecoveryCodes(data.codes);
    } catch (e) {
      setRecoveryMsg("Gagal bikin kode recovery: " + e.message);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const loadMfaFactors = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = (data?.totp || []).find((f) => f.status === "verified");
      setMfaFactor(verified || null);
    } catch (e) {
      console.error("Gagal load status 2FA:", e);
    } finally {
      setMfaLoading(false);
    }
  };

  const startMfaEnroll = async () => {
    setMfaBusy(true); setMfaMsg("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Nexto 2FA" });
      if (error) throw error;
      setMfaPendingFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaEnrolling(true);
    } catch (e) {
      setMfaMsg("Gagal mulai setup 2FA: " + e.message); setMfaMsgOk(false);
    } finally {
      setMfaBusy(false);
    }
  };

  const cancelMfaEnroll = async () => {
    if (mfaPendingFactorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: mfaPendingFactorId }); } catch (_) {}
    }
    setMfaEnrolling(false); setMfaPendingFactorId(null); setMfaQrCode(""); setMfaSecret(""); setMfaCode("");
  };

  const confirmMfaEnroll = async () => {
    if (mfaCode.length !== 6) { setMfaMsg("Kode harus 6 digit."); setMfaMsgOk(false); return; }
    setMfaBusy(true); setMfaMsg("");
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaPendingFactorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: mfaPendingFactorId, challengeId: challenge.id, code: mfaCode });
      if (verifyErr) throw verifyErr;
      setMfaMsg("✅ 2FA berhasil diaktifkan! Login berikutnya bakal minta kode dari app authenticator kamu."); setMfaMsgOk(true);
      setMfaEnrolling(false); setMfaPendingFactorId(null); setMfaQrCode(""); setMfaSecret(""); setMfaCode("");
      loadMfaFactors();
      generateRecoveryCodes(); // langsung siapin kode recovery begitu 2FA aktif - jangan sampe user lupa/gak pernah punya kode cadangan
    } catch (e) {
      setMfaMsg("Kode salah/kedaluwarsa, coba lagi: " + e.message); setMfaMsgOk(false);
    } finally {
      setMfaBusy(false);
    }
  };

  const disableMfa = async () => {
    if (!mfaFactor) return;
    if (!window.confirm("Matiin 2FA? Login berikutnya cuma butuh email+password lagi, tanpa kode tambahan.")) return;
    setMfaBusy(true); setMfaMsg("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id });
      if (error) throw error;
      setMfaMsg("2FA dimatiin."); setMfaMsgOk(true);
      setMfaFactor(null);
    } catch (e) {
      setMfaMsg("Gagal matiin 2FA: " + e.message); setMfaMsgOk(false);
    } finally {
      setMfaBusy(false);
    }
  };

  // ---- TIM / ORGANISASI ----
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [myUid, setMyUid] = useState(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  const loadOrg = () => {
    setOrgLoading(true);
    Promise.all([db.getMyOrg(), db.getOrgMembers(), db.getCurrentUserId()])
      .then(([o, m, uid]) => { setOrg(o); setMembers(m); setMyUid(uid); })
      .catch(() => {})
      .finally(() => setOrgLoading(false));
  };

  useEffect(() => {
    db.getTelegramLink().then((l) => { setTgLink(l); setTgLoading(false); }).catch(() => setTgLoading(false));
    db.getGoogleCalendarLink().then((l) => { setGcalLink(l); setGcalLoading(false); }).catch(() => setGcalLoading(false));
    loadOrg();
    loadMfaFactors();
  }, []);

  const isOwner = org && myUid && org.owner_user_id === myUid;
  const isEnterprise = org?.plan === "enterprise";
  // Yang bayar paket Individual (bukan Enterprise) sengaja gak dikasih akses
  // fitur tim sama sekali - paket itu emang didesain solo doang.
  const isIndividualPaid = settings.plan === "premium" && !isEnterprise;

  const generateInvite = async () => {
    setInviteBusy(true);
    try { setInviteCode(await db.createInviteCode("sales_rep")); }
    catch (e) { alert("Gagal bikin kode: " + e.message); }
    finally { setInviteBusy(false); }
  };

  const removeMember = async (id, name) => {
    if (!window.confirm(`Keluarin ${name || "anggota ini"} dari tim?`)) return;
    try { await db.removeMember(id); loadOrg(); }
    catch (e) { alert("Gagal: " + e.message); }
  };

  const [leaveBusy, setLeaveBusy] = useState(false);
  const leaveOrganization = async () => {
    if (!window.confirm(`Keluar dari organisasi "${org?.name}"? Kamu bakal balik punya ruang kerja sendiri (kosong).`)) return;
    setLeaveBusy(true);
    try { await db.leaveOrg(); loadOrg(); onChanged(); }
    catch (e) { alert("Gagal keluar: " + e.message); }
    finally { setLeaveBusy(false); }
  };

  const joinWithCode = async () => {
    if (!joinCode.trim()) return;
    setJoinBusy(true); setJoinMsg("");
    try {
      const res = await db.redeemInviteCode(joinCode.trim());
      setJoinMsg(`✅ Berhasil gabung ke ${res.org_name}. Refresh halaman buat lihat data tim.`);
      setJoinCode("");
      loadOrg();
      onChanged();
    } catch (e) {
      setJoinMsg("Gagal gabung: " + e.message);
    } finally {
      setJoinBusy(false);
    }
  };

  const ROLE_LABEL = { owner: "Owner", manager: "Manager", sales_rep: "Sales Rep" };

  const genCode = async () => {
    setTgBusy(true);
    try { const code = await db.generateTelegramCode(); setTgCode(code); }
    catch (e) { alert("Gagal generate kode: " + e.message); }
    finally { setTgBusy(false); }
  };
  const unlinkTg = async () => {
    if (!window.confirm("Putuskan koneksi Telegram?")) return;
    setTgBusy(true);
    try { await db.unlinkTelegram(); setTgLink(null); setTgCode(""); }
    catch (e) { alert("Gagal: " + e.message); }
    finally { setTgBusy(false); }
  };

  const connectGcal = async () => {
    setGcalBusy(true);
    try { await db.connectGoogleCalendar(); }
    catch (e) { alert("Gagal mulai koneksi: " + e.message); setGcalBusy(false); }
  };
  const disconnectGcal = async () => {
    if (!window.confirm("Putuskan koneksi Google Calendar?")) return;
    setGcalBusy(true);
    try { await db.disconnectGoogleCalendar(); setGcalLink(null); }
    catch (e) { alert("Gagal: " + e.message); }
    finally { setGcalBusy(false); }
  };

  const syncOldData = async () => {
    setSyncBusy(true); setSyncMsg("");
    try {
      const res = await db.bulkSyncCalendar();
      setSyncMsg(`✅ ${res.visitSynced} jadwal visit berhasil di-sync ke Google Calendar.`);
    } catch (e) {
      setSyncMsg("Gagal sync: " + e.message);
    } finally {
      setSyncBusy(false);
    }
  };

  const setStage = (i, k, v) => setSt((p) => p.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const addStage = () => setSt((p) => [...p, { key: `tahap_${Date.now()}`, label: "Tahap Baru", hex: "#94a3b8", type: "normal" }]);
  const delStage = (i) => setSt((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await db.saveSalesNames(names.split(",").map((s) => s.trim()).filter(Boolean));
      await db.saveStages(st);
      setMsg("Pengaturan tersimpan.");
      onChanged();
    } catch (e) { setMsg("Gagal simpan: " + e.message); }
    finally { setBusy(false); }
  };

  const exportBackup = async () => {
    setExporting(true);
    try {
      const data = await db.exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nexto-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e) { alert("Gagal export: " + e.message); }
    finally { setExporting(false); }
  };

  const changePassword = async () => {
    setPwMsg(""); setPwMsgOk(false);
    if (!pwOld) { setPwMsg("Masukin password lama dulu."); return; }
    if (pwNew.length < 8) { setPwMsg("Password baru minimal 8 karakter."); return; }
    if (pwNew !== pwConfirm) { setPwMsg("Konfirmasi password gak cocok."); return; }
    setPwBusy(true);
    try {
      // Verifikasi password LAMA dulu sebelum ganti - biar orang yang cuma
      // "numpang" sesi login (laptop ketinggalan login, dst) gak bisa ganti
      // password & ngunci pemilik asli keluar dari akunnya sendiri.
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) throw new Error("Gagal verifikasi akun, coba refresh halaman.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: pwOld });
      if (verifyError) throw new Error("Password lama salah.");

      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      setPwMsg("✅ Password berhasil diganti."); setPwMsgOk(true);
      setPwOld(""); setPwNew(""); setPwConfirm("");
    } catch (e) {
      setPwMsg("Gagal ganti password: " + e.message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Users size={15} className="text-violet-500" /> Tim</h3>
        {orgLoading ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Paket: <b>{isEnterprise ? "Enterprise" : "Free/Premium (solo)"}</b> · {members.length}/{org?.member_limit || 1} anggota
            </p>
            <div className="space-y-1.5 mb-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div className="text-xs flex items-center gap-1.5">
                    {m.role === "owner" && <Crown size={12} className="text-amber-500" />}
                    {m.user_id === myUid ? "Kamu" : (m.display_name || `Anggota ${m.user_id.slice(0, 8)}`)} <span className="text-slate-400">· {ROLE_LABEL[m.role] || m.role}</span>
                  </div>
                  {isOwner && m.user_id !== myUid && (
                    <button onClick={() => removeMember(m.id, ROLE_LABEL[m.role])} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>

            {!isOwner ? (
              // Dia anggota organisasi ORANG LAIN (udah pernah gabung pake kode) -
              // kolom "gabung" disembunyiin, gantiin sama tombol keluar.
              <div className="border-t border-slate-100 mt-1 pt-3">
                <p className="text-xs text-slate-500 mb-2">Kamu anggota organisasi <b>{org?.name || "ini"}</b>.</p>
                <button onClick={leaveOrganization} disabled={leaveBusy} className="text-xs border border-rose-300 text-rose-600 rounded-xl px-3 py-1.5 hover:bg-rose-50 disabled:opacity-60">
                  {leaveBusy ? "Keluar..." : "Keluar dari Organisasi"}
                </button>
              </div>
            ) : (
              <>
                {isIndividualPaid ? (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">Paket kamu <b>Individual</b> - fitur undang anggota khusus paket Enterprise.</p>
                ) : isEnterprise ? (
                  members.length >= (org?.member_limit || 1) ? (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">Anggota udah penuh (maks {org.member_limit}).</p>
                  ) : inviteCode ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-600 mb-2">Kasih kode ini ke anggota tim, suruh masukin di bagian "Punya kode undangan?" di bawah:</p>
                      <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm">
                        <span className="flex-1 tracking-wider">{inviteCode}</span>
                        <button onClick={() => navigator.clipboard.writeText(inviteCode)} className="text-slate-400 hover:text-slate-700"><Copy size={14} /></button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">Bisa dipake berkali-kali sampe kuota anggota penuh. Berlaku 7 hari.</p>
                    </div>
                  ) : (
                    <button onClick={generateInvite} disabled={inviteBusy} className="text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
                      {inviteBusy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Undang Anggota
                    </button>
                  )
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">Upgrade ke paket Enterprise buat bisa undang anggota tim.</p>
                )}

                {/* Kotak "Punya kode undangan?" ini sekarang keliatan buat SEMUA
                    owner (Free, Individual/Premium, Enterprise) - sebelumnya
                    kepencet gak muncul sama sekali buat owner Individual/Premium,
                    padahal mereka justru yang paling mungkin diundang gabung
                    tim Enterprise orang lain. */}
                <div className="border-t border-slate-100 mt-3 pt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Punya kode undangan?</p>
                  <div className="flex gap-2">
                    <input className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl uppercase" placeholder="Masukin kode" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} />
                    <button onClick={joinWithCode} disabled={joinBusy} className="text-sm bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl px-4 font-medium">
                      {joinBusy ? <Loader2 size={15} className="animate-spin" /> : "Gabung"}
                    </button>
                  </div>
                  {joinMsg && <p className={`text-xs mt-2 ${joinMsg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{joinMsg}</p>}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4 space-y-3">
        <label className="block"><span className="text-xs font-medium text-slate-500">Nama sales (pisah koma)</span><input className={inp} value={names} onChange={(e) => setNames(e.target.value)} placeholder="Nando, Budi, Sari" /></label>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm">Tahap pipeline</h3><button onClick={addStage} className="text-xs text-orange-600 flex items-center gap-1"><Plus size={13} /> tambah tahap</button></div>
        <p className="text-xs text-slate-400 mb-3">Tipe nentuin hitungan dashboard: <b>Deal</b> = menang, <b>Lost</b> = gugur, <b>Normal</b> = masih jalan.</p>
        <div className="space-y-2">
          {st.map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input type="color" className="col-span-1 h-9 rounded border border-slate-300" value={s.hex} onChange={(e) => setStage(i, "hex", e.target.value)} />
              <input className="col-span-5 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={s.label} onChange={(e) => setStage(i, "label", e.target.value)} />
              <select className="col-span-4 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={s.type} onChange={(e) => setStage(i, "type", e.target.value)}>
                <option value="normal">Normal</option><option value="won">Deal (menang)</option><option value="lost">Lost</option>
              </select>
              <button onClick={() => delStage(i)} className="col-span-2 text-slate-300 hover:text-rose-500 flex justify-center"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className={`text-sm rounded-xl p-3 ${msg.startsWith("Gagal") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{msg}</div>}
      <button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan pengaturan</button>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Sparkles size={15} className="text-orange-500" /> Rapihin Data</h3>
        <p className="text-xs text-slate-500 mb-3">Cari saran kategori buat lead "Lainnya", lead yang udah lama ga aktif, dan data kontak yang kurang lengkap. Semua perubahan tetap kamu yang approve.</p>
        <button onClick={() => setShowCleanup(true)} className="text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
          <Sparkles size={15} /> Buka Rapihin Data
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Trash2 size={15} className="text-slate-400" /> Recycle Bin</h3>
        <p className="text-xs text-slate-500 mb-3">Lead yang kehapus (manual atau otomatis dari bot) kesimpen di sini dulu, bisa dibalikin kapan aja sebelum di-hapus permanen.</p>
        <button onClick={() => setShowRecycleBin(true)} className="text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
          <Trash2 size={15} /> Buka Recycle Bin
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Send size={15} className="text-sky-500" /> Telegram Bot</h3>
        <p className="text-xs text-slate-500 mb-3">Sambungin akun Telegram kamu buat tambah lead, jadwalin visit, dan catat progress langsung dari chat.</p>
        {tgLoading ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : tgLink ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> Terhubung {tgLink.username ? `sebagai @${tgLink.username}` : ""}</div>
            <button onClick={unlinkTg} disabled={tgBusy} className="text-xs border border-rose-300 text-rose-600 rounded-xl px-3 py-1.5 hover:bg-rose-50 disabled:opacity-60">Putuskan koneksi</button>
          </div>
        ) : tgCode ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-600 mb-2">Buka Telegram, cari bot kamu, lalu kirim pesan ini:</p>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm">
              <span className="flex-1">/link {tgCode}</span>
              <button onClick={() => navigator.clipboard.writeText(`/link ${tgCode}`)} className="text-slate-400 hover:text-slate-700"><Copy size={14} /></button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Kode berlaku 10 menit. Setelah terhubung, refresh halaman ini.</p>
          </div>
        ) : (
          <button onClick={genCode} disabled={tgBusy} className="text-sm bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
            {tgBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Hubungkan Telegram
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Calendar size={15} className="text-rose-500" /> Google Calendar</h3>
        <p className="text-xs text-slate-500 mb-3">Sambungin Google Calendar kamu biar jadwal visit & follow-up dari bot Telegram otomatis masuk ke calendar.</p>
        {gcalLoading ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : gcalLink ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> Terhubung {gcalLink.email ? `sebagai ${gcalLink.email}` : ""}</div>
              <button onClick={disconnectGcal} disabled={gcalBusy} className="text-xs border border-rose-300 text-rose-600 rounded-xl px-3 py-1.5 hover:bg-rose-50 disabled:opacity-60">Putuskan koneksi</button>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 mb-2">Punya jadwal visit lama yang dibuat sebelum Google Calendar terhubung? Klik ini buat sync-in semuanya sekaligus.</p>
              <button onClick={syncOldData} disabled={syncBusy} className="text-xs bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
                {syncBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {syncBusy ? "Menyinkronkan…" : "Sync semua jadwal lama"}
              </button>
              {syncMsg && <p className={`text-xs mt-2 ${syncMsg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{syncMsg}</p>}
            </div>
          </div>
        ) : (
          <button onClick={connectGcal} disabled={gcalBusy} className="text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
            {gcalBusy ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />} Hubungkan Google Calendar
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          {mfaFactor ? <ShieldCheck size={15} className="text-emerald-500" /> : <ShieldAlert size={15} className="text-slate-400" />}
          Autentikasi 2 Langkah (2FA)
        </h3>
        <p className="text-xs text-slate-500 mb-3">Tambah lapisan keamanan - abis password bener, login masih minta kode 6 digit dari app authenticator (Google Authenticator, Authy, dll). Biar akun tetep aman walau password bocor.</p>

        {mfaLoading ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
        ) : mfaEnrolling ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 max-w-sm">
            <p className="text-xs text-slate-600">1. Scan QR code ini pake app authenticator (Google Authenticator, Authy, dll):</p>
            {mfaQrCode && <img src={mfaQrCode} alt="QR code 2FA" className="w-40 h-40 mx-auto border border-slate-200 rounded-lg bg-white p-2" />}
            <p className="text-[11px] text-slate-400">Gak bisa scan? Masukin manual kode ini di app authenticator-nya:</p>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-[11px]">
              <span className="flex-1 break-all">{mfaSecret}</span>
              <button onClick={() => navigator.clipboard.writeText(mfaSecret)} className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={13} /></button>
            </div>
            <p className="text-xs text-slate-600 pt-1">2. Masukin kode 6 digit yang muncul di app-nya:</p>
            <input
              className={inp + " text-center tracking-[0.3em] font-mono text-base"}
              placeholder="000000"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && confirmMfaEnroll()}
            />
            {mfaMsg && <div className={`text-xs rounded-lg p-2 ${mfaMsgOk ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{mfaMsg}</div>}
            <div className="flex gap-2">
              <button onClick={cancelMfaEnroll} className="flex-1 text-xs text-slate-600 border border-slate-300 rounded-xl py-2 hover:bg-slate-100">Batal</button>
              <button onClick={confirmMfaEnroll} disabled={mfaBusy || mfaCode.length !== 6} className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl py-2 font-medium flex items-center justify-center gap-1.5">
                {mfaBusy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Aktifkan
              </button>
            </div>
          </div>
        ) : mfaFactor ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> 2FA aktif</div>
            <button onClick={disableMfa} disabled={mfaBusy} className="text-xs border border-rose-300 text-rose-600 rounded-xl px-3 py-1.5 hover:bg-rose-50 disabled:opacity-60">
              {mfaBusy ? "Memproses..." : "Matikan 2FA"}
            </button>
          </div>
        ) : (
          <>
            {mfaMsg && <div className={`text-xs rounded-lg p-2 mb-2 ${mfaMsgOk ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{mfaMsg}</div>}
            <button onClick={startMfaEnroll} disabled={mfaBusy} className="text-sm bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
              {mfaBusy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Aktifkan 2FA
            </button>
          </>
        )}

        {/* ---- KODE RECOVERY - cuma relevan kalau 2FA lagi aktif/baru aktif.
            Kotak kode plaintext CUMA muncul sesaat setelah generate - dari
            situ makanya ada tombol "Sudah saya simpan" buat nutup & ngosongin
            dari layar (bukan disimpen ulang, emang gak ada di server juga). ---- */}
        {mfaFactor && !mfaEnrolling && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-slate-600">
                <span className="font-semibold">Kode Recovery</span> — buat jaga-jaga kalau HP/app authenticator kamu ilang atau rusak, jadi gak kekunci permanen dari akun sendiri.
              </div>
              <button onClick={generateRecoveryCodes} disabled={recoveryBusy} className="text-xs border border-slate-300 text-slate-700 rounded-xl px-3 py-1.5 hover:bg-slate-100 disabled:opacity-60 shrink-0 flex items-center gap-1.5">
                {recoveryBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {recoveryCodes ? "Buat ulang" : "Buat kode recovery"}
              </button>
            </div>
            {recoveryMsg && <div className="text-xs rounded-lg p-2 mt-2 bg-rose-50 text-rose-700">{recoveryMsg}</div>}
            {recoveryCodes && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-sm">
                <p className="text-[11px] font-semibold text-amber-800 mb-2">⚠️ Simpan sekarang — ini CUMA ditampilin sekali. Tiap kode cuma bisa dipake 1x buat masuk kalau HP kamu hilang.</p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px] bg-white rounded-lg p-2.5 border border-amber-100">
                  {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}
                  className="mt-2 text-[11px] text-amber-700 hover:text-amber-900 flex items-center gap-1"
                >
                  <Copy size={11} /> Salin semua kode
                </button>
                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-800">
                  <input type="checkbox" checked={recoverySavedConfirm} onChange={(e) => setRecoverySavedConfirm(e.target.checked)} />
                  Saya sudah simpan kode-kode ini di tempat aman
                </label>
                <button
                  onClick={() => setRecoveryCodes(null)}
                  disabled={!recoverySavedConfirm}
                  className="mt-2 w-full text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg py-1.5 font-medium"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><KeyRound size={15} className="text-slate-500" /> Ganti Password</h3>
        <p className="text-xs text-slate-500 mb-3">Ganti password akun kamu kapan aja. Minimal 8 karakter.</p>
        <div className="space-y-2 max-w-sm">
          <input type="password" className={inp} placeholder="Password lama" value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
          <input type="password" className={inp} placeholder="Password baru" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          <input type="password" className={inp} placeholder="Ulangi password baru" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && changePassword()} />
          {pwMsg && <div className={`text-xs rounded-lg p-2 ${pwMsgOk ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{pwMsg}</div>}
          <button onClick={changePassword} disabled={pwBusy} className="bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5">
            {pwBusy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Ganti Password
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <h3 className="font-semibold text-sm mb-1">Backup data</h3>
        <p className="text-xs text-slate-500 mb-3">Supabase Free ga ada backup otomatis. Download semua data (leads, kompetitor, tahap, histori AI Advisor) jadi 1 file — simpen di komputer/HP kamu sesekali biar aman.</p>
        <button onClick={exportBackup} disabled={exporting} className="text-sm border border-slate-300 rounded-xl px-3 py-2 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {exporting ? "Menyiapkan…" : "Export semua data"}
        </button>
      </div>

      <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold text-sm mb-1 text-rose-600">Zona bahaya</h3>
        <p className="text-xs text-slate-500 mb-2">Keluar dari akun ini di perangkat ini.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm border border-rose-300 text-rose-600 rounded-xl px-3 py-2 hover:bg-rose-50">Keluar</button>
      </div>

      {showCleanup && <DataCleanupModal leads={leads} stages={stages} onClose={() => setShowCleanup(false)} onChanged={onChanged} />}
      {showRecycleBin && <RecycleBinModal onClose={() => setShowRecycleBin(false)} onChanged={onChanged} />}
    </div>
  );
}
