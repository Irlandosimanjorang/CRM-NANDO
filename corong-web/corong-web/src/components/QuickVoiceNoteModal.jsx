// Catat Cepat (21 Sep 2026, permintaan Nando: "lebih praktis dibanding buka
// Telegram bot") - dibuka dari PWA shortcut (long-press icon Nexto di HP,
// lihat "shortcuts" di manifest.json -> /?quickvoice=1, dibaca App.jsx).
// Beda dari MeetingRecorderModal: user GAK milih lead dulu - tinggal pencet
// rekam & ngomong, AI (quick-progress-note edge function, pipeline sama
// kayak Bot Telegram: Whisper transkrip + Claude) yang NEBAK lead mana yang
// dimaksud dari isi omongan. Hasil tetep direview manual sebelum Simpan -
// kalau tebakan AI salah/gak ketemu, ada pencarian buat ganti lead manual.
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, X, Save, Loader2, Search, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import * as db from "../lib/db";

function fmtTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const MAX_RECORDING_SECONDS = 3 * 60; // catatan cepat - gak perlu selama Rekam Meeting (30 menit)

export default function QuickVoiceNoteModal({ leads, onClose, onSaved }) {
  const [stage, setStage] = useState("idle"); // idle | recording | processing | review | error
  const [seconds, setSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState("uploading"); // uploading | transcribing
  const [note, setNote] = useState("");
  const [lead, setLead] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

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
        setNote(result.progress_note || result.transcript || "");
        setTranscript(result.transcript || "");
        setConfidence(result.confidence || null);
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

  const save = async () => {
    if (!lead) { alert("Pilih lead-nya dulu."); return; }
    if (!note.trim()) { alert("Catatannya kosong."); return; }
    setBusy(true);
    try {
      await db.addProgress(lead.id, note.trim());
      onSaved();
    } catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };

  const isBusyStage = stage === "recording" || stage === "processing";

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={isBusyStage ? undefined : onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Zap size={18} className="text-orange-500" /> Catat Cepat</h2>
          <button onClick={stage === "recording" ? cancelRecording : onClose} className="text-slate-400 hover:text-slate-700" aria-label="Tutup"><X size={20} /></button>
        </div>

        {stage === "idle" && (
          <div className="text-center py-8">
            <button onClick={startRecording} className="w-16 h-16 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-600/30">
              <Mic size={24} />
            </button>
            <p className="text-xs text-slate-400 mt-3">Tekan, ngomong update lead-nya - AI yang nyari lead-nya sendiri</p>
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
            <p className="text-sm text-slate-500">{processingStep === "uploading" ? "Ngirim rekaman…" : "Mentranskrip & nyari lead-nya…"}</p>
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
            <span className="text-xs font-medium text-slate-500">Lead</span>
            {lead ? (
              <div className="mt-1 mb-3 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {confidence === "high" ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span className="text-sm font-medium">{lead.name}</span>
                </div>
                <button onClick={() => setLead(null)} className="text-xs text-slate-500 hover:text-rose-500">ganti</button>
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

            <span className="text-xs font-medium text-slate-500">Progress (bisa diedit sebelum disimpan)</span>
            <textarea className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" rows={5} value={note} onChange={(e) => setNote(e.target.value)} />

            <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600 mt-2">
              {showTranscript ? "Sembunyikan" : "Lihat"} transkrip mentah
            </button>
            {showTranscript && <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{transcript}</div>}

            <button onClick={save} disabled={busy || !lead} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan ke Progress
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
