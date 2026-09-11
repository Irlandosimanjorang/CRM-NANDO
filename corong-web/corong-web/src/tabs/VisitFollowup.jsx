import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, CalendarClock, Plus, Search, Save, X, CheckCircle2, Table2, Calendar, ChevronLeft, ChevronRight, MapPin, Navigation, History, Mic, Camera, Loader2, Lock, Sparkles, Check } from "lucide-react";
import * as db from "../lib/db";
import { typeBadge, prioMeta, chipStyle, fmtDate, todayISO } from "../lib/helpers";
import MeetingRecorderModal from "../components/MeetingRecorderModal";
import { saveOpenModal, clearOpenModal, getOpenModal } from "../lib/uiPersist";

// Rumus Haversine - itung jarak lurus antara 2 titik GPS (dalam meter)
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CHECKIN_RADIUS_M = 100;
// GPS browser bisa ngasih titik dengan akurasi apa aja - dari ±5m (satelit
// jelas) sampe ±500m+ (indoor/WiFi-positioning/laptop tanpa GPS asli).
// Dulu akurasi ini gak pernah dicek sama sekali, jadi titik jelek dipake
// mentah-mentah buat itung jarak check-in - bisa salah nolak (padahal udah
// di lokasi) ATAU salah nerima (padahal jauh, kebetulan itungannya masuk).
// Sekarang WAJIB nunggu sinyal di bawah ambang ini dulu sebelum GPS
// dianggap valid buat check-in/simpan lokasi.
const GOOD_ACCURACY_M = 30;

