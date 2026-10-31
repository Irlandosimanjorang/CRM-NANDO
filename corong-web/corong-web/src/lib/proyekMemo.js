// Field memo proyek (31 Okt 2026): sama dengan formulir pengajuan sales order. Tanda tangan tidak diisi di sini.
// Dipakai di pop-up Proyek Deal (LeadBoard) dan tombol Memo di LeadModal.
export const MEMO_FIELDS = [
  { key: "customer", label: "Customer", required: true, placeholder: "Nama customer", wide: true },
  { key: "tanggal", label: "Tanggal", required: true, placeholder: "Mis. 31 Okt 2026" },
  { key: "telp", label: "No. Telp", required: true, placeholder: "Mis. 0812..." },
  { key: "alamat", label: "Alamat", required: true, placeholder: "Alamat lengkap", wide: true },
  { key: "no_penawaran", label: "No. Penawaran", required: true, placeholder: "" },
  { key: "no_po", label: "No. PO", required: true, placeholder: "" },
  { key: "deal_kontrak", label: "Deal Kontrak", required: true, placeholder: "" },
  { key: "keterangan", label: "Keterangan", required: false, placeholder: "Opsional", wide: true },
  { key: "marketing", label: "Marketing", required: true, placeholder: "Nama marketing" },
  { key: "estimator", label: "Estimator", required: true, placeholder: "Nama estimator" },
];

export const memoComplete = (memo) => MEMO_FIELDS.every((f) => !f.required || String(memo?.[f.key] || "").trim().length > 0);
