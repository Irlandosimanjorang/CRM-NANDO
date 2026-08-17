import { supabase } from "./supabaseClient";

// ---- STAGES ----
export async function getStages() {
  const { data, error } = await supabase.from("stages").select("*").order("position");
  if (error) throw error;
  return data;
}
export async function saveStages(stages) {
  // hapus semua lalu insert ulang (simpel utk prototype-migrasi)
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
    visit_date: lead.visit_date || null, visit_meet: lead.visit_meet || "", visit_agenda: lead.visit_agenda || "",
    deal_date: lead.deal_date || null, deal_value: lead.deal_value || 0, tonnage: lead.tonnage || 0,
    last_contact: lead.last_contact || null, verified: !!lead.verified, source: lead.source || "manual",
  };
  if (lead.id) {
    const { data, error } = await supabase.from("leads").update(row).eq("id", lead.id).select().single();
    if (error) throw error; return data;
  }
  const { data, error } = await supabase.from("leads").insert(row).select().single();
  if (error) throw error; return data;
}

export async function deleteLead(id) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function setLeadStage(id, stage_key) {
  const { error } = await supabase.from("leads").update({ stage_key }).eq("id", id);
  if (error) throw error;
}

// ---- PROGRESS ----
export async function addProgress(lead_id, text) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const date = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("progress_notes").insert({ user_id: uid, lead_id, note_date: date, text }).select().single();
  if (error) throw error;
  await supabase.from("leads").update({ last_contact: date }).eq("id", lead_id);
  return { id: data.id, date, text };
}
export async function deleteProgress(id) {
  await supabase.from("progress_notes").delete().eq("id", id);
}

// ---- BULK IMPORT (dipakai importer Excel & migrasi dari prototype) ----
export async function bulkInsertLeads(leads) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const rows = leads.map((l) => ({ user_id: uid, ...l }));
  const { data, error } = await supabase.from("leads").insert(rows).select("id, name");
  if (error) throw error;
  return data;
}

// ---- COMPETITORS ----
export async function getCompetitors() {
  const { data, error } = await supabase
    .from("competitors")
    .select("*, competitor_usages(id, company, product, price, quantity)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((c) => ({ ...c, usages: c.competitor_usages || [] }));
}
export async function upsertCompetitor(comp) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const row = { user_id: uid, name: comp.name, background: comp.background || "", product: comp.product || "", notes: comp.notes || "" };
  let compId = comp.id;
  if (compId) { const { error } = await supabase.from("competitors").update(row).eq("id", compId); if (error) throw error; }
  else { const { data, error } = await supabase.from("competitors").insert(row).select("id").single(); if (error) throw error; compId = data.id; }
  await supabase.from("competitor_usages").delete().eq("competitor_id", compId);
  const usages = (comp.usages || []).filter((u) => u.company || u.product || u.price || u.quantity);
  if (usages.length) {
    const rows = usages.map((u) => ({ user_id: uid, competitor_id: compId, company: u.company || "", product: u.product || "", price: u.price || "", quantity: u.quantity || "" }));
    const { error } = await supabase.from("competitor_usages").insert(rows); if (error) throw error;
  }
  return compId;
}
export async function deleteCompetitor(id) {
  const { error } = await supabase.from("competitors").delete().eq("id", id);
  if (error) throw error;
}

// ---- ADVISOR (histori rekomendasi harian, tersimpan 7 hari) ----
export async function getAdvisorHistory() {
  const { data, error } = await supabase.from("advisor_runs").select("*").order("run_date", { ascending: false }).limit(7);
  if (error) throw error;
  return data || [];
}

// ---- BACKUP / EXPORT SEMUA DATA ----
export async function exportAllData() {
  const [leadsRes, compRes, stagesRes, settingsRes, advisorRes] = await Promise.all([
    supabase.from("leads").select("*, progress_notes(id, note_date, text)"),
    supabase.from("competitors").select("*, competitor_usages(id, company, product, price, quantity)"),
    supabase.from("stages").select("*").order("position"),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("advisor_runs").select("*").order("run_date", { ascending: false }),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (compRes.error) throw compRes.error;
  if (stagesRes.error) throw stagesRes.error;
  return {
    exported_at: new Date().toISOString(),
    app: "Corong CRM",
    leads: leadsRes.data || [],
    competitors: compRes.data || [],
    stages: stagesRes.data || [],
    settings: settingsRes.data || null,
    advisor_history: advisorRes.data || [],
  };
}
