// Catat Cepat (21-22 Sep 2026, permintaan Nando: "biar gua full ubah dari
// Telegram bot ke recorder ini aja") - dibuka otomatis tiap app dibuka dari
// home screen (standalone) atau lewat tombol mengambang di App.jsx. Beda
// dari MeetingRecorderModal: user GAK milih lead/aksi dulu - tinggal pencet
// rekam & ngomong bebas, AI (quick-progress-note edge function, pipeline
// sama kayak Bot Telegram: Whisper transkrip + Claude) yang NENTUIN sendiri
// mau ngapain (update lead, tutup menang/kalah, tambah lead baru, hapus
// lead, atau kirim email follow-up) DAN lead mana yang dimaksud. Hasil
// TETEP direview manual di sini sebelum beneran dieksekusi (beda dari Bot
// Telegram yang langsung eksekusi - voice cuma sekali ngomong, gak ada
// kesempatan klarifikasi kayak chat, jadi review manual itu jaring pengaman
// pengganti-nya). Eksekusi aksinya lewat db.js yang SAMA dipake UI biasa
// (upsertLead dkk) - termasuk sync Google Calendar OTOMATIS ke-trigger dari
// situ, gak ada logic terpisah di sini.
//
// VISUAL (22 Sep 2026, permintaan Nando: "design futuristic dan clean") -
// beda sengaja dari modal lain di app (yang semua putih/terang) - ini
// panel GELAP dengan glow oranye+violet, echo dari kartu "NEX AI" di
// Dashboard (radial-gradient violet+oranye di atas dasar gelap) - biar
// modal AI-voice ini kerasa beda kelas dari form CRM biasa, bukan cuma
// skin ulang warna doang.
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, X, Save, Loader2, Search, Zap, CheckCircle2, AlertTriangle, Trash2, Mail, UserPlus, Trophy, XCircle, RefreshCw } from "lucide-react";
import * as db from "../lib/db";

function fmtTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const MAX_RECORDING_SECONDS = 3 * 60; // catatan cepat - gak perlu selama Rekam Meeting (30 menit)

const ACTION_META = {
  update_lead: { label: "Update Lead", icon: RefreshCw, ring: "border-sky-400/30", chip: "text-sky-300 bg-sky-500/10 border-sky-400/30" },
  close_lead: { label: "Tutup Deal", icon: Trophy, ring: "border-emerald-400/30", chip: "text-emerald-300 bg-emerald-500/10 border-emerald-400/30" },
  create_lead: { label: "Lead Baru", icon: UserPlus, ring: "border-violet-400/30", chip: "text-violet-300 bg-violet-500/10 border-violet-400/30" },
  delete_lead: { label: "Hapus Lead", icon: Trash2, ring: "border-rose-400/30", chip: "text-rose-300 bg-rose-500/10 border-rose-400/30" },
  send_email: { label: "Kirim Email", icon: Mail, ring: "border-orange-400/30", chip: "text-orange-300 bg-orange-500/10 border-orange-400/30" },
};

const FIELD_LABELS = {
  visit_date: "Tanggal visit", visit_agenda: "Agenda visit", visit_meet: "Ketemu siapa",
  next_action: "Next action", phone: "Telepon", email: "Email", website: "Website",
  key_person: "Key person", key_person_title: "Jabatan key person", product: "Produk",
  city: "Kota", priority: "Prioritas",
};

