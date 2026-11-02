// Form data customer dari QR proyek deal (2 Nov 2026). Daftar isian ini harus sama dengan
// TEXT_LIMITS di supabase/functions/customer-form/index.ts.
export const FORM_FIELDS = [
  { key: "nama_lengkap", label: "Nama lengkap", required: true, max: 120 },
  { key: "nik", label: "NIK (sesuai KTP)", required: true, max: 16, inputMode: "numeric" },
  { key: "alamat", label: "Alamat sesuai KTP", max: 300, wide: true },
  { key: "no_hp", label: "Nomor HP / WhatsApp", max: 20, inputMode: "tel" },
  { key: "email", label: "Email", max: 120, inputMode: "email" },
  { key: "nama_perusahaan", label: "Nama perusahaan (jika ada)", max: 120 },
  { key: "catatan", label: "Catatan tambahan", max: 500, wide: true, textarea: true },
];

export const CUSTOMER_FORM_BASE = "https://nexto.site/isi";

// Token acak 32 byte, dikirim sebagai base64url. Hanya hash SHA-256 yang masuk database.
export function makeFormToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashFormToken(token) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formUrl(token) {
  return `${CUSTOMER_FORM_BASE}?t=${token}`;
}