// Konfirmasi lokasi SEBELUM minta foto - dulu langsung loncat ke ambil foto
// begitu tombol diklik, user gak pernah eksplisit ngeliat/ngonfirmasi data
// GPS-nya sendiri. Sekarang ada jeda: pas modal kebuka, kelihatan animasi
// "scanning" dulu sambil reverse-geocode koordinat jadi alamat asli (bukan
// teks generik "GPS Anda saat ini") - baru abis itu tombol konfirmasi muncul.
function LocationConfirmModal({ confirmData, onConfirm, onCancel }) {
  const { mode, lead, distance, scanning, address, accuracy, liveAccuracy } = confirmData;
  // User gak mau liat angka koordinat mentah - kalau reverse-geocode bener2
  // gagal (jaringan/rate-limit), tunjukin frasa umum, JANGAN lat/lng.
  const locationLabel = address || "lokasi GPS Anda saat ini";
  const accLabel = accuracy != null ? `±${Math.round(accuracy)}m` : null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={scanning ? undefined : onCancel}>
      <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-base flex items-center gap-1.5"><MapPin size={16} className="text-orange-500" /> Konfirmasi Lokasi</h3>
          {!scanning && <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>}
        </div>
        {scanning ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-30 animate-ping" />
              <span className="relative inline-flex rounded-full h-10 w-10 bg-orange-100 items-center justify-center"><Navigation size={18} className="text-orange-600" /></span>
            </span>
            <p className="text-sm text-slate-500">Menyempurnakan akurasi GPS…</p>
            {liveAccuracy != null && (
              <p className="text-xs text-slate-400">Akurasi saat ini: ±{Math.round(liveAccuracy)}m (target ≤{GOOD_ACCURACY_M}m)</p>
            )}
          </div>
        ) : (
          <>
            {mode === "checkin" ? (
              <p className="text-sm text-slate-600 mt-2">
                Anda kedeteksi di <b>{locationLabel}</b>, sekitar <b>{distance}m</b> dari titik lokasi tersimpan <b>"{lead.name}"</b> - masih dalam radius yang diijinkan ({CHECKIN_RADIUS_M}m). Konfirmasi Anda beneran ada di lokasi ini sekarang, baru lanjut lampirin foto.
              </p>
            ) : (
              <p className="text-sm text-slate-600 mt-2">
                Nexto bakal nyimpen alamat berikut sebagai lokasi <b>"{lead.name}"</b> buat verifikasi kunjungan berikutnya:
                <br /><b>{locationLabel}</b>
                <br />Kalau alamat di atas belum sampe nama jalan/gang (data peta di area ini emang belum lengkap), gapapa - titik GPS presisinya tetep kesimpen buat verifikasi kunjungan berikutnya. Pastikan Anda beneran lagi di lokasi customer ini sebelum lanjut.
              </p>
            )}
            {accLabel && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1"><MapPin size={11} /> Akurasi GPS: {accLabel}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={onCancel} className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button>
              <button onClick={onConfirm} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2.5 rounded-xl font-medium">Ya, Lanjut Foto</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Kamera live in-app (getUserMedia) - dulu pake <input type=file capture>
// yang di sebagian HP/browser tetep nyediain opsi "pilih dari galeri" di
// samping kamera, jadi orang bisa upload foto lama/nyari foto orang lain.
// Sekarang bener-bener buka feed kamera depan langsung di dalam modal,
// user jepret dari situ - gak ada jalan buat milih file dari galeri.
// Fallback ke <input capture> cuma kalo getUserMedia gak didukung/ditolak.
function LiveCamera({ onCapture, onFallback }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => { if (error) onFallback(); }, [error]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // mirror biar sesuai apa yang keliatan di preview
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(new File([blob], `checkin-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  if (error) return null;
  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-slate-900">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
      <button
        type="button"
        onClick={shoot}
        className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white border-4 border-orange-500 shadow-lg active:scale-95"
        aria-label="Jepret foto"
      />
    </div>
  );
}

function PhotoCheckinModal({ pending, onClose, onDone }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Menyimpan…");
  const [cameraFailed, setCameraFailed] = useState(false);

  const handleCapture = (file) => {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  // Fallback doang kalo getUserMedia gak jalan (browser lama/HP tanpa kamera
  // depan kedetek/dst) - capture="user" masih ngarahin ke app kamera native,
  // bukan langsung ke galeri.
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleCapture(file);
  };

  const retake = () => { setPhoto(null); setPreview(null); };

  const confirm = async () => {
    if (!photo) { alert("Foto wajib dilampirin buat check-in."); return; }
    setBusy(true);
    try {
      setBusyLabel("Ngupload foto…");
      const photo_url = await db.uploadCheckinPhoto(photo);

      // Verifikasi AI - pastiin fotonya beneran ada orangnya (selfie di
      // lokasi), bukan foto struk/random dari galeri. Kalau AI-nya SENDIRI
      // gagal diproses (API down dst), fail-OPEN (tetep lanjut) - jangan
      // sampe check-in beneran keblokir gara-gara layanan verifikasi lagi
      // bermasalah, itu bukan salah user.
      setBusyLabel("Ngecek fotonya…");
      const verify = await db.verifySelfiePhoto(photo_url).catch((e) => {
        console.error("Verifikasi foto gagal (fail-open):", e);
        return { isSelfie: true };
      });
      if (!verify.isSelfie) {
        alert(`❌ Foto ini kelihatannya bukan foto diri Anda di lokasi.${verify.reason ? " (" + verify.reason + ")" : ""}\n\nTolong upload ulang foto selfie Anda di lokasi kunjungan.`);
        setBusy(false);
        return;
      }

      setBusyLabel("Menyimpan…");
      await pending.run(photo_url);
      onDone();
    } catch (e) { alert("Gagal check-in: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-base">Foto Bukti Check-in</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Wajib selfie langsung dari kamera buat "{pending.leadName}" - foto bakal dicek AI, pastiin keliatan wajah Anda. Gak bisa pilih foto dari galeri.</p>
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-48 object-cover rounded-2xl border border-slate-200" />
            {!busy && (
              <button onClick={retake} className="absolute top-2 right-2 text-xs font-medium bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-white">Foto Ulang</button>
            )}
          </div>
        ) : cameraFailed ? (
          <label className="block cursor-pointer">
            <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Camera size={28} />
              <span className="text-xs font-medium">Buka kamera</span>
            </div>
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <LiveCamera onCapture={handleCapture} onFallback={() => setCameraFailed(true)} />
        )}
        <button onClick={confirm} disabled={busy || !photo} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {busy ? busyLabel : "Konfirmasi Check-in"}
        </button>
      </div>
    </div>
  );
}

function TodayVisitsCard({ leads, onChanged, onEdit, isEnterprise }) {
  const todayVisits = useMemo(() => leads.filter((c) => c.visit_date === todayISO()), [leads]);
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);
  const [recordingLead, setRecordingLead] = useState(null);
  const [pendingCheckin, setPendingCheckin] = useState(null);
  const [checkedInToday, setCheckedInToday] = useState(new Set());
  const [locationConfirm, setLocationConfirm] = useState(null);
  const [quota, setQuota] = useState(null); // { canCheckIn, usedThisMonth, quotaMax }

  const refreshQuota = () => db.getCheckinCooldown().then(setQuota).catch(() => {});

  useEffect(() => {
    if (!isEnterprise) return;
    db.getTodayCheckedInLeadIds().then((ids) => setCheckedInToday(new Set(ids))).catch(() => {});
    refreshQuota();
  }, [isEnterprise]);
  const watchIdRef = useRef(null);

  useEffect(() => {
    // Bukan Enterprise: gak perlu minta izin GPS browser sama sekali buat
    // fitur yang emang gak bisa dipake - jangan ganggu user Professional
    // dengan popup izin lokasi yang gak ada gunanya buat mereka.
    if (!isEnterprise || todayVisits.length === 0 || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Selalu update posisi kalau fix BARU ini udah cukup presisi
        // (GOOD_ACCURACY_M) - PENTING biar jarak ke lokasi tetep ke-update
        // beneran pas rep jalan mendekat, gak "beku" di fix bagus pertama.
        // Fix baru cuma DITOLAK kalau dia jelek DAN kita udah kadung punya
        // fix bagus sebelumnya (anomali GPS sesaat - multipath di gedung
        // dll - bukan berarti makin jauh dari lokasi). Bug yang ketemu pas
        // audit 11 Sep 2026: versi lama malah nolak fix baru yang BAGUS
        // juga kalau kebetulan sedikit kurang presisi dari fix terbaik
        // sebelumnya, jadi posisi kepentok gak pernah ke-update lagi
        // begitu satu fix bagus kedapet - padahal user masih jalan.
        setMyPos((prev) => {
          const newFix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          if (pos.coords.accuracy <= GOOD_ACCURACY_M) return newFix;
          if (!prev || prev.accuracy > GOOD_ACCURACY_M) return newFix;
          return prev;
        });
        setGeoError(false);
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [todayVisits.length]);

  const gpsReady = !!(myPos && myPos.accuracy != null && myPos.accuracy <= GOOD_ACCURACY_M);

  // Dulu klik tombol langsung loncat ke minta foto - user gak pernah
  // eksplisit ngonfirmasi data GPS-nya sendiri dulu. Sekarang ask* munculin
  // LocationConfirmModal dalam mode scanning, reverse-geocode koordinatnya
  // jadi alamat asli, baru tunjukkin tombol konfirmasi. proceed* (logic
  // aslinya, gak berubah) baru jalan abis user klik "Ya, Lanjut Foto" -
  // proceed* baru munculin PhotoCheckinModal (yang sekarang juga verifikasi AI).
  const geoReqIdRef = useRef(0);

  const askCheckIn = (lead, distance) => {
    if (quota && !quota.canCheckIn) { alert(`Kuota check-in GPS Anda bulan ini udah abis (maks ${quota.quotaMax}x/bulan). Bisa lagi awal bulan depan.`); return; }
    if (!gpsReady) { alert(`Sinyal GPS belum cukup presisi (butuh ≤${GOOD_ACCURACY_M}m). Tunggu bentar atau pindah ke tempat terbuka.`); return; }
    const reqId = ++geoReqIdRef.current;
    setLocationConfirm({ mode: "checkin", lead, distance, scanning: true, address: null, coords: myPos, accuracy: myPos.accuracy });
    db.reverseGeocode(myPos.lat, myPos.lng).then((address) => {
      if (geoReqIdRef.current !== reqId) return; // dibatalin/diganti request lain
      setLocationConfirm((prev) => (prev && prev.scanning ? { ...prev, scanning: false, address } : prev));
    });
  };

  // Dulu cuma 1x getCurrentPosition - sekali tembak, walau hasilnya jelek
  // (indoor/multipath) tetep dipake buat nyimpen titik PERMANEN lokasi
  // lead, yang jadi acuan semua check-in berikutnya. Sekarang nge-watch
  // terus dan ambil fix TERBAIK sampai akurasinya ≤GOOD_ACCURACY_M atau
  // 20 detik abis (mana duluan) - titik yang kesimpen jadi jauh lebih presisi.
  const askSavePin = (lead) => {
    if (!navigator.geolocation) { alert("HP/browser Anda ga dukung GPS."); return; }
    if (quota && !quota.canCheckIn) { alert(`Kuota check-in GPS Anda bulan ini udah abis (maks ${quota.quotaMax}x/bulan). Bisa lagi awal bulan depan.`); return; }
    const reqId = ++geoReqIdRef.current;
    setLocationConfirm({ mode: "savepin", lead, distance: null, scanning: true, address: null, coords: null, accuracy: null, liveAccuracy: null });
    let best = null;
    const finish = async () => {
      if (geoReqIdRef.current !== reqId) return;
      navigator.geolocation.clearWatch(watchId);
      if (!best) {
        setLocationConfirm(null);
        alert("Gagal dapetin sinyal GPS yang cukup presisi. Coba pindah ke tempat terbuka (bukan dalam ruangan/gedung), lalu coba lagi.");
        return;
      }
      const address = await db.reverseGeocode(best.lat, best.lng);
      if (geoReqIdRef.current !== reqId) return;
      setLocationConfirm((prev) => (prev && prev.scanning ? { ...prev, scanning: false, address, coords: { lat: best.lat, lng: best.lng }, accuracy: best.accuracy } : prev));
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (geoReqIdRef.current !== reqId) return;
        const accuracy = pos.coords.accuracy;
        if (!best || accuracy < best.accuracy) best = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy };
        setLocationConfirm((prev) => (prev && prev.scanning ? { ...prev, liveAccuracy: best.accuracy } : prev));
        if (best.accuracy <= GOOD_ACCURACY_M) finish();
      },
      () => {
        if (geoReqIdRef.current !== reqId) return;
        navigator.geolocation.clearWatch(watchId);
        setLocationConfirm(null);
        alert("Gagal ambil lokasi. Kalau ini dari laptop, laptop emang gak punya GPS asli (beda sama HP) - cek Windows Settings > Privacy > Location harus nyala, dan izin lokasi Chrome buat nexto.site harus \"Allow\". Coba pake HP kalau masih gagal.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    setTimeout(finish, 20000);
  };

  // Kedua alur (udah ada titik lokasi ATAU baru pertama kali) sama-sama minta
  // foto dulu sebelum check-in beneran kesimpen - lewat PhotoCheckinModal.
  const proceedCheckIn = (lead, distance, accuracy_m) => {
    setPendingCheckin({
      leadId: lead.id,
      leadName: lead.name,
      run: async (photo_url) => {
        setCheckingIn(lead.id);
        try {
          await db.checkIn({ lead_id: lead.id, lead_name: lead.name, latitude: myPos.lat, longitude: myPos.lng, distance_meters: distance, photo_url, accuracy_m });
          onChanged();
          refreshQuota();
        } finally { setCheckingIn(null); }
      },
    });
  };

  // coords udah didapet pas askSavePin nge-scan lokasi buat modal konfirmasi -
  // dipake ulang di sini biar gak minta GPS 2x (dulu getCurrentPosition lagi).
  const proceedSavePin = (lead, coords, accuracy_m) => {
    setPendingCheckin({
      leadId: lead.id,
      leadName: lead.name,
      run: async (photo_url) => {
        setCheckingIn(lead.id);
        try {
          const { lat: latitude, lng: longitude } = coords;
          await db.saveLeadLocation(lead.id, latitude, longitude, accuracy_m);
          await db.checkIn({ lead_id: lead.id, lead_name: lead.name, latitude, longitude, distance_meters: 0, photo_url, accuracy_m });
          onChanged();
          refreshQuota();
        } finally { setCheckingIn(null); }
      },
    });
  };

  if (todayVisits.length === 0) return null;
  if (!isEnterprise) return <GpsCheckinLocked />;

  return (
    <div className="bg-white border border-orange-200 rounded-[28px] p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Navigation size={14} /></span>
          Kunjungan Hari Ini
        </div>
        {quota && (
          <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${quota.canCheckIn ? "bg-slate-100 text-slate-500" : "bg-rose-50 text-rose-600"}`}>
            Check-in: {quota.usedThisMonth}/{quota.quotaMax} bulan ini
          </span>
        )}
      </div>
      {geoError && <p className="text-xs text-rose-500 mb-2">Gagal akses GPS. Pastikan izin lokasi diaktifkan buat browser/app ini.</p>}
      <div className="space-y-2">
        {todayVisits.map((c) => {
          const hasCoords = c.latitude != null && c.longitude != null;
          let distance = null;
          if (hasCoords && myPos && gpsReady) distance = Math.round(haversineMeters(myPos.lat, myPos.lng, c.latitude, c.longitude));
          const canCheckIn = hasCoords && distance !== null && distance <= CHECKIN_RADIUS_M;
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-2xl p-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {!hasCoords ? "Belum ada titik lokasi tersimpan"
                    : !myPos ? "Nyari posisi Anda…"
                    : !gpsReady ? `Menyempurnakan sinyal GPS (±${Math.round(myPos.accuracy)}m)…`
                    : canCheckIn ? "Anda udah di lokasi ✓"
                    : `${distance >= 1000 ? (distance / 1000).toFixed(1) + " km" : distance + " m"} lagi`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setRecordingLead(c)} title="Rekam Meeting" className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-orange-600"><Mic size={14} /></button>
                {checkedInToday.has(c.id) ? (
                  <span className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle2 size={13} /> Sudah Check-in
                  </span>
                ) : !hasCoords ? (
                  <button
                    onClick={() => askSavePin(c)}
                    disabled={checkingIn === c.id || (quota && !quota.canCheckIn)}
                    title={quota && !quota.canCheckIn ? `Kuota check-in bulan ini abis (maks ${quota.quotaMax}x)` : undefined}
                    className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60"
                  >
                    <MapPin size={13} /> {checkingIn === c.id ? "Menyimpan…" : "Simpan Lokasi Ini"}
                  </button>
                ) : (
                  <button
                    onClick={() => askCheckIn(c, distance)}
                    disabled={!canCheckIn || checkingIn === c.id || (quota && !quota.canCheckIn)}
                    title={quota && !quota.canCheckIn ? `Kuota check-in bulan ini abis (maks ${quota.quotaMax}x)` : undefined}
                    className={`text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors ${canCheckIn && !(quota && !quota.canCheckIn) ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-slate-100 text-slate-400"}`}
                  >
                    <MapPin size={13} /> {checkingIn === c.id ? "Menyimpan…" : "Saya Sudah Sampai"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {recordingLead && <MeetingRecorderModal lead={recordingLead} onClose={() => setRecordingLead(null)} onSaved={onChanged} />}
      {locationConfirm && (
        <LocationConfirmModal
          confirmData={locationConfirm}
          onCancel={() => setLocationConfirm(null)}
          onConfirm={() => {
            const { mode, lead, distance, coords, accuracy } = locationConfirm;
            setLocationConfirm(null);
            if (mode === "checkin") proceedCheckIn(lead, distance, accuracy);
            else proceedSavePin(lead, coords, accuracy);
          }}
        />
      )}
      {pendingCheckin && (
        <PhotoCheckinModal
          pending={pendingCheckin}
          onClose={() => setPendingCheckin(null)}
          onDone={() => {
            setCheckedInToday((prev) => new Set(prev).add(pendingCheckin.leadId));
            alert(`✅ Check-in "${pendingCheckin.leadName}" berhasil dicatat.`);
            setPendingCheckin(null);
          }}
        />
      )}
    </div>
  );
}

// Kartu upsell dipake bareng di TodayVisitsCard & CheckinHistory - satu
// tempat, konsisten pesannya (GPS Check-in dipindah dari Professional ke
// Enterprise - lebih relevan buat tracking tim, bukan sales solo).
function GpsCheckinLocked() {
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-3">
      <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0"><Lock size={14} /></span>
      <div className="text-sm">
        <div className="font-medium text-violet-900">GPS Check-in itu fitur Enterprise</div>
        <div className="text-xs text-violet-700 mt-0.5">Buat tracking kunjungan tim sales secara real-time. Upgrade ke Enterprise buat pake fitur ini.</div>
      </div>
    </div>
  );
}

// Popup lightbox foto bukti check-in - klik thumbnail di Riwayat Check-in
// buka foto ukuran penuh, biar owner/manager bisa beneran cek jelas fotonya
// (bukan cuma thumbnail kecil 44px yang susah diliat detailnya).
function CheckinPhotoLightbox({ ci, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2 text-white">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{ci.lead_name}</div>
            <div className="text-xs text-white/60 truncate">
              {ci.rep_name || "Sales rep"} · {new Date(ci.checked_in_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-white/70 hover:text-white p-1"><X size={22} /></button>
        </div>
        <img src={ci.photo_url} alt="" className="w-full rounded-2xl object-contain max-h-[75vh] bg-black" />
        <a href={`https://maps.google.com/?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-orange-400 hover:underline"><MapPin size={13} /> Lihat lokasi di Maps</a>
      </div>
    </div>,
    document.body
  );
}

function CheckinHistory({ isEnterprise }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [items, setItems] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!isEnterprise) return;
    db.getCheckins(month).then(setItems).catch(() => setItems([]));
  }, [month, isEnterprise]);

  if (!isEnterprise) return <GpsCheckinLocked />;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white" />
      </div>
      {items === null ? (
        <div className="text-sm text-slate-400 py-8 text-center">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><History size={32} className="mx-auto text-slate-300 mb-3" />Belum ada check-in di bulan ini.</div>
      ) : (
        <div className="space-y-2">
          {items.map((ci) => (
            <div key={ci.id} className="bg-white border border-slate-100 rounded-[28px] p-3 flex items-center gap-3">
              {ci.photo_url ? (
                <button onClick={() => setLightbox(ci)} className="shrink-0">
                  <img src={ci.photo_url} alt="" className="w-11 h-11 rounded-2xl object-cover border border-slate-200 hover:opacity-80 transition-opacity" />
                </button>
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-300"><Camera size={16} /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{ci.lead_name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {ci.rep_name ? <span className="text-slate-500 font-medium">{ci.rep_name}</span> : "Sales rep"} · {new Date(ci.checked_in_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <a href={`https://maps.google.com/?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-orange-600 hover:underline flex items-center gap-1"><MapPin size={12} /> Peta</a>
            </div>
          ))}
        </div>
      )}
      {lightbox && <CheckinPhotoLightbox ci={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function AddVisitModal({ leads, onClose, onSaved, myLevel }) {
  const isProfessional = myLevel >= 2;
  // BUG FIX (11 Sep 2026): tab di-discard browser/OS (pindah app lain di HP,
  // balik lagi) bikin React kehilangan SEMUA state - modal-nya emang udah
  // otomatis kebuka lagi (lihat getOpenModal("visit") di VisitView), TAPI
  // poin "Poin Diskusi (AI)" yang baru di-generate ilang jadi blank lagi,
  // padahal itu udah makan kuota AI (15x/bulan) - user harus generate ulang
  // & boros kuota buat hal yang sebenernya udah pernah didapetin. Sekarang
  // restore juga lead yang lagi dipilih + hasil poin AI-nya dari localStorage
  // (persis pola "inget kondisi terakhir" yang sama dipake modal lain).
  const restored = getOpenModal("visit") || {};
  const restoredLead = restored.leadId ? leads.find((l) => l.id === restored.leadId) : null;

  const [q, setQ] = useState("");
  const [sel, setSel] = useState(restoredLead || null);
  const [date, setDate] = useState(restoredLead ? (restored.date || todayISO()) : todayISO());
  const [meet, setMeet] = useState(restoredLead ? (restored.meet || "") : "");
  const [agenda, setAgenda] = useState(restoredLead ? (restored.agenda || "") : "");
  const [busy, setBusy] = useState(false);
  // "Poin Diskusi (AI)" - baca histori progress notes lead yang dipilih,
  // saranin 3-5 poin buat dibahas pas ketemu. Hasilnya CUMA SARAN - rep
  // milih sendiri poin mana yang mau ditambahin ke Agenda (klik "Pakai"),
  // gak auto-overwrite apa yang udah diketik rep sendiri.
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedPoints, setSuggestedPoints] = useState(restoredLead ? (restored.suggestedPoints || null) : null);
  const [suggestError, setSuggestError] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(restoredLead ? (restored.appliedPoints || {}) : {});

  // Nyimpen snapshot tiap kali ada perubahan relevan - cuma pas UDAH ada
  // lead yang dipilih (draft kosong gak ada gunanya direstore).
  useEffect(() => {
    if (!sel) return;
    saveOpenModal("visit", { leadId: sel.id, date, meet, agenda, suggestedPoints, appliedPoints });
  }, [sel, date, meet, agenda, suggestedPoints, appliedPoints]);

  const suggestPoints = async () => {
    if (!sel) return;
    setSuggesting(true); setSuggestError(""); setSuggestedPoints(null); setAppliedPoints({});
    try {
      const points = await db.suggestVisitPoints(sel.id);
      setSuggestedPoints(points);
    } catch (e) { setSuggestError(e.message); }
    finally { setSuggesting(false); }
  };
  const applyPoint = (i, point) => {
    setAgenda((prev) => (prev.trim() ? `${prev.trim()}\n- ${point}` : `- ${point}`));
    setAppliedPoints((p) => ({ ...p, [i]: true }));
  };
  const matches = q.trim() ? leads.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const pick = (c) => { setSel(c); setQ(""); setMeet(c.visit_meet || c.key_person || ""); setAgenda(c.visit_agenda || ""); if (c.visit_date) setDate(c.visit_date); setSuggestedPoints(null); setSuggestError(""); setAppliedPoints({}); };
  const save = async () => {
    if (!sel) { alert("Pilih company dulu."); return; }
    setBusy(true);
    try { await db.upsertLead({ ...sel, visit_date: date, visit_meet: meet, visit_agenda: agenda }); onSaved(); }
    catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pb-28 md:pb-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg flex items-center gap-2"><CalendarCheck size={18} className="text-orange-500" /> Tambah Visit</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-500">Company *</span>
            {sel ? (
              <div className="mt-1 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2"><span className="text-sm font-medium">{sel.name}</span><button onClick={() => setSel(null)} className="text-xs text-slate-500 hover:text-rose-500">ganti</button></div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input autoFocus className="w-full mt-1 pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
                {matches.length > 0 && <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-sm max-h-52 overflow-y-auto">{matches.map((c) => <div key={c.id} onClick={() => pick(c)} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0"><div className="font-medium">{c.name}</div><div className="text-[11px] text-slate-400">{[c.city, c.category].filter(Boolean).join(" · ")}</div></div>)}</div>}
                {q.trim() && matches.length === 0 && <p className="text-xs text-slate-400 mt-1">Company ga ketemu. Tambahin di tab Leads dulu.</p>}
              </div>
            )}
          </div>
          <div className={sel ? "" : "opacity-40 pointer-events-none"}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Tanggal visit</span><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Ketemu siapa</span><input className={inp} value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="mis. Bu Rina (purchasing)" /></label>
            </div>
            <label className="block mt-3"><span className="text-xs font-medium text-slate-500">Agenda</span><textarea className={inp} rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="mau bahas apa" /></label>

            <div className="mt-2 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-violet-700 flex items-center gap-1.5"><Sparkles size={13} /> Poin Diskusi (AI)</div>
                <button
                  type="button"
                  onClick={suggestPoints}
                  disabled={!sel || suggesting || !isProfessional}
                  title={!isProfessional ? "Khusus paket Professional ke atas" : undefined}
                  className="text-[11px] font-medium text-violet-700 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  {suggesting ? <Loader2 size={11} className="animate-spin" /> : !isProfessional ? <Lock size={11} /> : <Sparkles size={11} />}
                  {suggesting ? "Nyiapin..." : !isProfessional ? "Professional" : "Siapin Poin"}
                </button>
              </div>
              {suggestError && <p className="mt-2 text-[11px] text-rose-500">{suggestError}</p>}
              {suggestedPoints && (
                <div className="mt-2 space-y-1.5">
                  {suggestedPoints.map((point, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-[11px] bg-white rounded-lg border border-violet-100 px-2 py-1.5">
                      <span className="text-slate-700 flex-1">{point}</span>
                      {appliedPoints[i] ? (
                        <span className="shrink-0 text-emerald-600 flex items-center gap-0.5"><Check size={11} /> Dipakai</span>
                      ) : (
                        <button type="button" onClick={() => applyPoint(i, point)} className="shrink-0 text-violet-600 font-medium hover:underline">Pakai</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan visit</button><button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button></div>
      </div>
    </div>
  );
}

function MonthCalendar({ leads, onEdit, month, setMonth }) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const today = todayISO();

  const visitsByDate = useMemo(() => {
    const map = {};
    leads.forEach((c) => { if (c.visit_date) { (map[c.visit_date] ||= []).push(c); } });
    return map;
  }, [leads]);

  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = month.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const prevMonth = () => setMonth(new Date(year, monthIdx - 1, 1));
  const nextMonth = () => setMonth(new Date(year, monthIdx + 1, 1));
  const goToday = () => setMonth(new Date());

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-slate-700 capitalize w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
        </div>
        <button onClick={goToday} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-slate-600">Hari ini</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[74px] rounded-lg" />;
          const ds = dateStr(year, monthIdx, d);
          const isToday = ds === today;
          const dayVisits = visitsByDate[ds] || [];
          return (
            <div key={i} className={`min-h-[74px] rounded-lg border p-1 ${isToday ? "border-orange-400 bg-orange-50/50" : "border-slate-100"}`}>
              <div className={`text-[10px] font-medium mb-1 ${isToday ? "text-orange-600" : "text-slate-400"}`}>{d}</div>
              <div className="space-y-0.5">
                {dayVisits.slice(0, 2).map((c) => (
                  <button key={c.id} onClick={() => onEdit(c)} className="w-full text-left text-[9px] leading-tight bg-orange-100 text-orange-700 rounded px-1 py-0.5 truncate hover:bg-orange-200">
                    {c.name}
                  </button>
                ))}
                {dayVisits.length > 2 && <div className="text-[9px] text-slate-400 px-1">+{dayVisits.length - 2} lagi</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitView({ leads, onEdit, onChanged, isEnterprise, myLevel }) {
  // BUG FIX (6 Sep 2026): form-nya masih blank waktu dibuka ulang (beda dari
  // Tambah Deal yang udah punya draft field) - tapi minimal MODAL-nya otomatis
  // kebuka lagi abis app di-reload paksa, gak keliatan "ilang" gitu aja.
  const [add, setAdd] = useState(() => !!getOpenModal("visit"));
  // Catatan: "Rekam Meeting" SENGAJA gak direstore - rekaman audio yang lagi
  // jalan gak mungkin "dilanjutin" abis tab-nya di-reload (buffer audio-nya
  // ilang beneran, bukan soal nyimpen state doang), jadi maksa buka modal-nya
  // lagi cuma bakal nunjukin form kosong yang keliatan kayak seolah rekaman
  // lama masih ada padahal enggak - lebih aman biarin orangnya klik ulang manual.
  const [recording, setRecording] = useState(false);
  const [view, setView] = useState("table");
  const [month, setMonth] = useState(new Date());
  const visits = useMemo(() => leads.filter((c) => c.visit_date).sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1)), [leads]);
  const upcoming = visits.filter((c) => c.visit_date >= todayISO());

  // BUG FIX (11 Sep 2026): klik baris jadwal visit sebelumnya buka LeadModal
  // (kartu lead umum) - gak ada tanggal/ketemu siapa/agenda/"Poin Diskusi
  // (AI)"-nya sama sekali. Sekarang buka modal Visit yang sama dipake pas
  // "Tambah visit", cuma di-prefill data visit lead ini biar user langsung
  // liat detail + bisa minta poin AI, bukan malah lompat ke kartu lead umum.
  const openVisitDetail = (c) => {
    saveOpenModal("visit", { leadId: c.id, date: c.visit_date || todayISO(), meet: c.visit_meet || c.key_person || "", agenda: c.visit_agenda || "" });
    setAdd(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView("table")} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${view === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}><Table2 size={13} /> Tabel</button>
          <button onClick={() => setView("calendar")} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${view === "calendar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}><Calendar size={13} /> Kalender</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRecording(true)} className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm px-3 py-2 rounded-xl font-medium"><Mic size={15} /> Rekam Meeting</button>
          <button onClick={() => { setAdd(true); saveOpenModal("visit", {}); }} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Tambah visit</button>
        </div>
      </div>

      <TodayVisitsCard leads={leads} onChanged={onChanged} onEdit={onEdit} isEnterprise={isEnterprise} />

      {visits.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><CalendarCheck size={32} className="mx-auto text-slate-300 mb-3" />Belum ada visit. Klik "Tambah visit" atau isi "Visit date" di lead mana aja.</div>
      ) : view === "calendar" ? (
        <MonthCalendar leads={leads} onEdit={openVisitDetail} month={month} setMonth={setMonth} />
      ) : (
        <>
          <div className="bg-white border border-slate-100 rounded-[28px] p-4 mb-4">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="px-3 first:pl-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarCheck size={13} /> Akan datang</div>
                <div className="font-bold text-2xl text-orange-600 mt-1.5 tabular-nums">{upcoming.length}</div>
              </div>
              <div className="px-3">
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarCheck size={13} /> Total terjadwal</div>
                <div className="font-bold text-2xl text-slate-800 mt-1.5 tabular-nums">{visits.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-[28px] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-400 text-[11px] uppercase tracking-wider"><tr>
                <th className="text-left px-3 py-2 font-medium">Perusahaan</th><th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Lokasi</th><th className="hidden md:table-cell text-left px-3 py-2 font-medium">Produk</th><th className="text-left px-3 py-2 font-medium">Tanggal visit</th><th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Ketemu</th><th className="hidden md:table-cell text-left px-3 py-2 font-medium">Agenda</th>
              </tr></thead>
              <tbody>
                {visits.map((c) => { const past = c.visit_date < todayISO(); const today = c.visit_date === todayISO(); const meet = c.visit_meet || c.key_person; return (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-orange-50/40 cursor-pointer ${past ? "opacity-50" : ""}`} onClick={() => openVisitDetail(c)}>
                    <td className="px-3 py-2"><div className="font-medium flex items-center gap-1.5">{c.name}{typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}</div></td>
                    <td className="hidden sm:table-cell px-3 py-2 text-xs text-slate-600">{[c.city, c.province].filter(Boolean).join(", ") || "—"}</td>
                    <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-600">{c.product || "—"}</td>
                    <td className="px-3 py-2 text-xs"><span className={today ? "text-orange-600 font-medium" : "text-slate-600"}>{fmtDate(c.visit_date)}{today && " · hari ini"}</span></td>
                    <td className="hidden sm:table-cell px-3 py-2 text-xs text-slate-600">{meet || "—"}</td>
                    <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-600 max-w-56">{c.visit_agenda ? <div className="line-clamp-2">{c.visit_agenda}</div> : <span className="text-slate-300">—</span>}</td>
                  </tr> ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {add && <AddVisitModal leads={leads} onClose={() => { setAdd(false); clearOpenModal("visit"); }} onSaved={() => { setAdd(false); clearOpenModal("visit"); onChanged(); }} myLevel={myLevel} />}
      {recording && <MeetingRecorderModal leads={leads} onClose={() => setRecording(false)} onSaved={onChanged} />}
    </div>
  );
}

function FollowupView({ leads, onEdit, onChanged }) {
  const todo = useMemo(() => leads.filter((c) => c.next_action && c.next_action.trim()), [leads]);
  const done = async (id) => { await db.upsertLead({ ...leads.find((l) => l.id === id), next_action: "" }); onChanged(); };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Semua lead yang punya "Next action". Klik nama buat buka, ✓ buat tandai selesai.</p>
      {todo.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><CalendarClock size={32} className="mx-auto text-slate-300 mb-3" />Belum ada next action. Buka lead → isi kolom "Next action".</div>
      ) : (
        <div className="space-y-2">
          {todo.map((c) => { const pm = prioMeta(c.priority); return (
            <div key={c.id} className="bg-white border border-slate-200/80 border-l-4 border-l-rose-400 rounded-2xl shadow-sm p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(c)}>
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{c.name}</span>{pm && <span className="text-[10px] border rounded-full px-1.5 py-0.5" style={chipStyle(pm.hex)}>{pm.label}</span>}</div>
                <div className="text-xs text-orange-700 mt-0.5">→ {c.next_action}</div>
              </div>
              <button onClick={() => done(c.id)} title="Tandai selesai" className="text-slate-300 hover:text-emerald-500 p-1"><CheckCircle2 size={16} /></button>
            </div> ); })}
        </div>
      )}
    </div>
  );
}

export default function VisitFollowup({ leads, onEdit, onChanged, isEnterprise, myLevel }) {
  const [tab, setTab] = useState("visit");
  const visitCount = leads.filter((c) => c.visit_date).length;
  const followupCount = leads.filter((c) => c.next_action && c.next_action.trim()).length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-3">Visit & Follow-up</h1>
      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("visit")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "visit" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarCheck size={15} /> Visit <span className="text-xs text-slate-400">({visitCount})</span>
        </button>
        <button onClick={() => setTab("followup")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "followup" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarClock size={15} /> Follow-up <span className="text-xs text-slate-400">({followupCount})</span>
        </button>
        <button onClick={() => setTab("checkin")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "checkin" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <History size={15} /> Riwayat Check-in
        </button>
      </div>

      {tab === "visit" && <VisitView leads={leads} onEdit={onEdit} onChanged={onChanged} isEnterprise={isEnterprise} myLevel={myLevel} />}
      {tab === "followup" && <FollowupView leads={leads} onEdit={onEdit} onChanged={onChanged} />}
      {tab === "checkin" && <CheckinHistory isEnterprise={isEnterprise} />}
    </div>
  );
}
