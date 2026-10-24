// Bunyi klik ringan saat pindah tab (25 Okt 2026). Dibuat dengan Web Audio, tanpa file audio.
// Browser hanya mengizinkan suara setelah ada klik user, jadi dipanggil dari onClick tab.
// Bisa dimatikan lewat localStorage "nexto-nav-sound" = "off".
let ctx = null;

export function playNavClick() {
  try {
    if (localStorage.getItem("nexto-nav-sound") === "off") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (_) {
    // Gagal memutar suara tidak boleh mengganggu pindah tab.
  }
}
