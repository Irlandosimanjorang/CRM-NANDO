// Entri deal per transaksi, dihitung di klien dari data lead dan transaksi.
// Sama dengan fungsi database org_deal_entries (dipakai tab Team, Report, dan Dashboard):
// - lead menang yang punya transaksi -> satu baris per transaksi (bulan = tanggal transaksi)
// - lead menang tanpa transaksi (deal lama) -> satu baris dengan deal_value dan deal_date lead
// Dipakai untuk halaman tim org lain, yang datanya dibaca dari snapshot.
export function dealEntriesFromData(leads = [], stages = [], txs = [], projectDeal = false, changes = []) {
  if (projectDeal) {
    // Org project_deal (BSB): satu baris per lead proyek. Tanggal = deal_date, atau tanggal masuk Proyek Deal kalau kosong.
    const PROJECT_KEYS = ["proyek_deal", "proyek_berjalan", "proyek_selesai"];
    const firstPd = new Map();
    for (const c of changes) {
      if (c.to_stage !== "proyek_deal") continue;
      const prev = firstPd.get(c.lead_id);
      if (!prev || String(c.changed_at) < String(prev)) firstPd.set(c.lead_id, c.changed_at);
    }
    const out = [];
    for (const l of leads) {
      if (l.deleted_at || !PROJECT_KEYS.includes(l.stage_key)) continue;
      const tgl = l.deal_date || (firstPd.get(l.id) ? new Date(new Date(firstPd.get(l.id)).getTime() + 7 * 3600000).toISOString().slice(0, 10) : null);
      if (!tgl) continue;
      out.push({ tx_id: null, lead_id: l.id, pic: l.assigned_to || l.user_id, deal_date: tgl, deal_value: Number(l.deal_value) || 0 });
    }
    return out;
  }
  const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));
  const txByLead = new Map();
  for (const t of txs) {
    if (!txByLead.has(t.lead_id)) txByLead.set(t.lead_id, []);
    txByLead.get(t.lead_id).push(t);
  }
  const out = [];
  for (const l of leads) {
    if (l.deleted_at) continue;
    const pic = l.assigned_to || l.user_id;
    const mine = txByLead.get(l.id);
    if (mine && mine.length) {
      // Transaksi tetap dihitung walau lead sudah dibuka lagi (repeat order).
      for (const t of mine) out.push({ tx_id: t.id, lead_id: l.id, pic, deal_date: t.deal_date, deal_value: Number(t.deal_value) || 0 });
    } else if (wonKeys.has(l.stage_key)) {
      out.push({ tx_id: null, lead_id: l.id, pic, deal_date: l.deal_date, deal_value: Number(l.deal_value) || 0 });
    }
  }
  return out;
}
