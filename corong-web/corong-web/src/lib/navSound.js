// Bunyi klik ringan (25 Okt 2026). Dibuat dengan Web Audio, tanpa file audio.
// Browser hanya mengizinkan suara setelah ada klik user, jadi dipanggil dari handler klik.
// Dimatikan lewat localStorage "nexto-nav-sound" = "off". Gagal memutar suara tidak boleh mengganggu aplikasi.
let ctx = null;

function getCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function enabled() {
  try { return localStorage.getItem("nexto-nav-sound") !== "off"; } catch (_) { return true; }
}

// Pop: nada turun cepat (dipakai untuk pindah tab di sidebar).
export function playNavClick() {
  try {
    if (!enabled()) return;
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.13);
  } catch (_) {
    // diabaikan
  }
}

// Tik: nada tinggi yang sangat singkat (dipakai untuk pindah tahap pipeline).
export function playPipelineMove() {
  try {
    if (!enabled()) return;
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, c.currentTime);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.05);
  } catch (_) {
    // diabaikan
  }
}
