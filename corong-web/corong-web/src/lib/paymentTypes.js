// Pilihan tipe payment (3 Nov 2026). Shopee dan Tokopedia hanya muncul untuk organisasi yang
// punya saklar fitur "marketplace_payment" (sekarang MAP dan BSB). Nilainya disimpan apa adanya di leads.payment_type.
export const PAYMENT_TYPES = ["Transfer", "Tunai", "Termin", "Giro", "Kartu kredit", "Lainnya"];
export const MARKETPLACE_PAYMENT_TYPES = ["Shopee", "Tokopedia"];

export function paymentTypesFor(marketplace) {
  if (!marketplace) return PAYMENT_TYPES;
  // "Lainnya" tetap di paling akhir.
  return [...PAYMENT_TYPES.slice(0, -1), ...MARKETPLACE_PAYMENT_TYPES, "Lainnya"];
}
