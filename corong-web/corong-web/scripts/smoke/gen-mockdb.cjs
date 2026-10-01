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
};
let out = "// AUTO-GENERATED oleh gen-mockdb.cjs - jangan diedit manual.\n";
for (const n of names) {
  let v = SPECIAL[n];
  if (!v) v = /^(get|list|fetch)/.test(n) ? (/(s|History|Ids|List)$/.test(n) ? "[]" : "null") : "null";
  out += `export async function ${n}(){ return ${v}; }\n`;
}
fs.writeFileSync(path.join(__dirname, "mockdb.js"), out);
console.log(`mockdb.js: ${names.length} fungsi`);
