// Lead terbengkalai (2 Okt 2026, permintaan Nando) - dipakai panel "Lead
// terbengkalai" di tab Team (owner/manager) dan kartu "Lead Anda yang
// terbengkalai" di Dashboard (setiap user), supaya hitungannya sama persis.
//
// Terbengkalai = lead aktif (bukan menang/kalah, tidak sedang dijeda lewat
// wait_until) yang lebih dari IDLE_DAYS hari tanpa catatan progress, kontak,
// maupun aktivitas sejak dibuat. Dibedakan:
// - "Terhenti": pernah ada progress/kontak lalu berhenti (tanda lalai).
// - "Belum dihubungi": belum pernah ada progress/kontak sama sekali
//   (biasanya hasil import yang belum dibagikan/dikerjakan).
export const IDLE_DAYS = 14;

// Tingkat keparahan berdasarkan lama tanpa progress.
export const SEVERITY = [
  { key: 1, label: "15–30 hari", max: 30, bar: "bg-amber-400", badge: "bg-amber-50 text-amber-800", tile: "bg-amber-50 text-amber-900", tileSub: "text-amber-800" },
  { key: 2, label: "31–60 hari", max: 60, bar: "bg-orange-500", badge: "bg-orange-50 text-orange-800", tile: "bg-orange-50 text-orange-900", tileSub: "text-orange-800" },
  { key: 3, label: "Lebih dari 60 hari", max: Infinity, bar: "bg-rose-500", badge: "bg-rose-50 text-rose-800", tile: "bg-rose-50 text-rose-900", tileSub: "text-rose-800" },
];
export const severityOf = (days) => SEVERITY.find((s) => days <= s.max) || SEVERITY[SEVERITY.length - 1];

function toTime(v) {
  if (!v) return NaN;
  return new Date(v).getTime();
}

/**
 * Daftar lead terbengkalai, urut dari tahap paling jauh (paling dekat closing)
 * lalu dari yang paling lama diam. Tiap item = lead + field bantu:
 * _idle (hari), _touched (pernah ada progress/kontak), _lastNote (teks
 * catatan terakhir), _stageIdx, _sev (objek SEVERITY).
 */
export function collectIdleLeads(leads, stages) {
  const closed = new Set((stages || []).filter((s) => s.type === "won" || s.type === "lost").map((s) => s.key));
  const stageIdx = Object.fromEntries((stages || []).map((s, i) => [s.key, i]));
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const out = [];
  for (const l of leads || []) {
    if (closed.has(l.stage_key)) continue;
    if (l.wait_until && String(l.wait_until) >= today) continue;
    const notes = (l.progress_notes || []).filter((n) => n && (n.text || "").trim());
    const lastNote = notes.reduce((best, n) => (!best || (n.note_date || "") > (best.note_date || "") ? n : best), null);
    const times = [toTime(l.last_contact), toTime(lastNote?.note_date), toTime(l.created_at)].filter((t) => !isNaN(t));
    if (!times.length) continue;
    const idle = Math.floor((Date.now() - Math.max(...times)) / 86400000);
    if (idle <= IDLE_DAYS) continue;
    out.push({
      ...l,
      _idle: idle,
      _touched: !!(lastNote || l.last_contact),
      _lastNote: lastNote ? lastNote.text.trim() : "",
      _stageIdx: stageIdx[l.stage_key] ?? -1,
      _sev: severityOf(idle),
    });
  }
  return out.sort((a, b) => b._stageIdx - a._stageIdx || b._idle - a._idle);
}

export function countBySeverity(items) {
  const c = { 1: 0, 2: 0, 3: 0 };
  for (const i of items) c[i._sev.key] += 1;
  return c;
}
