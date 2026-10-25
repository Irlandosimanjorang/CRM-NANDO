// Papan kemenangan tim (25 Okt 2026) - kemenangan dihitung dari catatan transaksi deal
// (deal_transactions), sama dengan tab Deal dan omzet di layar TV.
//
// Deal dengan nilai Rp 0 tetap tampil sebagai kemenangan, tapi ditandai
// "Nilai belum diisi" (value = 0), supaya tidak terbaca sebagai deal gagal.
export const WIN_WINDOW_DAYS = 7;
export const WIN_PERIODS = [
  { key: "7", label: "7 hari" },
  { key: "30", label: "30 hari" },
  { key: "month", label: "Bulan ini" },
];

// Awal periode dalam ms. "month" = tanggal 1 bulan berjalan.
export function periodStart(key, now = Date.now()) {
  if (key === "month") {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  return now - Number(key) * 86400000;
}

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

// Waktu deal dalam ms: tanggal deal (WIB, tanpa jam) kalau ada, kalau tidak waktu input.
function dealWhen(d) {
  return d.deal_date ? new Date(`${d.deal_date}T00:00:00+07:00`).getTime() : new Date(d.created_at).getTime();
}

/**
 * Kemenangan (catatan deal) sejak fromMs, terbaru di atas.
 * Tiap item: id, leadId, name, value, uid (sales), sales (nama, atau "Tim"), when (ms), ago (teks).
 */
export function collectDealWins(deals, members = [], fromMs = periodStart("7"), now = Date.now()) {
  const nameOf = (uid) => (members || []).find((m) => m.user_id === uid)?.display_name || "";
  const out = [];
  for (const d of deals || []) {
    const when = dealWhen(d);
    if (isNaN(when) || when < fromMs) continue;
    out.push({
      id: d.id,
      leadId: d.lead_id,
      name: d.lead_name || "Tanpa nama",
      value: Number(d.deal_value) || 0,
      uid: d.user_id,
      sales: nameOf(d.user_id) || "Tim",
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
    const key = w.uid || w.sales;
    const g = map.get(key) || { uid: w.uid, sales: w.sales, count: 0, total: 0, latest: w };
    g.count += 1;
    g.total += w.value;
    if (w.when > g.latest.when) g.latest = w;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count || b.latest.when - a.latest.when);
}
