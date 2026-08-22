import { useState, useRef } from "react";
import { Mic, Square, X, Save, Loader2, Search, FileAudio } from "lucide-react";
import * as db from "../lib/db";

function fmtTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MeetingRecorderModal({ lead: initialLead, leads, onClose, onSaved }) {
  const [lead, setLead] = useState(initialLead || null);
  const [q, setQ] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [stage, setStage] = useState("idle"); // idle | recording | processing | review | error
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const matches = !lead && q.trim() ? (leads || []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  const startRecording = async () => {
    try {
      // Setting audio khusus buat nangkep suara jarak agak jauh/pelan lebih baik:
      // - autoGainControl: browser otomatis "naikin volume" suara yang pelan/jauh
      // - noiseSuppression tetep nyala (bantu kejernihan, bukan ngeredam suara)
      // - echoCancellation DIMATIKAN - ini fitur buat video call (nge-cancel suara
      //   speaker HP sendiri biar ga kedengeran balik di mic), TAPI algoritmanya
      //   suka salah nebak suara jarak jauh/pelan sebagai "noise" terus diredam.
      //   Buat rekam meeting (bukan panggilan 2 arah), fitur ini ga perlu & malah ngerugiin.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      chunksRef.current = [];
      // Bitrate dinaikin ke 96kbps (dari default yang suka lebih rendah) - detail
      // suara pelan/jauh lebih kejaga, ga ilang gara-gara kompresi kasar. Masih
      // aman soal ukuran file (25 menit rekaman ~18MB, di bawah limit Whisper 25MB).
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 96000 });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = mr;
      mr.start();
      setStage("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      alert("Gagal akses mic. Pastikan izin mikrofon diaktifkan di browser/HP kamu.");
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    // Rekaman kependekan (misal ke-tap gak sengaja) - gausah buang-buang panggilan
    // API buat proses audio yang hampir kosong.
    if (seconds < 3) {
      mr.stream.getTracks().forEach((t) => t.stop());
      setStage("idle");
      alert("Rekamannya kependekan, coba lagi ya.");
      return;
    }
    setStage("processing");
    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const path = await db.uploadMeetingAudio(lead.id, blob);
        const result = await db.transcribeMeeting(path, lead.name);
        setNotes(result.notes || "");
        setTranscript(result.transcript || "");
        setStage("review");
      } catch (e) {
        setErrMsg(e.message || "Gagal proses rekaman.");
        setStage("error");
      }
    };
    mr.stop();
  };

  const save = async () => {
    if (!notes.trim()) { alert("Catatannya kosong."); return; }
    setBusy(true);
    try {
      await db.addProgress(lead.id, notes.trim());
      onSaved();
      onClose();
    } catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileAudio size={18} className="text-orange-500" /> Rekam Meeting</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {!lead ? (
          <div>
            <span className="text-xs font-medium text-slate-500">Company *</span>
            <div className="relative mt-1">
              <Search size={15} className="absolute left-2.5 top-3 text-slate-400" />
              <input autoFocus className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
            </div>
            {matches.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-sm max-h-52 overflow-y-auto">
                {matches.map((c) => <div key={c.id} onClick={() => { setLead(c); setQ(""); }} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0">{c.name}</div>)}
              </div>
            )}
            {q.trim() && matches.length === 0 && <p className="text-xs text-slate-400 mt-1">Company ga ketemu. Tambahin di tab Leads dulu.</p>}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2">
              <span className="text-sm font-medium">{lead.name}</span>
              {stage === "idle" && !initialLead && <button onClick={() => setLead(null)} className="text-xs text-slate-500 hover:text-rose-500">ganti</button>}
            </div>

            {stage === "idle" && (
              <div className="text-center py-8">
                <button onClick={startRecording} className="w-16 h-16 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-600/30">
                  <Mic size={24} />
                </button>
                <p className="text-xs text-slate-400 mt-3">Tekan buat mulai rekam meeting</p>
              </div>
            )}

            {stage === "recording" && (
              <div className="text-center py-8">
                <div className="text-3xl font-mono font-bold text-slate-800 mb-3">{fmtTimer(seconds)}</div>
                <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-600/30 animate-pulse">
                  <Square size={20} fill="white" />
                </button>
                <p className="text-xs text-slate-400 mt-3">Lagi rekam… tekan buat stop</p>
              </div>
            )}

            {stage === "processing" && (
              <div className="text-center py-10">
                <Loader2 size={32} className="mx-auto text-orange-500 animate-spin mb-3" />
                <p className="text-sm text-slate-500">Transkrip &amp; rapiin catatan…</p>
                <p className="text-xs text-slate-400 mt-1">Bisa beberapa puluh detik ya</p>
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
                <span className="text-xs font-medium text-slate-500">Catatan meeting (bisa diedit sebelum disimpan)</span>
                <textarea className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600 mt-2">
                  {showTranscript ? "Sembunyikan" : "Lihat"} transkrip mentah
                </button>
                {showTranscript && <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{transcript}</div>}
                <button onClick={save} disabled={busy} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan ke Progress
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
