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
