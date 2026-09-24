import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, X, Save, Loader2, Search, FileAudio } from "lucide-react";
import * as db from "../lib/db";
import { saveOpenModal, clearOpenModal, getOpenModal } from "../lib/uiPersist";

function fmtTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Batas rekaman 30 menit (permintaan Nando, 12 Sep 2026) - begitu kena batas,
// rekaman OTOMATIS diberhentiin dan LANGSUNG lanjut ke transkrip (bukan
// dibuang/dianggap error) - user gak kehilangan hasil meeting-nya cuma
// karena kelamaan.
const MAX_RECORDING_SECONDS = 30 * 60;

export default function MeetingRecorderModal({ lead: initialLead, leads, onClose, onSaved }) {
  // BUG FIX (17 Sep 2026, laporan Nando): hasil transkrip yang UDAH SELESAI
  // (tahap review) sebelumnya cuma hidup di state React - ilang total kalau
  // tab-nya di-discard browser/OS (pindah tab lain sebentar, balik lagi).
  // Bikin user rugi nunggu proses transkrip 2x kalau kejadian gini. Beda dari
  // tahap recording (buffer audio beneran gak bisa "dilanjutin"), hasil review
  // murni teks (notes/next action/transcript) - gampang disimpen & di-restore
  // lewat localStorage yang sama, sama pola kayak modal lain (lihat
  // uiPersist.js). Dibaca lewat useState (bukan konstanta level module) biar
  // ke-refresh tiap kali modal ini di-mount ulang, bukan kesangkut ke draft
  // basi dari mount PERTAMA doang di sesi ini.
  const [restoreDraft] = useState(() => getOpenModal("meetingreview"));
  const [lead, setLead] = useState(() => initialLead || (restoreDraft ? { id: restoreDraft.leadId, name: restoreDraft.leadName } : null));
  const [q, setQ] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [stage, setStage] = useState(() => (restoreDraft ? "review" : "idle")); // idle | recording | processing | review | error
  const [notes, setNotes] = useState(() => restoreDraft?.notes || "");
  const [nextAction, setNextAction] = useState(() => restoreDraft?.nextAction || "");
  const [transcript, setTranscript] = useState(() => restoreDraft?.transcript || "");
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  // Sub-tahap pas stage === "processing" - biar user tau lagi ngapain
  // (upload vs transkrip), bukan spinner generik doang yang kerasa "macet"
  // buat rekaman panjang. recordedSeconds dicatet KHUSUS pas mulai proses,
  // biar tetep akurat walau `seconds` kepake lagi buat rekaman berikutnya.
  const [processingStep, setProcessingStep] = useState("uploading"); // uploading | transcribing
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const wakeLockRef = useRef(null);
  // Selalu nyimpen detik terkini - dibaca finishRecording() sebagai
  // pengganti state `seconds` biar aman dipanggil dari closure interval
  // lama (auto-stop di batas 30 menit) yang gak akan pernah nge-refresh
  // ke render terbaru.
  const secondsRef = useRef(0);

  // Layar HP wajib nyala terus selama recording (permintaan Nando, 12 Sep
  // 2026) - meeting bisa sampe 30 menit, kalau layar mati/terkunci di
  // tengah jalan resiko rekaman kepotong (browser/OS bisa nge-suspend tab
  // pas layar mati di beberapa HP). Wake Lock API - gagal diam-diam kalau
  // browser gak support (Safari lama dll), gak bikin recording gagal.
  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (_) { /* gak didukung / ditolak - rekaman tetep jalan normal */ }
  };
  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); } catch (_) {}
    wakeLockRef.current = null;
  };

  // Beberapa browser OTOMATIS ngelepas wake lock pas tab disembunyiin
  // (pindah app lain sebentar), dan gak ngembaliin sendiri pas balik lagi
  // - kalau lagi recording, coba ambil ulang biar layar tetep nyala begitu
  // user balik ke tab ini. Efek ini SENGAJA gak nge-release apa-apa di
  // cleanup-nya (beda dari efek unmount di bawah) - kalau ikut nge-release
  // di sini, tiap pindah stage (idle->recording) bakal langsung nge-cancel
  // wake lock yang baru aja diambil acquireWakeLock() di startRecording().
  // FIX (24 Sep 2026): "processing" (upload+transkrip) ikut dicek juga di
  // sini, bukan cuma "recording" - wake lock sekarang ditahan sampe proses
  // itu kelar (lihat finishRecording), jadi kalau OS sempet ngelepasnya
  // paksa pas tab disembunyiin, harus ke-reacquire begitu balik lagi biar
  // gak sempet ke-drop di tengah upload rekaman panjang.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && (stage === "recording" || stage === "processing") && !wakeLockRef.current) acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stage]);

  // BUG FIX (audit 16 Sep 2026): safety net ini SEBELUMNYA cuma nge-release
  // wake lock doang pas modal ke-unmount - timer (setInterval) sama stream
  // mic-nya SENDIRI gak ikut kebersihin. Kalau modal ke-unmount pas lagi
  // recording (misal parent maksa nutup / navigasi lain), timer-nya jalan
  // terus SELAMANYA (gak ada lagi tombol buat stop, instance komponennya
  // udah ilang) dan lampu mic HP nyala terus padahal gak ada yang ngerekam
  // apa-apa lagi. Sekarang cleanup ini beresin SEMUANYA: timer, wake lock,
  // DAN stream mic-nya (kalau lagi aktif).
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      releaseWakeLock();
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        try { mr.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      }
    };
  }, []);

  const matches = !lead && q.trim() ? (leads || []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  const startRecording = async () => {
    let stream;
    try {
      // Setting audio khusus buat nangkep suara jarak agak jauh/pelan lebih baik:
      // - autoGainControl: browser otomatis "naikin volume" suara yang pelan/jauh
      // - noiseSuppression tetep nyala (bantu kejernihan, bukan ngeredam suara)
      // - echoCancellation DIMATIKAN - ini fitur buat video call (nge-cancel suara
      //   speaker HP sendiri biar ga kedengeran balik di mic), TAPI algoritmanya
      //   suka salah nebak suara jarak jauh/pelan sebagai "noise" terus diredam.
      //   Buat rekam meeting (bukan panggilan 2 arah), fitur ini ga perlu & malah ngerugiin.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      chunksRef.current = [];
      // BITRATE FIX (15 Sep 2026, keluhan Nando: upload rekaman lama) - 96kbps
      // (dinaikin sebelumnya biar suara pelan/jauh gak ilang) bikin file 20
      // menit ~13.7MB, kerasa lama di-upload pas koneksi lapangan lagi jelek.
      // Diturunin ke 48kbps - file jadi ~setengahnya (20 menit ~6.9MB, upload
      // ~2x lebih cepat), tapi Opus (codec WebM audio) didesain khusus buat
      // suara ngomong jadi kualitasnya masih terjaga wajar buat kebanyakan
      // kondisi - cuma suara yang BENERAN pelan/jauh yang sedikit lebih
      // beresiko kurang jelas dibanding 96kbps. Trade-off ini disetujui Nando.
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 48000 });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = mr;
      mr.start();
      acquireWakeLock();
      setStage("recording");
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          if (next >= MAX_RECORDING_SECONDS) {
            // Kena batas 30 menit - langsung distop & diproses (bukan
            // dibuang), setTimeout biar gak manggil finishRecording() di
            // tengah-tengah setState updater ini.
            setTimeout(() => finishRecording(), 0);
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      // Kalau getUserMedia sukses tapi MediaRecorder gagal dibuat (browser
      // gak dukung opsi codec/bitrate-nya), stream yang udah kebuka tadi
      // harus ditutup manual - kalau enggak, lampu mic HP nyala terus
      // padahal gak lagi ngerekam apa-apa.
      stream?.getTracks().forEach((t) => t.stop());
      alert("Gagal akses mic. Pastikan izin mikrofon diaktifkan di browser/HP Anda.");
    }
  };

  // Beneran ngestop MediaRecorder & lanjut ke transkrip - dipake baik buat
  // stop manual (tombol) MAUPUN auto-stop pas kena batas 30 menit. Gak
  // gantung ke state `seconds` sama sekali (aman dipanggil dari closure
  // interval yang direkam pas startRecording, gak akan pernah stale).
  const finishRecording = () => {
    clearInterval(timerRef.current);
    // BUG FIX (24 Sep 2026, laporan Nando: rekaman 20 menit error pas mau
    // transkrip). Wake lock SEBELUMNYA dilepas di sini, sebelum upload+
    // transkrip - buat rekaman panjang itu bisa makan 1-2 menit lebih, dan
    // kalau layar HP sempet mati/kekunci di rentang itu, browser mobile
    // suka mutusin koneksi fetch yang lagi jalan (walau di server function-
    // nya sendiri KELAR normal - kecek dari log, balikin 200 OK). Sekarang
    // wake lock ditahan terus sampe proses upload+transkrip beneran selesai
    // (sukses ATAU gagal), baru dilepas di situ.
    const mr = mediaRecorderRef.current;
    if (!mr) { releaseWakeLock(); return; }
    setRecordedSeconds(secondsRef.current);
    setProcessingStep("uploading");
    setStage("processing");
    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const path = await db.uploadMeetingAudio(lead.id, blob);
        setProcessingStep("transcribing");
        const result = await db.transcribeMeeting(path, lead.name);
        const restoredNotes = result.notes || "";
        const restoredNextAction = result.next_action || "";
        const restoredTranscript = result.transcript || "";
        setNotes(restoredNotes);
        setNextAction(restoredNextAction);
        setTranscript(restoredTranscript);
        setStage("review");
        saveOpenModal("meetingreview", { leadId: lead.id, leadName: lead.name, notes: restoredNotes, nextAction: restoredNextAction, transcript: restoredTranscript });
      } catch (e) {
        setErrMsg(e.message || "Gagal proses rekaman.");
        setStage("error");
      } finally {
        releaseWakeLock();
      }
    };
    mr.stop();
  };

  const stopRecording = () => {
    // Rekaman kependekan (misal ke-tap gak sengaja) - gausah buang-buang panggilan
    // API buat proses audio yang hampir kosong. Cek ini CUMA relevan buat stop
    // manual - auto-stop di batas 30 menit manggil finishRecording() langsung,
    // gak lewat sini.
    if (seconds < 3) {
      clearInterval(timerRef.current);
      releaseWakeLock();
      const mr = mediaRecorderRef.current;
      if (mr) mr.stream.getTracks().forEach((t) => t.stop());
      setStage("idle");
      alert("Rekamannya kependekan, coba lagi ya.");
      return;
    }
    finishRecording();
  };

  // Batalin rekaman yang lagi jalan - dipake KHUSUS dari tombol X pas
  // stage === "recording" (permintaan Nando, 12 Sep 2026: modal WAJIB
  // "stay" selama recording, cuma bisa dibatalin lewat tombol X, gak lewat
  // klik area gelap di belakangnya - kejadian gak sengaja ke-tap gelap
  // biasa bikin rekaman ilang tanpa sadar). Beda dari finishRecording():
  // ini BUANG audio-nya, gak ditranskrip sama sekali.
  const cancelRecording = () => {
    clearInterval(timerRef.current);
    releaseWakeLock();
    const mr = mediaRecorderRef.current;
    if (mr) mr.stream.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    onClose();
  };

  const save = async () => {
    if (!notes.trim()) { alert("Catatannya kosong."); return; }
    setBusy(true);
    try {
      await db.addProgress(lead.id, notes.trim());
      if (nextAction.trim()) await db.updateLeadNextAction(lead.id, nextAction.trim());
      clearOpenModal("meetingreview");
      onSaved();
      onClose();
    } catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };

  // Keep localStorage kesinkron tiap edit di tahap review (bukan cuma pas
  // pertama kali transkrip kelar) - kalau user sempet ngedit catatan dulu
  // baru ketutup gara-gara tab discard, editannya IKUT ke-restore, bukan
  // balik ke hasil transkrip mentah yang belum diedit.
  const updateReviewDraft = (patch) => {
    saveOpenModal("meetingreview", { leadId: lead.id, leadName: lead.name, notes, nextAction, transcript, ...patch });
  };

  // Pas lagi recording ATAU processing, modal WAJIB "stay" di layar - klik
  // area gelap di belakang gak boleh nutup. Recording: biar gak ke-tap gak
  // sengaja bikin rekaman ilang. Processing (BUG FIX audit 16 Sep 2026,
  // sebelumnya CUMA recording yang dilindungin ini): rekaman yang lagi
  // di-upload/ditranskrip bisa ke-discard kalau backdrop-nya diklik pas
  // lagi proses - hasil yang udah setengah jadi ilang percuma padahal
  // hampir kelar. Satu-satunya jalan keluar pas dua stage ini adalah
  // tombol X (cancelRecording pas recording; onClose biasa gak
  // ngebatalin proses yang lagi jalan di background, tapi minimal gak
  // ke-trigger gak sengaja lewat klik area gelap).
  const isRecordingLive = stage === "recording";
  const isBusyStage = stage === "recording" || stage === "processing";
  // Ditutup manual (bukan lewat Simpan) pas stage idle/review/error - hapus
  // draft yang kesimpen juga, biar gak nongol lagi sisa hasil transkrip yang
  // udah sengaja ditinggalin, sama pola kayak modal lain pas ditutup manual.
  const handleClose = () => { clearOpenModal("meetingreview"); onClose(); };

  // BUG FIX (17 Sep 2026, laporan Nando): createPortal ke document.body -
  // biar posisi "fixed" gak kekurung ancestor, presisi ke viewport beneran
  // (sebelumnya kelihatan nempel/kepotong ke tepi atas layar).
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={isBusyStage ? undefined : handleClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileAudio size={18} className="text-orange-500" /> Rekam Meeting</h2>
          <button onClick={isRecordingLive ? cancelRecording : handleClose} className="text-slate-400 hover:text-slate-700" aria-label={isRecordingLive ? "Batalin rekaman" : "Tutup"}><X size={20} /></button>
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
                <div className={`text-3xl font-mono font-bold mb-1 ${seconds >= MAX_RECORDING_SECONDS - 60 ? "text-rose-600" : "text-slate-800"}`}>
                  {fmtTimer(seconds)} <span className="text-base font-medium text-slate-400">/ {fmtTimer(MAX_RECORDING_SECONDS)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Maks 30 menit - kalau kena batas, otomatis stop &amp; langsung ditranskrip</p>
                {/* Animasi cincin muter ngelilingin tombol (bukan ngembang
                    kayak sebelumnya) - 1 lengkungan yang muter terus 360°,
                    kesannya kayak "lagi ngerekam/scanning" di sekitar
                    tombolnya. */}
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
                <p className="text-sm text-slate-500">
                  {processingStep === "uploading" ? "Ngirim rekaman…" : "Mentranskrip & rapiin catatan…"}
                </p>
                {/* Estimasi kasar - makin panjang rekamannya, makin jujur
                    kasih tau bakal makin lama (bukan "beberapa puluh detik"
                    generik buat semua durasi kayak sebelumnya, yang kerasa
                    "macet" pas rekamannya 10+ menit). */}
                <p className="text-xs text-slate-400 mt-1">
                  {recordedSeconds < 180
                    ? "Biasanya sekitar 30 detik"
                    : recordedSeconds < 600
                    ? "Rekaman segini biasanya 1-2 menit ya"
                    : "Rekaman panjang gini bisa 2-4 menit - Whisper transkrip proporsional sama durasi audio, sabar dikit ya"}
                </p>
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
                <textarea className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" rows={7} value={notes} onChange={(e) => { setNotes(e.target.value); updateReviewDraft({ notes: e.target.value }); }} />

                <label className="block mt-3">
                  <span className="text-xs font-medium text-slate-500">Next action (otomatis kedeteksi AI, bisa diedit/dikosongin)</span>
                  <input className="w-full mt-1 px-3 py-2 text-sm border border-orange-300 bg-orange-50/60 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" value={nextAction} onChange={(e) => { setNextAction(e.target.value); updateReviewDraft({ nextAction: e.target.value }); }} placeholder="Kosong (AI ga nemu next step yang jelas)" />
                </label>

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
    </div>,
    document.body
  );
}
