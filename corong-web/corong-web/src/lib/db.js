import { supabase } from "./supabaseClient";

// ---- STAGES ----
export async function getStages() {
  const { data, error } = await supabase.from("stages").select("*").order("position");
  if (error) throw error;
  return data;
}
export async function saveStages(stages) {
  const { data: rows } = await supabase.from("stages").select("id");
  if (rows?.length) await supabase.from("stages").delete().in("id", rows.map((r) => r.id));
  const uid = (await supabase.auth.getUser()).data.user.id;
  const payload = stages.map((s, i) => ({ user_id: uid, key: s.key, label: s.label, hex: s.hex, type: s.type, position: i }));
  const { error } = await supabase.from("stages").insert(payload);
  if (error) throw error;
}

// ---- SETTINGS ----
export async function getSettings() {
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  return data || { sales_names: [] };
}
export async function saveSalesNames(names) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("settings").upsert({ user_id: uid, sales_names: names, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---- LEADS ----
export async function getLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*, progress_notes(id, note_date, text)")
    .is("deleted_at", null)
    .order("last_contact", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((l) => ({
    ...l,
    progressLog: (l.progress_notes || [])
      .sort((a, b) => (a.note_date < b.note_date ? 1 : -1))
      .map((p) => ({ id: p.id, date: p.note_date, text: p.text })),
  }));
}

export async function upsertLead(lead) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const row = {
    user_id: uid,
    name: lead.name, category: lead.category, stage_key: lead.stage_key,
    company_type: lead.company_type || "", email: lead.email || "", phone: lead.phone || "",
    key_person: lead.key_person || "", key_person_title: lead.key_person_title || "",
    product: lead.product || "", city: lead.city || "", province: lead.province || "",
    website: lead.website || "", sales_owner: lead.sales_owner || "", background: lead.background || "",
    chemical: lead.chemical || "", priority: lead.priority || "", next_action: lead.next_action || "",
    tonnage_unit: lead.tonnage_unit ||
