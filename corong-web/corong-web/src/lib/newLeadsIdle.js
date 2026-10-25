// Lead baru belum disentuh (25 Okt 2026, permintaan Nando) - lead yang baru masuk
// tapi belum ada kontak maupun catatan progress dalam NEW_LEAD_MINUTES menit.
// Tujuannya supaya lead baru tidak hilang sebelum sempat dihubungi.
//
// Dibatasi ke lead yang dibuat dalam 24 jam terakhir, supaya hasil impor lama
// (yang memang belum dikerjakan) tidak membanjiri daftar peringatan ini.
// Lead yang sudah menang/kalah tidak dihitung.
export const NEW_LEAD_MINUTES = 60;
const WINDOW_MINUTES = 24 * 60;

/**
 * Daftar lead baru yang belum disentuh, urut dari yang paling lama diabaikan.
 * Tiap item = lead + _minutes (berapa menit sejak dibuat).
 */
export function collectUntouchedNewLeads(leads, stages, now = Date.now()) {
  const closed = new Set((stages || []).filter((s) => s.type === "won" || s.type === "lost").map((s) => s.key));
  const out = [];
  for (const l of leads || []) {
    if (l.deleted_at || closed.has(l.stage_key) || !l.created_at) continue;
    if (l.last_contact) continue;
    const hasNote = (l.progress_notes || []).some((n) => n && (n.text || "").trim());
    if (hasNote) continue;
    const minutes = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
    if (isNaN(minutes) || minutes < NEW_LEAD_MINUTES || minutes > WINDOW_MINUTES) continue;
    out.push({ ...l, _minutes: minutes });
  }
  return out.sort((a, b) => b._minutes - a._minutes);
}

// Format "2 jam 5 menit" / "45 menit" untuk ditampilkan.
export function formatAge(minutes) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}
