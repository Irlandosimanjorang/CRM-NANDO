// Perbandingan string dengan waktu konstan, dipakai untuk cek secret (cron, webhook).
// Dipakai supaya selisih waktu jawaban tidak bisa dipakai untuk menebak secret karakter demi karakter.
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
