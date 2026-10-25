import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { getIndustryDemo } from "../../src/lib/industryDemo";
import { getIndustryTemplate } from "../../src/lib/industryTemplates";
import TvScreen from "../../src/pages/TvScreen.jsx";

// Tes layar TV (login palsu, data dummy). Buka /scripts/smoke/tv.html.
const tpl = getIndustryTemplate("corporate_consultant");
const stages = tpl.stages.map((s, i) => ({ ...s, id: "s" + i, position: i }));
const demo = getIndustryDemo("corporate_consultant", stages);
const wonKey = (stages.find((s) => s.type === "won") || stages[stages.length - 1]).key;
const now = Date.now();
const ago = (menit) => new Date(now - menit * 60000).toISOString();
const wonDeals = [
  { id: "w1", name: "PT Samudra Kreasi", stage_key: wonKey, deal_value: 85000000, deal_date: ago(5), assigned_to: "u1", user_id: "u1" },
  { id: "w2", name: "CV Bintang Logistik", stage_key: wonKey, deal_value: 42000000, deal_date: ago(90), assigned_to: "u2", user_id: "u2" },
  { id: "w3", name: "PT Mitra Nusantara", stage_key: wonKey, deal_value: 0, deal_date: ago(200), assigned_to: "u2", user_id: "u2" },
];
const dummyVisits = [
  { user_id: "u2", lead_id: "v1", lead_name: "PT Adhi Karya Prima", checked_in_at: ago(25) },
  { user_id: "u1", lead_id: "v2", lead_name: "CV Sinar Abadi", checked_in_at: ago(70) },
  { user_id: "u2", lead_id: "v3", lead_name: "PT Triguna Energi", checked_in_at: ago(130) },
  { user_id: "u1", lead_id: "v4", lead_name: "PT Bumi Lestari", checked_in_at: ago(200) },
];
window.__M = {
  org: { id: "o1", name: "PT Uji", owner_user_id: "u1", plan: "enterprise", member_limit: 4, industry: "corporate_consultant", custom_field_labels: {} },
  members: [{ user_id: "u1", role: "owner", display_name: "Nando" }, { user_id: "u2", role: "sales_rep", display_name: "Budi" }],
  leads: [...demo.leads, ...wonDeals],
  stages,
};
const fetchVisits = async () => dummyVisits;
createRoot(document.getElementById("root")).render(<TvScreen fetchVisits={fetchVisits} />);
