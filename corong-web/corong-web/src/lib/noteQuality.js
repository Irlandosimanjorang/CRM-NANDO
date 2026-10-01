// Penanda catatan progress "terlalu singkat" (2 Okt 2026, permintaan Nando) -
// biar angka "Lead di-update" di tab Team gak bisa dikejar pakai catatan asal
// isi. Aturan ini SAMA PERSIS dengan fungsi database public.is_thin_note()
// (dipakai RPC get_team_activity) - kalau diubah, ubah keduanya.
const GENERIC = new Set([
  "ok", "oke", "okay", "follow up", "followup", "fu", "f/u", "sudah dihubungi", "dihubungi",
  "sudah", "belum", "belum respon", "belum ada respon", "tidak ada respon", "no respon",
  "no response", "sudah wa", "sudah telp", "sudah telepon", "call", "visit", "done", "test", "tes",
]);

export const THIN_NOTE_MIN_CHARS = 15;

export function isThinNote(text) {
  const t = String(text || "").trim();
  if (t.length < THIN_NOTE_MIN_CHARS) return true;
  return GENERIC.has(t.replace(/[\p{P}\s]+$/u, "").toLowerCase());
}
