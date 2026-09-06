// ---- SISTEM "INGET KONDISI TERAKHIR" ----
// Dipake di semua tab/modal biar app gak kerasa "reset ke awal" begitu tab-nya
// di-reload paksa sama browser/OS - kejadian nyata & sering di HP: buka app
// lain (Telegram, WhatsApp, dst) dari Nexto, terus balik lagi - Android/Chrome
// suka buang tab yang lagi di-background buat hemat RAM, terus reload ulang
// diam-diam pas dibuka lagi. React kehilangan SEMUA state pas ini kejadian
// (tab aktif balik ke Dashboard, modal yang lagi kebuka ketutup, scroll balik
// ke atas) - padahal dari sisi user kerasanya cuma "pindah tab bentar".
//
// Modal: cuma SATU yang realistis kebuka bareng dalam satu waktu, jadi 1 key
// localStorage cukup buat SEMUA jenis modal (LeadModal, Deal, Visit, dst) -
// dibedain lewat field `kind`. Expire 24 jam - kalau emang beneran ditinggal
// lama, gak maksa restore modal yang mungkin udah gak relevan lagi.
const MODAL_KEY = "nexto-open-modal";
const MODAL_TTL_MS = 24 * 60 * 60 * 1000;

function readModalRaw() {
  try {
    const raw = localStorage.getItem(MODAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.savedAt || 0) > MODAL_TTL_MS) {
      localStorage.removeItem(MODAL_KEY);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

export function saveOpenModal(kind, data) {
  try {
    localStorage.setItem(MODAL_KEY, JSON.stringify({ kind, data: data || {}, savedAt: Date.now() }));
  } catch (_) {}
}

// `kind` opsional - kalau diisi, cuma clear kalau modal yang lagi kesimpen
// jenisnya SAMA (jaga-jaga ada modal LAIN yang keburu kebuka duluan sebelum
// yang ini sempet ke-clear, jangan sampe modal lain ikut kehapus catatannya).
export function clearOpenModal(kind) {
  try {
    if (kind) {
      const cur = readModalRaw();
      if (cur && cur.kind !== kind) return;
    }
    localStorage.removeItem(MODAL_KEY);
  } catch (_) {}
}

export function getOpenModal(expectedKind) {
  const parsed = readModalRaw();
  if (!parsed || parsed.kind !== expectedKind) return null;
  return parsed.data || {};
}

// ---- SCROLL POSITION per tab ----
// sessionStorage (bukan localStorage) SENGAJA dipilih - otomatis ke-hapus
// begitu tab BENERAN ditutup (bukan cuma di-discard/reload paksa browser),
// jadi gak akan nyangkut nunjukin posisi scroll dari berhari-hari lalu kalau
// user buka Nexto lagi di sesi baru.
const SCROLL_PREFIX = "nexto-scroll-";
export function saveScrollPos(tabKey, y) {
  try { sessionStorage.setItem(SCROLL_PREFIX + tabKey, String(y)); } catch (_) {}
}
export function getScrollPos(tabKey) {
  try { return Number(sessionStorage.getItem(SCROLL_PREFIX + tabKey) || 0); } catch (_) { return 0; }
}
