// Membuat src/demo/mockdb.js (pengganti lib/db untuk demo publik nexto.site/demo).
// Dasarnya sama dengan scripts/smoke/gen-mockdb.cjs; getter yang butuh data nyata diganti data demo (window.__D, lihat src/demo/data.js).
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../../src/lib/db.js"), "utf8");
const names = [...new Set([...src.matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map((m) => m[1] || m[2]))];
const smokeSrc = fs.readFileSync(path.join(__dirname, "../smoke/gen-mockdb.cjs"), "utf8");
const m = smokeSrc.match(/const SPECIAL = (\{[\s\S]*?\n\});/);
if (!m) throw new Error("SPECIAL tidak ditemukan di gen-mockdb.cjs");
const SPECIAL = { ...eval("(" + m[1] + ")") };
Object.assign(SPECIAL, {
  getMyOrg: "window.__D.org", getSettings: "window.__D.settings", getMyRole: "window.__D.role", getCurrentUserId: '"u1"', getOrgMembers: "window.__D.members",
  getLeads: "window.__D.leads", getStages: "window.__D.stages", getDealTransactions: "window.__D.deals", getCompetitors: "window.__D.competitors",
  getTeamActivity: "window.__D.teamActivity", getTeamFeed: "window.__D.feed", getTeamTargets: "window.__D.targets", listStageChanges: "window.__D.stageChanges",
  getTodayAdvisorRun: "window.__D.advisorRun", getAdvisorHistory: "[window.__D.advisorRun]", getProductCatalog: "window.__D.catalog",
  getMemberNotes: "(window.__D.leads.slice(0, 6).map((l, i) => ({ id: 'mn' + i, lead_id: l.id, text: l.progressLog[0] ? l.progressLog[0].text : '', created_at: new Date(Date.now() - i * 3600000).toISOString(), leads: { name: l.name } })))",
  getTeamActivityDays: "window.__D.activityDays", getMyNotifications: "[]", getUnreadNotificationCount: "0",
});
const SYNC = { formatQuotaDate: '(iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })' };
let out = "// AUTO-GENERATED oleh scripts/demo/gen-demo-mockdb.cjs - jangan diedit manual.\n";
for (const n of names) {
  if (SYNC[n]) { out += `export const ${n} = ${SYNC[n]};\n`; continue; }
  let v = SPECIAL[n];
  if (!v) v = /^(get|list|fetch)/.test(n) ? (/(s|History|Ids|List)$/.test(n) ? "[]" : "null") : "null";
  out += `export async function ${n}(){ return ${v}; }\n`;
}
fs.writeFileSync(path.join(__dirname, "../../src/demo/mockdb.js"), out);
console.log(`demo mockdb.js: ${names.length} fungsi`);
