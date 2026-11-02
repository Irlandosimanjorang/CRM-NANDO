// Kartu garansi QR per proyek (3 Nov 2026). Pembuatan token memakai helper yang sama dengan form customer.
export { makeFormToken, hashFormToken } from "./customerForm";

export const WARRANTY_PUBLIC_BASE = "https://nexto.site/garansi";
export const WARRANTY_SERVICE_BASE = "https://nexto.site/servis";
export const DEFAULT_WARRANTY_MONTHS = 60;

// Nomor WhatsApp dalam format 62xxxxxxxxxx. Nomor 08xx otomatis diubah ke 628xx. Mengembalikan null jika tidak valid.
export function normalizeWa(input) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

export function warrantyUntil(installedAt, months) {
  const d = new Date(`${installedAt}T00:00:00`);
  d.setMonth(d.getMonth() + Number(months || 0));
  return d.toISOString().slice(0, 10);
}

export function publicCardUrl(token) {
  return `${WARRANTY_PUBLIC_BASE}?t=${token}`;
}

export function serviceUrl(token) {
  return `${WARRANTY_SERVICE_BASE}?t=${token}`;
}
