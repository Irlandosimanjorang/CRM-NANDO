// Papan kemenangan tim (25 Okt 2026) - kemenangan (deal masuk tahap menang) dalam
// WIN_WINDOW_DAYS hari terakhir, dipakai kartu "Kemenangan terbaru" di Dashboard.
//
// Deal dengan nilai Rp 0 tetap tampil sebagai kemenangan, tapi ditandai
// "Nilai belum diisi" (value = 0), supaya tidak terbaca sebagai deal gagal.
export const WIN_WINDOW_DAYS = 7;

export function formatAgo(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Kemenangan dalam WIN_WINDOW_DAYS hari terakhir, terbaru di atas.
 * Tiap item: id, name, value, sales (nama, atau "Tim" kalau tidak diketahui), when (ms), ago (teks).
 */
export function collectRecentWins(leads, stages, members = [], now = Date.now()) {
  const wonKeys = new Set((stages || []).filter((s) => s.type === "won").map((s) => s.key));
  const cutoff = now - WIN_WINDOW_DAYS * 86400000;
  const nameOf = (uid) => (members || []).find((m) => m.user_id === uid)?.display_name || "";
  const out = [];
  for (const l of leads || []) {
    if (l.deleted_at || !wonKeys.has(l.stage_key)) continue;
    const when = l.deal_date ? new Date(l.deal_date).getTime() : new Date(l.updated_at).getTime();
    if (isNaN(when) || when < cutoff) continue;
    out.push({
      id: l.id,
      name: l.name,
      value: Number(l.deal_value) || 0,
      sales: nameOf(l.assigned_to || l.user_id) || "Tim",
      when,
      ago: formatAgo(now - when),
    });
  }
  return out.sort((a, b) => b.when - a.when);
}

/**
 * Kemenangan dikelompokkan per sales: total nilai, jumlah deal, dan deal terbaru.
 * Diurutkan dari total nilai terbesar (lalu jumlah deal, lalu yang paling baru).
 */
export function groupWinsBySales(wins) {
  const map = new Map();
  for (const w of wins || []) {
    const g = map.get(w.sales) || { sales: w.sales, count: 0, total: 0, latest: w };
    g.count += 1;
    g.total += w.value;
    if (w.when > g.latest.when) g.latest = w;
    map.set(w.sales, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count || b.latest.when - a.latest.when);
}
