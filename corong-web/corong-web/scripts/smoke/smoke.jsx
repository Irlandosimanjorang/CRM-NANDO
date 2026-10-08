import { Component, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { getIndustryDemo } from "../../src/lib/industryDemo";
import { getIndustryTemplate } from "../../src/lib/industryTemplates";
import Dashboard from "../../src/tabs/Dashboard";
import Leads from "../../src/tabs/Leads";
import Settings from "../../src/tabs/Settings";
import GenerateLeads from "../../src/tabs/GenerateLeads";
import Deal from "../../src/tabs/Deal";
import VisitFollowup from "../../src/tabs/VisitFollowup";
import Kompetitor from "../../src/tabs/Kompetitor";
import Nex from "../../src/tabs/Nex";
import Advisor from "../../src/tabs/Advisor";
import IndustryDemo from "../../src/tabs/IndustryDemo";
import Team from "../../src/tabs/Team";
import LeadModal from "../../src/components/LeadModal";
import EnterpriseInvoicePanel from "../../src/components/EnterpriseInvoicePanel";
import QuotationPanel from "../../src/components/QuotationPanel";
import OrgFeaturesPanel from "../../src/components/OrgFeaturesPanel";
import AddonTokensPanel from "../../src/components/AddonTokensPanel";
import MonthlyReport from "../../src/components/MonthlyReport";
import ChatInboundCard from "../../src/components/ChatInboundCard";
import LeadConversation from "../../src/components/LeadConversation";
import { INDUSTRY_TEMPLATES } from "../../src/lib/industryTemplates";
import { AiCostPanel } from "../../src/tabs/AdminDashboard";

const q = new URLSearchParams(location.search);
const ind = q.get("ind"), role = q.get("role"), tab = q.get("tab");
const tpl = getIndustryTemplate(ind);
const stages = tpl.stages.map((s, i) => ({ ...s, id: "s" + i, position: i }));
const demo = getIndustryDemo(ind, stages);
const ent = role !== "free";
// lead "aneh": field kosong/null, tahap gak dikenal, nomor ganda - data nyata sering begini
const weird = { id: "w1", name: "Lead Data Minim", stage_key: "tahap_hilang", phone: "0812-1111-2222, 021-555", email: null, city: null, category: null, product: null, created_at: null, last_contact: null, next_action: null, progress_notes: null, assigned_to: "u2" };
// Sebagian lead dibuat 40 hari lalu tanpa progress -> muncul di "Lead terbengkalai".
const leads = [...demo.leads.map((l, i) => ({ ...l, assigned_to: i % 2 ? "u2" : "u1", created_at: new Date(Date.now() - (i % 2 ? 2 : 80) * 86400000).toISOString(), progress_notes: i === 0 ? [{ id: "pn1", note_date: new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10), text: "Minta revisi proposal dan jadwal ulang presentasi." }] : [] })), weird];
// ?groups=1: enam lead pertama dijadikan cabang satu grup (uji tampilan grup perusahaan).
if (q.get("groups")) leads.slice(0, 6).forEach((l) => { l.parent_company = "PT Induk Uji"; });
// ?groups=3: baris holding adalah lead juga (namanya sama dengan holding, tanpa kolom holding sendiri).
if (q.get("groups") === "3") { leads[0].name = "Uji Group"; leads[0].group_holding = ""; leads[0].parent_company = ""; leads.slice(1, 4).forEach((l) => { l.group_holding = "Uji Group"; l.parent_company = ""; }); }
// ?groups=2: dua perusahaan induk di bawah satu holding (uji tiga tingkat).
if (q.get("groups") === "2") leads.slice(0, 6).forEach((l, i) => { l.group_holding = "Uji Group"; l.parent_company = i < 2 ? "PT Induk Uji A" : i < 4 ? "PT Induk Uji B" : ""; });
// ?tok=5&qused=4: saldo token tambahan dan pemakaian kuota Generate Leads (uji tab Generate Leads).
window.__TOK = Number(q.get("tok")) || 0;
if (q.get("qused") !== null) window.__QUSED = Number(q.get("qused"));
window.__M = {
  org: { id: "o1", name: "PT Uji", owner_user_id: role === "sales" ? "u9" : "u1", plan: ent ? "enterprise" : null, member_limit: ent ? 4 : 1, industry: ind, custom_field_labels: {} },
  settings: { plan: ent ? null : null }, role: role === "sales" ? "sales_rep" : "owner",
  members: [{ user_id: "u1", role: role === "sales" ? "sales_rep" : "owner", name: "Nando" }, { user_id: "u2", role: "sales_rep", name: "Budi" }],
  leads, stages, deals: demo.deals, competitors: demo.competitors,
};
const canManage = role !== "sales", myLevel = ent ? 2 : 0;
const noop = () => {};
const views = {
  dashboard: <Dashboard myUid="u1" leads={leads} stages={stages} dealTransactions={demo.deals} settings={{}} onGo={noop} onOpenLead={noop} myLevel={myLevel} onChanged={noop} isEnterprise={ent} canManage={canManage} />,
  leads: <Leads leads={leads} stages={stages} settings={{}} industry={ind} customFieldLabels={{}} myLevel={myLevel} onChanged={noop} canManage={canManage} isEnterprise={ent} />,
  generate: <GenerateLeads stages={stages} industry={ind} onChanged={noop} onNotify={noop} />,
  deal: <Deal leads={leads} stages={stages} dealTransactions={demo.deals} industry={ind} onEdit={noop} onChanged={noop} />,
  visit: <VisitFollowup leads={leads} onEdit={noop} onChanged={noop} onNotify={noop} isEnterprise={ent} myLevel={myLevel} industry={ind} />,
  team: <Team leads={leads} stages={stages} dealTransactions={demo.deals} onOpenLead={noop} canManage={canManage} />,
  kompetitor: <Kompetitor competitors={demo.competitors} onChanged={noop} />,
  nex: <Nex dummy={!ent} settings={{}} />,
  advisor: <Advisor leads={leads} stages={stages} onOpen={noop} dummy={!ent} demoRecs={demo.advisorRecs} />,
  industrydemo: <IndustryDemo />,
  settings: <Settings settings={{}} stages={stages} leads={leads} onChanged={noop} userEmail="uji@example.com" locked={false} />,
  report: (() => { const st = INDUSTRY_TEMPLATES.bsb_upvc.stages; const d = (day) => `2026-10-${String(day).padStart(2, "0")}T03:00:00Z`; const L = (id, stage, v, c, dd, src) => ({ id, name: id, assigned_to: ["u1", "u2", "u3"][id.length % 3], ad_campaign: (src || "Meta") === "Meta" ? "promo jendela UPVC" : "", custom_field_2: src || "Meta", stage_key: stage, deal_value: v, created_at: d(c), updated_at: d(c), deal_date: dd ? `2026-10-${String(dd).padStart(2, "0")}` : null }); const ls = [L("Andi", "sph_terlayang", 14500000, 1), L("Charles", "sph_terlayang", 22200000, 1, 0, "TikTok"), L("Agus", "sph_terlayang", 7300000, 2, 0, "Customer datang"), L("Yaya", "sph_terlayang", 4500000, 3), L("Marc", "hot_progress", 98000000, 3), L("Robby", "proyek_deal", 52000000, 1, 6), L("Saifur", "proyek_deal", 1000000, 7, 7, "TikTok"), L("Iqbal", "no_deal", 13000000, 5)]; return <div style={{ background: "#f4f5f7", padding: 24, maxWidth: 1120 }}><MonthlyReport leads={ls} stages={st} dealTransactions={[]} members={[{ user_id: "u0", role: "owner", display_name: "Owner BSB" }, { user_id: "u1", role: "sales_rep", display_name: "Asifa" }, { user_id: "u2", role: "sales_rep", display_name: "Budi" }, { user_id: "u3", role: "sales_rep", display_name: "Citra" }]} org={{ industry: "bsb_upvc", custom_field_labels: {} }} canEditTarget canImport canManage={role !== "sales_rep"} onChanged={noop} /></div>; })(),
  chat: <div style={{ background: "#f4f5f7", padding: 24, maxWidth: 640 }} className="space-y-4"><ChatInboundCard /><LeadConversation leadId="x" /></div>,
  addons: <div style={{ background: "#05070c", padding: 24 }}><AddonTokensPanel /></div>,
  orgfeatures: <div style={{ background: "#05070c", padding: 24 }}><OrgFeaturesPanel /></div>,
  quotation: <div id="modal-scroll" className="max-h-[85vh] overflow-y-auto overscroll-contain" style={{ background: "#05070c", padding: 24 }}><QuotationPanel users={[{ plan: "enterprise", org_name: "PT Queen Pacific", role: "owner", display_name: "Bu Lia", email: "lia@queenpacific.co.id" }, { plan: "enterprise", org_name: "PT Queen Pacific", role: "sales_rep" }]} /></div>,
  invoice: <div id="modal-scroll" className="max-h-[85vh] overflow-y-auto overscroll-contain" style={{ background: "#05070c", padding: 24 }}><EnterpriseInvoicePanel users={[{ plan: "enterprise", org_name: "PT Queen Pacific", role: "owner", display_name: "Bu Lia", email: "lia@queenpacific.co.id" }, { plan: "enterprise", org_name: "PT Queen Pacific", role: "sales_rep" }, { plan: "free", org_name: "Org Free", role: "owner" }, { plan: "professional", org_name: "CV Maju Jaya", role: "owner", display_name: "Pak Budi", email: "budi@majujaya.id" }]} /></div>,
  aicost: <div style={{ background: "#05070c", padding: 24 }}><AiCostPanel data={{ kurs: 17700, totals: { by_plan: [{ plan: "standard", accounts: 1, active_accounts: 0, tokens_all: 0, usd_all: 0, tokens_month: 0, usd_month: 0 }, { plan: "enterprise", accounts: 2, active_accounts: 2, tokens_all: 1963610, usd_all: 5.9, tokens_month: 1963610, usd_month: 5.9 }], other: { tokens_all: 4200, usd_all: 0.0077, tokens_month: 4200, usd_month: 0.0077 } }, tracking_since: "2026-10-06T11:00:00Z", accounts: [
    { user_id: "a1", email: "lia@queenpacific.co.id", display_name: "Bu Lia", org_name: "PT Queen Pacific", role: "owner", plan: "enterprise", period_start: "2026-10-06T17:00:00Z", period_end: "2026-11-06T17:00:00Z", period_source: "plan", tokens: 1843210, cost_rp: 96400, cost_usd: 5.4463, est_used_rp: 187300, est_max_rp: 213955, pct_of_limit: 87.5, features: [
      { key: "generate-leads", label: "Generate Leads", used: 4, limit: 4, pct: 100, tokens: 1422000, cost_rp: 68100, cost_usd: 3.8475 },
      { key: "quick-progress-note", label: "NEX Pro", used: 140, limit: 150, pct: 93, tokens: 380000, cost_rp: 24100, cost_usd: 1.3616 },
      { key: "daily-digest", label: "AI Advisor (otomatis)", used: 3, limit: 22, pct: 14, tokens: 41210, cost_rp: 4200, cost_usd: 0.2373 },
      { key: "customer-chat", label: "Chat Bantuan", used: 0, limit: null, tokens: 0, cost_rp: 0, cost_usd: 0.0000 } ] },
    { user_id: "a2", email: "budi@queenpacific.co.id", display_name: null, org_name: "PT Queen Pacific", role: "sales_rep", plan: "enterprise", period_start: "2026-10-06T17:00:00Z", period_end: "2026-11-06T17:00:00Z", period_source: "plan", tokens: 120400, cost_rp: 8800, cost_usd: 0.4972, est_used_rp: 60000, est_max_rp: 213955, pct_of_limit: 28, features: [
      { key: "lead-from-url", label: "Lead dari Link", used: 6, limit: 10, pct: 60, tokens: 120400, cost_rp: 8800, cost_usd: 0.4972 } ] },
    { user_id: "a3", email: "rina@majujaya.id", display_name: "Rina", org_name: "CV Maju Jaya", role: "owner", plan: "standard", period_start: "2026-09-24T02:10:00Z", period_end: "2026-10-24T02:10:00Z", period_source: "plan", tokens: 0, cost_rp: 0, cost_usd: 0.0000, est_used_rp: 110, est_max_rp: 53955, pct_of_limit: 0.2, features: [] } ] }} /></div>,
  leadmodal: <LeadModal lead={leads[0]} stages={stages} settings={{}} industry={ind} myLevel={myLevel} onClose={noop} onSaved={noop} canManage={canManage} isEnterprise={ent} members={window.__M.members} myUid="u1" />,
  leadmodal_weird: <LeadModal lead={weird} stages={stages} settings={{}} industry={ind} myLevel={myLevel} onClose={noop} onSaved={noop} canManage={canManage} isEnterprise={ent} members={window.__M.members} myUid="u1" />,
};
const errors = [];
window.addEventListener("error", (e) => errors.push("window: " + (e.error?.message || e.message)));
window.addEventListener("unhandledrejection", (e) => errors.push("promise: " + (e.reason?.message || e.reason)));
class B extends Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  componentDidCatch(e, info) { errors.push("RENDER: " + e.message + " @" + String(info.componentStack).trim().split("\n")[0]); }
  render() { return this.state.e ? <div id="crashed">CRASH</div> : this.props.children; }
}
createRoot(document.getElementById("root")).render(<B><Suspense fallback={null}>{views[tab]}</Suspense></B>);
window.__done = () => ({ errors, textLen: document.body.innerText.length });
