// Bikin mockdb.js dari daftar export src/lib/db.js (dipanggil `npm run smoke`).
// Getter yang balikin objek di app asli dikasih bentuk realistis di SPECIAL,
// biar tes gak gagal palsu karena data uji yang salah bentuk.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../../src/lib/db.js"), "utf8");
const names = [...new Set([...src.matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map((m) => m[1] || m[2]))];
const SPECIAL = {
  getMyOrg: "window.__M.org", getSettings: "window.__M.settings", getMyRole: "window.__M.role", getCurrentUserId: '"u1"',
  getOrgMembers: "window.__M.members", getProductCatalog: "({ company_profile: '', products: [] })",
  getLeads: "window.__M.leads", getStages: "window.__M.stages", getDealTransactions: "window.__M.deals", getCompetitors: "window.__M.competitors",
  getLeadGenCooldown: "({ canGenerate: true, usedThisMonth: 1, quotaMax: 4, nextAvailableAt: null })",
  getCheckinCooldown: "({ canCheckIn: true, usedThisMonth: 2, quotaMax: 50, nextAvailableAt: null })",
  getEnrichProgress: "[]",
  getMemberNotes: "([{ id: 'n1', lead_id: 'a', text: 'HRD minta proposal assessment 40 supervisor, kirim minggu ini.', created_at: new Date().toISOString(), leads: { name: 'PT Mitra Logistik' } }, { id: 'n2', lead_id: 'a', text: 'ok', created_at: new Date(Date.now() - 3600000).toISOString(), leads: { name: 'PT Mitra Logistik' } }, { id: 'n3', lead_id: 'b', text: 'Sudah dihubungi.', created_at: new Date(Date.now() - 7200000).toISOString(), leads: { name: 'PT Bank Sejahtera' } }])",
  getTeamActivity: "({ members: [{ user_id: 'u1', role: 'owner', name: 'Nando', visits: 1, notes: 5, notes_thin: 2, leads_updated: 3, new_leads: 4, stage_moves: 1, deals: 0, deal_value: 0, last_activity_at: new Date().toISOString() }, { user_id: 'u2', role: 'sales_rep', name: 'Budi', visits: 2, notes: 3, leads_updated: 3, new_leads: 2, stage_moves: 3, deals: 1, deal_value: 50000000, last_activity_at: new Date(Date.now() - 86400000).toISOString() }], feed: [] })",
};
let out = "// AUTO-GENERATED oleh gen-mockdb.cjs - jangan diedit manual.\n";
for (const n of names) {
  let v = SPECIAL[n];
  if (!v) v = /^(get|list|fetch)/.test(n) ? (/(s|History|Ids|List)$/.test(n) ? "[]" : "null") : "null";
  out += `export async function ${n}(){ return ${v}; }\n`;
}
fs.writeFileSync(path.join(__dirname, "mockdb.js"), out);
console.log(`mockdb.js: ${names.length} fungsi`);
