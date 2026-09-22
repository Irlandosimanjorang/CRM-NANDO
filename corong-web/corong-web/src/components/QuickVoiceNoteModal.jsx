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
  update_lead: { label: "Update Lead", icon: RefreshCw, color: "text-sky-600 bg-sky-50 border-sky-200" },
  close_lead: { label: "Tutup Deal", icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  create_lead: { label: "Lead Baru", icon: UserPlus, color: "text-violet-600 bg-violet-50 border-violet-200" },
  delete_lead: { label: "Hapus Lead", icon: Trash2, color: "text-rose-600 bg-rose-50 border-rose-200" },
  send_email: { label: "Kirim Email", icon: Mail, color: "text-orange-600 bg-orange-50 border-orange-200" },
};

const FIELD_LABELS = {
  visit_date: "Tanggal visit", visit_agenda: "Agenda visit", visit_meet: "Ketemu siapa",
  next_action: "Next action", phone: "Telepon", email: "Email", website: "Website",
  key_person: "Key person", key_person_title: "Jabatan key person", product: "Produk",
  city: "Kota", priority: "Prioritas",
};

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

  const isBusyStage = stage === "recording" || stage === "processing";
  const meta = ACTION_META[action] || ACTION_META.update_lead;
  const ActionIcon = meta.icon;
  const needsLead = action === "update_lead" || action === "close_lead" || action === "delete_lead" || action === "send_email";
  const canSave = action === "create_lead" ? !!newLead?.name?.trim() : !!lead;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2"><Zap size={18} className="text-orange-500" /> Catat Cepat</h2>
          <button onClick={stage === "recording" ? cancelRecording : onClose} className="text-slate-400 hover:text-slate-700" aria-label="Tutup"><X size={20} /></button>
        </div>
        {quota && stage === "idle" && (
          <p className="text-[11px] text-slate-400 mb-3">{quota.used}/{quota.max} dipake bulan ini</p>
        )}
        {stage !== "idle" && <div className="mb-3" />}

        {stage === "idle" && (
          <div className="text-center py-8">
            <button onClick={startRecording} className="w-16 h-16 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-600/30">
              <Mic size={24} />
            </button>
            <p className="text-xs text-slate-400 mt-3">Tekan, ngomong bebas - update progress, jadwal visit, tutup deal, lead baru, dll. AI yang ngurus sisanya</p>
          </div>
        )}

        {stage === "recording" && (
          <div className="text-center py-8">
            <div className={`text-3xl font-mono font-bold mb-1 ${seconds >= MAX_RECORDING_SECONDS - 15 ? "text-rose-600" : "text-slate-800"}`}>
              {fmtTimer(seconds)} <span className="text-base font-medium text-slate-400">/ {fmtTimer(MAX_RECORDING_SECONDS)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Maks 3 menit - buat catatan cepat, bukan rekam meeting panjang</p>
            <div className="relative mx-auto h-[76px] w-[76px]">
              <svg viewBox="0 0 76 76" className="absolute inset-0 h-full w-full animate-[spin_1.4s_linear_infinite]">
                <circle cx="38" cy="38" r="34" fill="none" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="70 143" />
              </svg>
              <button onClick={stopRecording} className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
                <Square size={20} fill="white" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-3">Lagi rekam… tekan buat stop</p>
          </div>
        )}

        {stage === "processing" && (
          <div className="text-center py-10">
            <Loader2 size={32} className="mx-auto text-orange-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500">{processingStep === "uploading" ? "Ngirim rekaman…" : "Mentranskrip & mikirin aksinya…"}</p>
            <p className="text-xs text-slate-400 mt-1">Biasanya sekitar 15-30 detik</p>
          </div>
        )}

        {stage === "error" && (
          <div className="text-center py-8">
            <p className="text-sm text-rose-600 mb-4">{errMsg}</p>
            <button onClick={() => setStage("idle")} className="text-sm border border-slate-300 rounded-xl px-4 py-2 hover:bg-slate-50">Coba lagi</button>
          </div>
        )}

        {stage === "review" && (
          <div>
            <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border mb-3 ${meta.color}`}>
              <ActionIcon size={12} /> {meta.label}
            </div>

            {action === "create_lead" ? (
              <div className="grid gap-2 mb-3">
                <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Nama perusahaan *" value={newLead?.name || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Key person" value={newLead?.key_person || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), key_person: e.target.value }))} />
                  <input className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Kota" value={newLead?.city || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), city: e.target.value }))} />
                  <input className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Telepon" value={newLead?.phone || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), phone: e.target.value }))} />
                  <input className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Produk" value={newLead?.product || ""} onChange={(e) => setNewLead((p) => ({ ...(p || {}), product: e.target.value }))} />
                </div>
              </div>
            ) : needsLead ? (
              <>
                <span className="text-xs font-medium text-slate-500">Lead</span>
                {lead ? (
                  <div className="mt-1 mb-3 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {confidence === "high" ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                      <span className="text-sm font-medium">{lead.name}</span>
                    </div>
                    <button onClick={() => { setLead(null); setEmailDraft(null); }} className="text-xs text-slate-500 hover:text-rose-500">ganti</button>
                  </div>
                ) : (
                  <div className="mt-1 mb-3">
                    <p className="text-xs text-amber-600 mb-1.5 flex items-center gap-1"><AlertTriangle size={12} /> AI gak yakin ini lead yang mana, pilih manual:</p>
                    <div className="relative">
                      <Search size={15} className="absolute left-2.5 top-3 text-slate-400" />
                      <input autoFocus className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
                    </div>
                    {matches.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-sm max-h-52 overflow-y-auto">
                        {matches.map((c) => <div key={c.id} onClick={() => { setLead({ id: c.id, name: c.name }); setQ(""); }} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0">{c.name}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}

            {action === "update_lead" && Object.keys(updates).length > 0 && (
              <div className="mb-3 grid gap-2">
                <span className="text-xs font-medium text-slate-500">Field yang berubah</span>
                {Object.entries(updates).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 w-32 shrink-0">{FIELD_LABELS[k] || k}</span>
                    {k === "priority" ? (
                      <select className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white" value={v} onChange={(e) => setUpdateField(k, e.target.value)}>
                        <option value="high">Tinggi</option><option value="medium">Sedang</option><option value="low">Rendah</option>
                      </select>
                    ) : k === "visit_date" ? (
                      <input type="date" className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg" value={v} onChange={(e) => setUpdateField(k, e.target.value)} />
                    ) : (
                      <input className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg" value={v} onChange={(e) => setUpdateField(k, e.target.value)} />
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
                <button onClick={() => setCloseResult("won")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${closeResult === "won" ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "border-slate-200 text-slate-400"}`}><Trophy size={14} /> Menang</button>
                <button onClick={() => setCloseResult("lost")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${closeResult === "lost" ? "bg-rose-50 border-rose-400 text-rose-700" : "border-slate-200 text-slate-400"}`}><XCircle size={14} /> Kalah</button>
              </div>
            )}

            {action === "send_email" && lead && (
              emailLoading ? (
                <div className="mb-3 text-center py-6"><Loader2 size={22} className="mx-auto text-orange-500 animate-spin" /><p className="text-xs text-slate-400 mt-2">Bikin draft email…</p></div>
              ) : emailDraft ? (
                <div className="mb-3 grid gap-2">
                  <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-medium" value={emailDraft.subject} onChange={(e) => setEmailDraft((p) => ({ ...p, subject: e.target.value }))} placeholder="Subjek" />
                  <textarea className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl" rows={6} value={emailDraft.body} onChange={(e) => setEmailDraft((p) => ({ ...p, body: e.target.value }))} />
                </div>
              ) : null
            )}

            {action !== "send_email" && (
              <>
                <span className="text-xs font-medium text-slate-500">{action === "close_lead" ? "Alasan (opsional)" : "Progress (bisa diedit sebelum disimpan)"}</span>
                <textarea className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" rows={4} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} />
              </>
            )}

            <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600 mt-2">
              {showTranscript ? "Sembunyikan" : "Lihat"} transkrip mentah
            </button>
            {showTranscript && <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{transcript}</div>}

            <button
              onClick={save}
              disabled={busy || !canSave || (action === "send_email" && (emailLoading || !emailDraft))}
              className={`w-full mt-4 disabled:opacity-60 text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 ${action === "delete_lead" ? "bg-rose-600 hover:bg-rose-700" : "bg-orange-600 hover:bg-orange-700"}`}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : action === "delete_lead" ? <Trash2 size={15} /> : action === "send_email" ? <Mail size={15} /> : <Save size={15} />}
              {action === "delete_lead" ? "Hapus Lead" : action === "send_email" ? "Kirim Email" : action === "close_lead" ? "Tutup Deal" : action === "create_lead" ? "Simpan Lead Baru" : "Simpan ke Progress"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
