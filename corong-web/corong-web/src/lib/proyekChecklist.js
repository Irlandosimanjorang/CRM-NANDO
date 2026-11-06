// Checklist proyek deal (3 Nov 2026). Kuncinya disimpan di leads.proyek_checklist: { kunci: { at, by } }.
// auto: nilainya dari data lain, bukan dicentang. SO terisi dari memo.so_number (dibuat finance di payment).
// terkunci: centang baru bisa setelah SPK diterima GM (memo.spk_diterima), dari journey.
export const PROYEK_CHECKLIST = [
  { key: "sph_ttd", label: "SPH sudah ditandatangani customer" },
  { key: "qr_berkas", label: "Pemberkasan QR code sudah selesai" },
  { key: "invoice_performa", label: "Performa invoice sudah dibuat" },
  { key: "so", label: "No. SO sudah dibuat", auto: true },
  { key: "drawing", label: "Drawing sudah dibuat", terkunci: "spk" },
];

// Sudah tercentang? Item auto mengikuti data lain. Lainnya dari checklist.
export const sudahCentang = (item, checklist, memo) => (item.auto ? !!memo?.so_number : !!(checklist || {})[item.key]);

// Item terkunci? Drawing baru bisa setelah SPK diterima GM. Item auto tidak bisa diklik.
export const terkunci = (item, memo) => !!item.auto || (item.terkunci === "spk" && memo?.spk_diterima !== true);