// Kelas input/textarea dark yang dipake berulang kali di review stage -
// disatuin di sini biar konsisten & gak diketik ulang tiap field.
const darkInput = "w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-400/50 focus:bg-white/[0.06] transition-colors";
const darkLabel = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export default function QuickVoiceNoteModal({ leads, stages, settings, onClose, onSaved }) {
  const [stage, setStage] = useState("idle"); // idle | recording | processing | review | error
  const [seconds, setSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState("uploading"); // uploading | transcribing
  const [quota, setQuota] = useState(null); // { used, max }

  const [action, setAction] = useState("update_lead");
  const [lead, setLead] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [progressNote, setProgressNote] = useState("");
  const [updates, setUpdates] = useState({});
  const [cancelVisit, setCancelVisit] = useState(false);
  const [closeResult, setCloseResult] = useState("won");
  const [newLead, setNewLead] = useState(null);
  const [emailDraft, setEmailDraft] = useState(null); // { subject, body }
  const [emailLoading, setEmailLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    db.getQuickVoiceQuota().then(setQuota).catch(() => setQuota(null));
  }, []);

  // Draft email di-fetch TERPISAH (bukan bagian respons quick-progress-note)
  // - reuse fungsi draft-followup yang sama dipake tombol "AI Draft" di
  // LeadModal, biar cache 24 jam & rate limit 5x/hari-nya ikut kepake juga
  // di sini, gak duplikat logic.
  useEffect(() => {
    if (stage !== "review" || action !== "send_email" || !lead || emailDraft || emailLoading) return;
    setEmailLoading(true);
    db.draftFollowup(lead.id, "email")
      .then((d) => setEmailDraft({ subject: d.subject || "", body: d.body || "" }))
      .catch((e) => setErrMsg(e.message || "Gagal bikin draft email"))
      .finally(() => setEmailLoading(false));
  }, [stage, action, lead, emailDraft, emailLoading]);

  const matches = q.trim() ? (leads || []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  const startRecording = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
      });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 48000 });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = mr;
      mr.start();
      setStage("recording");
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          if (next >= MAX_RECORDING_SECONDS) setTimeout(() => finishRecording(), 0);
          return next;
        });
      }, 1000);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      alert("Gagal akses mic. Pastikan izin mikrofon diaktifkan di browser/HP Anda.");
    }
  };

  const finishRecording = () => {
    clearInterval(timerRef.current);
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    setProcessingStep("uploading");
    setStage("processing");
    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const path = await db.uploadQuickVoiceNote(blob);
        setProcessingStep("transcribing");
        const result = await db.transcribeQuickVoiceNote(path);
        setTranscript(result.transcript || "");
        setAction(result.action || "update_lead");
        setProgressNote(result.progress_note || "");
        // Cuma masukin field yang beneran keisi (bukan null) - biar gak
        // nampilin form kosong buat field yang gak disebut sama sekali.
        const filledUpdates = {};
        for (const [k, v] of Object.entries(result.updates || {})) if (v !== null && v !== undefined && v !== "") filledUpdates[k] = v;
        setUpdates(filledUpdates);
        setCancelVisit(!!result.cancel_visit);
        setCloseResult(result.result || "won");
        setNewLead(result.new_lead || null);
        setConfidence(result.confidence || null);
        if (result.quota) setQuota(result.quota);
        const matchedLead = result.lead_id ? (leads || []).find((l) => l.id === result.lead_id) : null;
        setLead(matchedLead ? { id: matchedLead.id, name: matchedLead.name } : (result.lead_id ? { id: result.lead_id, name: result.lead_name } : null));
        setStage("review");
      } catch (e) {
        setErrMsg(e.message || "Gagal proses rekaman.");
        setStage("error");
      }
    };
    mr.stop();
  };

  const stopRecording = () => {
    if (seconds < 2) {
      clearInterval(timerRef.current);
      const mr = mediaRecorderRef.current;
      if (mr) mr.stream.getTracks().forEach((t) => t.stop());
      setStage("idle");
      alert("Rekamannya kependekan, coba lagi ya.");
      return;
    }
    finishRecording();
  };

  const cancelRecording = () => {
    clearInterval(timerRef.current);
    const mr = mediaRecorderRef.current;
    if (mr) mr.stream.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    onClose();
  };

  const setUpdateField = (key, value) => setUpdates((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      if (action === "update_lead") {
        if (!lead) throw new Error("Pilih lead-nya dulu.");
        const existing = (leads || []).find((l) => l.id === lead.id) || {};
        const merged = { ...existing, id: lead.id };
        for (const [k, v] of Object.entries(updates)) if (v !== "" && v != null) merged[k] = v;
        if (cancelVisit) { merged.visit_date = null; merged.visit_agenda = ""; merged.visit_meet = ""; }
        await db.upsertLead(merged);
        if (progressNote.trim()) await db.addProgress(lead.id, progressNote.trim());
      } else if (action === "close_lead") {
        if (!lead) throw new Error("Pilih lead-nya dulu.");
        const existing = (leads || []).find((l) => l.id === lead.id) || {};
        const wonLostStage = (stages || []).find((s) => s.type === closeResult);
        await db.upsertLead({ ...existing, id: lead.id, stage_key: wonLostStage?.key || existing.stage_key });
        await db.saveOutcome(lead.id, { result: closeResult, reason_category: "", reason: progressNote.trim(), ai_generated: true });
      } else if (action === "create_lead") {
        if (!newLead?.name?.trim()) throw new Error("Nama lead baru wajib diisi.");
        const stageKey = (stages || [])[0]?.key || "";
        const saved = await db.upsertLead({ ...newLead, stage_key: stageKey });
        if (progressNote.trim()) await db.addProgress(saved.id, progressNote.trim());
      } else if (action === "delete_lead") {
        if (!lead) throw new Error("Pilih lead-nya dulu.");
        if (!window.confirm(`Yakin mau hapus lead "${lead.name}"? (masuk Recycle Bin, masih bisa dipulihin nanti)`)) { setBusy(false); return; }
        await db.deleteLead(lead.id);
      } else if (action === "send_email") {
        if (!lead) throw new Error("Pilih lead-nya dulu.");
        const existing = (leads || []).find((l) => l.id === lead.id) || {};
        if (!existing.email) throw new Error("Lead ini belum punya email tercatat - isi dulu di tab Leads.");
        if (!emailDraft?.subject?.trim() || !emailDraft?.body?.trim()) throw new Error("Draft email kosong.");
        await db.sendLeadEmail({ lead_id: lead.id, to_email: existing.email, to_name: existing.name, subject: emailDraft.subject, body: emailDraft.body, sender_name: settings?.community_display_name });
      }
      onSaved();
    } catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };

  const meta = ACTION_META[action] || ACTION_META.update_lead;
  const ActionIcon = meta.icon;
  const needsLead = action === "update_lead" || action === "close_lead" || action === "delete_lead" || action === "send_email";
  const canSave = action === "create_lead" ? !!newLead?.name?.trim() : !!lead;

  return createPortal(
    <div className="fixed inset-0 bg-[#050810]/80 backdrop-blur-sm flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto">
      <div
        className="relative w-full max-w-[420px] my-8 rounded-[28px] overflow-hidden border border-white/10 shadow-[0_40px_100px_-30px_rgba(0,0,0,.8)]"
        style={{ background: "#0b0f1c" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient - echo dari kartu "NEX AI" di Dashboard (radial
            oranye+violet di atas dasar gelap), biar identitas AI-nya
            konsisten di seluruh app, bukan warna baru yang asing. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 85% -10%, rgba(167,139,250,.25), transparent 45%), radial-gradient(circle at -10% 110%, rgba(249,115,22,.18), transparent 45%)" }}
        />

        <div className="relative p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <h2 className="font-bold text-[15px] tracking-tight text-white flex items-center gap-1.5">
                <Zap size={15} className="text-orange-400" /> Catat Cepat
              </h2>
            </div>
            <button onClick={stage === "recording" ? cancelRecording : onClose} className="text-slate-500 hover:text-white transition-colors" aria-label="Tutup"><X size={18} /></button>
          </div>

          {quota && stage === "idle" && (
            <div className="mt-4 mb-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                <span>Kuota bulan ini</span>
                <span className="font-mono tabular-nums text-slate-400">{quota.used}/{quota.max}</span>
              </div>
              <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-violet-400" style={{ width: `${Math.min(100, (quota.used / quota.max) * 100)}%` }} />
              </div>
            </div>
          )}
          {stage !== "idle" && <div className="mb-2" />}

          {stage === "idle" && (
            <div className="text-center py-9">
              <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-orange-500/20" />
                <span className="absolute inset-2 rounded-full border border-orange-500/10 animate-pulse" style={{ animationDuration: "2.4s" }} />
                <button onClick={startRecording} className="relative z-10 w-[72px] h-[72px] rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-[0_0_40px_-8px_rgba(249,115,22,.75)] hover:shadow-[0_0_55px_-6px_rgba(249,115,22,.9)] transition-shadow">
                  <Mic size={26} />
                </button>
              </div>
              <p className="text-[12.5px] text-slate-400 mt-5 leading-5 max-w-[280px] mx-auto">
                Tekan, ngomong bebas — update progress, jadwal visit, tutup deal, lead baru, dll. <span className="text-violet-300">AI</span> yang ngurus sisanya.
              </p>
            </div>
          )}

          {stage === "recording" && (
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-[3px] h-9 mb-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-orange-500 to-orange-300 animate-pulse"
                    style={{ height: `${10 + (i % 4) * 7}px`, animationDelay: `${i * 90}ms`, animationDuration: "900ms" }}
                  />
                ))}
              </div>
              <div className={`font-mono text-[32px] font-bold tabular-nums ${seconds >= MAX_RECORDING_SECONDS - 15 ? "text-rose-400" : "text-white"}`}>
                {fmtTimer(seconds)} <span className="text-[14px] font-medium text-slate-500">/ {fmtTimer(MAX_RECORDING_SECONDS)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 mb-6">Maks 3 menit - buat catatan cepat</p>
              <div className="relative mx-auto w-20 h-20">
                <span className="absolute inset-0 rounded-full bg-rose-500/25 animate-ping" style={{ animationDuration: "1.6s" }} />
                <button onClick={stopRecording} className="absolute inset-0 m-auto h-[72px] w-[72px] rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_35px_-6px_rgba(225,29,72,.8)]">
                  <Square size={20} fill="white" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-4">Lagi rekam… tekan buat stop</p>
            </div>
          )}

          {stage === "processing" && (
            <div className="text-center py-12">
              <div className="relative mx-auto w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-orange-400 border-r-violet-400 border-b-transparent border-l-transparent animate-spin" />
              </div>
              <p className="text-sm text-slate-300">{processingStep === "uploading" ? "Ngirim rekaman…" : "Mentranskrip & mikirin aksinya…"}</p>
              <p className="text-xs text-slate-500 mt-1">Biasanya sekitar 15-30 detik</p>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-8">
              <AlertTriangle size={22} className="mx-auto text-rose-400 mb-3" />
              <p className="text-sm text-rose-300 mb-4">{errMsg}</p>
              <button onClick={() => setStage("idle")} className="text-sm border border-white/10 text-slate-300 rounded-xl px-4 py-2 hover:bg-white/5 transition-colors">Coba lagi</button>
            </div>
          )}

          {stage === "review" && (
            <div>
              <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border mb-3 ${meta.chip}`}>
                <ActionIcon size={12} /> {meta.label}
              </div>

              {action === "create_lead" ? (
                <div className="grid gap-2 mb-3">
                  <input className={darkInput} placeholder="Nama perusahaan *" value={newLead?.name || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={darkInput} placeholder="Key person" value={newLead?.key_person || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), key_person: e.target.value }))} />
                    <input className={darkInput} placeholder="Kota" value={newLead?.city || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), city: e.target.value }))} />
                    <input className={darkInput} placeholder="Telepon" value={newLead?.phone || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), phone: e.target.value }))} />
                    <input className={darkInput} placeholder="Produk" value={newLead?.product || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), product: e.target.value }))} />
                  </div>
                </div>
              ) : needsLead ? (
                <>
                  <span className={darkLabel}>Lead</span>
                  {lead ? (
                    <div className="mt-1.5 mb-3 flex items-center justify-between border border-orange-400/25 bg-orange-500/[0.06] rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {confidence === "high" ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                        <span className="text-sm font-medium text-slate-100">{lead.name}</span>
                      </div>
                      <button onClick={() => { setLead(null); setEmailDraft(null); }} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">ganti</button>
                    </div>
                  ) : (
                    <div className="mt-1.5 mb-3">
                      <p className="text-xs text-amber-400 mb-1.5 flex items-center gap-1"><AlertTriangle size={12} /> AI gak yakin ini lead yang mana, pilih manual:</p>
                      <div className="relative">
                        <Search size={15} className="absolute left-2.5 top-3 text-slate-500" />
                        <input autoFocus className={`${darkInput} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
                      </div>
                      {matches.length > 0 && (
                        <div className="mt-1 border border-white/10 rounded-xl bg-[#0f1424] shadow-lg max-h-52 overflow-y-auto divide-y divide-white/5">
                          {matches.map((c) => <div key={c.id} onClick={() => { setLead({ id: c.id, name: c.name }); setQ(""); }} className="px-3 py-2 text-sm text-slate-200 hover:bg-white/5 cursor-pointer">{c.name}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              {action === "update_lead" && Object.keys(updates).length > 0 && (
                <div className="mb-3 grid gap-2">
                  <span className={darkLabel}>Field yang berubah</span>
                  {Object.entries(updates).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 w-32 shrink-0">{FIELD_LABELS[k] || k}</span>
                      {k === "priority" ? (
                        <select className={`${darkInput} flex-1 py-1.5`} value={v} onChange={(e) => setUpdateField(k, e.target.value)}>
                          <option value="high" className="bg-[#0f1424]">Tinggi</option>
                          <option value="medium" className="bg-[#0f1424]">Sedang</option>
                          <option value="low" className="bg-[#0f1424]">Rendah</option>
                        </select>
                      ) : k === "visit_date" ? (
                        <input type="date" className={`${darkInput} flex-1 py-1.5 [color-scheme:dark]`} value={v} onChange={(e) => setUpdateField(k, e.target.value)} />
                      ) : (
                        <input className={`${darkInput} flex-1 py-1.5`} value={v} onChange={(e) => setUpdateField(k, e.target.value)} />
                      )}
                    </div>
                  ))}
                  {(updates.visit_date || updates.visit_agenda || updates.visit_meet) && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <input type="checkbox" checked={cancelVisit} onChange={(e) => setCancelVisit(e.target.checked)} /> Batalin jadwal visit ini (bukan pindah tanggal)
                    </label>
                  )}
                </div>
              )}

              {action === "close_lead" && (
                <div className="mb-3 flex gap-2">
                  <button onClick={() => setCloseResult("won")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${closeResult === "won" ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-500 hover:border-white/20"}`}><Trophy size={14} /> Menang</button>
                  <button onClick={() => setCloseResult("lost")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${closeResult === "lost" ? "bg-rose-500/10 border-rose-400/40 text-rose-300" : "border-white/10 text-slate-500 hover:border-white/20"}`}><XCircle size={14} /> Kalah</button>
                </div>
              )}

              {action === "send_email" && lead && (
                emailLoading ? (
                  <div className="mb-3 text-center py-6"><Loader2 size={22} className="mx-auto text-orange-400 animate-spin" /><p className="text-xs text-slate-500 mt-2">Bikin draft email…</p></div>
                ) : emailDraft ? (
                  <div className="mb-3 grid gap-2">
                    <input className={`${darkInput} font-medium`} value={emailDraft.subject} onChange={(e) => setEmailDraft((p) => ({ ...p, subject: e.target.value }))} placeholder="Subjek" />
                    <textarea className={darkInput} rows={6} value={emailDraft.body} onChange={(e) => setEmailDraft((p) => ({ ...p, body: e.target.value }))} />
                  </div>
                ) : null
              )}

              {action !== "send_email" && (
                <>
                  <span className={darkLabel}>{action === "close_lead" ? "Alasan (opsional)" : "Progress"}</span>
                  <textarea className={`${darkInput} mt-1.5`} rows={4} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} />
                </>
              )}

              <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-slate-500 hover:text-slate-300 mt-2.5 transition-colors">
                {showTranscript ? "Sembunyikan" : "Lihat"} transkrip mentah
              </button>
              {showTranscript && <div className="mt-2 text-xs text-slate-400 bg-white/[0.03] border border-white/10 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{transcript}</div>}

              <button
                onClick={save}
                disabled={busy || !canSave || (action === "send_email" && (emailLoading || !emailDraft))}
                className={`w-full mt-4 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${action === "delete_lead" ? "bg-rose-600 hover:bg-rose-500" : "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-[0_8px_24px_-8px_rgba(249,115,22,.6)]"}`}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : action === "delete_lead" ? <Trash2 size={15} /> : action === "send_email" ? <Mail size={15} /> : <Save size={15} />}
                {action === "delete_lead" ? "Hapus Lead" : action === "send_email" ? "Kirim Email" : action === "close_lead" ? "Tutup Deal" : action === "create_lead" ? "Simpan Lead Baru" : "Simpan ke Progress"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
