// Aturan pindah tahap proyek: lead tidak boleh melompati Proyek Deal.
// Proyek Berjalan hanya bisa dimasuki dari Proyek Deal. Proyek Selesai hanya dari Proyek Deal atau Proyek Berjalan.
const SUMBER_BOLEH = {
  proyek_berjalan: ["proyek_deal", "proyek_berjalan"],
  proyek_selesai: ["proyek_deal", "proyek_berjalan", "proyek_selesai"],
};

// Mengembalikan pesan kalau pindah tidak boleh, atau null kalau boleh.
export function pesanPindahDilarang(dariKey, keKey) {
  const boleh = SUMBER_BOLEH[keKey];
  if (!boleh || !dariKey || dariKey === keKey) return null;
  if (boleh.includes(dariKey)) return null;
  const label = keKey === "proyek_berjalan" ? "Proyek Berjalan" : "Proyek Selesai";
  return `Lead harus lewat tahap Proyek Deal dulu sebelum masuk ${label}.`;
}
