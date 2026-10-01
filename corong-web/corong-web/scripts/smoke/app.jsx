import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { getIndustryDemo } from "../../src/lib/industryDemo";
import { getIndustryTemplate } from "../../src/lib/industryTemplates";
import App from "../../src/App.jsx";

// Tes App lengkap (login palsu): owner Enterprise industri Consultant.
const tpl = getIndustryTemplate("corporate_consultant");
const stages = tpl.stages.map((s, i) => ({ ...s, id: "s" + i, position: i }));
const demo = getIndustryDemo("corporate_consultant", stages);
const many = Array.from({ length: 40 }, (_, i) => ({ id: "x" + i, name: "PT Contoh " + i, stage_key: stages[i % 3].key, created_at: new Date(Date.now() - 80 * 86400000).toISOString(), progress_notes: [], assigned_to: "u1" }));
window.__M = {
  org: { id: "o1", name: "PT Uji", owner_user_id: "u1", plan: "enterprise", member_limit: 4, industry: "corporate_consultant", custom_field_labels: {} },
  settings: { plan: null, community_display_name: "Nando" }, role: "owner",
  members: [{ user_id: "u1", role: "owner", name: "Nando" }, { user_id: "u2", role: "sales_rep", name: "Budi" }],
  leads: [...demo.leads, ...many], stages, deals: demo.deals, competitors: demo.competitors,
};
createRoot(document.getElementById("root")).render(<App />);
