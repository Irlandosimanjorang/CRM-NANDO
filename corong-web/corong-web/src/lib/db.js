import { supabase } from "./supabaseClient";

// Bersihin kolom telepon/WA: cuma boleh angka + karakter pemisah wajar (+, -, spasi,
// koma, slash, kurung). Nama/label kayak "Admin 1:" otomatis kebuang, sisa nomornya
// digabung dipisah koma. Dipake di semua jalur nulis lead (manual, import Excel).
function sanitizePhone(raw) {
  if (!raw) return "";
  const matches = String(raw).match(/(\+?\d[\d\-\s]{5,}\d)/g) || [];
  const cleaned = matches.map((m) => m.replace(/\s+/g, "").trim()).filter(Boolean);
  return cleaned.join(", ");
}

// ---- ORGANISASI ----
let cachedOrgId = null;
export async function getMyOrgId() {
  if (cachedOrgId) return cachedOrgId;
  const { data, error } = await supabase.rpc("ensure_my_org");
  if (error) throw error;
  cachedOrgId = data;
  return cachedOrgId;
}
export function clearOrgCache() { cachedOrgId = null; }

export async function getMyOrg() {
  const orgId = await getMyOrgId();
  const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  if (error) throw error;
  return data;
}

export async function getOrgMembers() {
  const orgId = await getMyOrgId();
  const { data, error } = await supabase.from("organization_members").select("*").eq("org_id", orgId);
  if (error) throw error;
  return data || [];
}

export async function createInviteCode(role = "sales_rep") {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60000).toISOString(); // 7 hari
  const { error } = await supabase.from("org_invite_codes").insert({ code, org_id: orgId, created_by: uid, role, expires_at: expires });
  if (error) throw error;
  return code;
}

export async function getPendingInviteCodes() {
  const orgId = await getMyOrgId();
  const { data, error } = await supabase
    .from("org_invite_codes")
    .select("*")
    .eq("org_id", orgId)
    .is("used_by", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function revokeInviteCode(code) {
  const { error } = await supabase.from("org_invite_codes").delete().eq("code", code);
  if (error) throw error;
}

export async function redeemInviteCode(code) {
  const { data, error } = await supabase.rpc("redeem_invite_code", { p_code: code });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  clearOrgCache();
  return data;
}

export async function removeMember(memberId) {
  const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
  if (error) throw error;
}

// Buat ANGGOTA (bukan Owner) keluar dari organisasi yang dia join - abis ini
// dia otomatis balik punya organisasi sendiri lagi (solo), bukan nyangkut kosong.
export async function leaveOrg() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("organization_members").delete().eq("user_id", uid);
  if (error) throw error;
  clearOrgCache();
  await getMyOrgId(); // langsung bikinin organisasi baru buat dia
}

// ---- PROFIL AKUN (avatar bulat pojok kanan atas) ----
export async function uploadAvatar(file) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveMyProfile({ avatar_url, job_title, name }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const patch = { user_id: uid, updated_at: new Date().toISOString() };
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  if (job_title !== undefined) patch.job_title = job_title;
  if (name !== undefined) patch.community_display_name = name;
  const { error } = await supabase.from("settings").upsert(patch);
  if (error) throw error;
}

// ---- GENERATE LEADS (AI cari calon lead lewat web search) ----
export async function generateLeads({ keyword, city } = {}) {
  const { data, error } = await supabase.functions.invoke("generate-leads", { body: { keyword, city } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getGeneratedLeads() {
  // Ambil SEMUA riwayat (bukan cuma yang pending) - biar tetep keliatan
  // walau udah diimport, gak ilang dari daftar.
  const { data, error } = await supabase.from("generated_leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLeadGenCooldown() {
  const orgId = await getMyOrgId();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("lead_gen_runs")
    .select("generated_at")
    .eq("org_id", orgId)
    .gte("generated_at", sevenDaysAgo)
    .order("generated_at", { ascending: true });
  if (error) throw error;
  const runs = data || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const usedToday = runs.some((r) => r.generated_at.slice(0, 10) === todayStr);
  const usedThisWeek = runs.length;
  let nextAvailableAt = null;
  if (usedToday) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    nextAvailableAt = tomorrow.toISOString();
  } else if (usedThisWeek >= 2) {
    nextAvailableAt = new Date(new Date(runs[0].generated_at).getTime() + 7 * 24 * 3600 * 1000).toISOString();
  }
  return { canGenerate: !usedToday && usedThisWeek < 2, usedThisWeek, nextAvailableAt };
}

export async function importGeneratedLead(genLead, defaultStageKey) {
  await upsertLead({
    name: genLead.name, category: "Lainnya", stage_key: defaultStageKey || "",
    key_person: genLead.key_person || "", key_person_title: genLead.key_person_title || "",
    website: genLead.website || "", phone: genLead.phone || "", city: genLead.city || "",
    product: genLead.product || "", source: "ai_generated",
  });
  const { error } = await supabase.from("generated_leads").update({ status: "imported" }).eq("id", genLead.id);
  if (error) throw error;
}

export async function dismissGeneratedLead(id) {
  const { error } = await supabase.from("generated_leads").update({ status: "dismissed" }).eq("id", id);
  if (error) throw error;
}

// ---- KIRIM EMAIL KE LEAD ----
export async function sendLeadEmail({ lead_id, to_email, to_name, subject, body, sender_name }) {
  const { data, error } = await supabase.functions.invoke("send-lead-email", { body: { lead_id, to_email, to_name, subject, body, sender_name } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

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
  const orgId = await getMyOrgId();
  const payload = stages.map((s, i) => ({ user_id: uid, org_id: orgId, key: s.key, label: s.label, hex: s.hex, type: s.type, position: i }));
  const { error } = await supabase.from("stages").insert(payload);
  if (error) throw error;
}

// ---- ONBOARDING AKUN BARU ----
// Dipanggil otomatis pas akun baru pertama kali login & belum punya pipeline
// sama sekali - biar gak "kosong melompong" abis daftar sendiri.
export async function initDefaultStages() {
  const { data: existing } = await supabase.from("stages").select("id").limit(1);
  if (existing && existing.length > 0) return; // udah ada isinya, jangan ditimpa
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const defaults = [
    { key: "prospek", label: "Prospek Baru", hex: "#94a3b8", type: "normal" },
    { key: "kontak", label: "Kontak Awal", hex: "#60a5fa", type: "normal" },
    { key: "presentasi", label: "Presentasi / Visit", hex: "#fbbf24", type: "normal" },
    { key: "negosiasi", label: "Negosiasi", hex: "#f97316", type: "normal" },
    { key: "deal", label: "Deal / Menang", hex: "#10b981", type: "won" },
    { key: "lost", label: "Lost", hex: "#f43f5e", type: "lost" },
  ];
  const payload = defaults.map((s, i) => ({ user_id: uid, org_id: orgId, key: s.key, label: s.label, hex: s.hex, type: s.type, position: i }));
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
  const orgId = await getMyOrgId();
  const row = {
    user_id: uid, org_id: orgId,
    // assigned_to = "pemilik" lead ini buat keperluan role-based visibility.
    // Lead baru: default ke diri sendiri. Lead yang udah ada: dipertahanin
    // apa adanya (gak ke-reset ke siapa aja yang lagi ngedit).
    assigned_to: lead.assigned_to || uid,
    name: lead.name, category: lead.category, stage_key: lead.stage_key,
    company_type: lead.company_type || "", email: lead.email || "", phone: sanitizePhone(lead.phone),
    key_person: lead.key_person || "", key_person_title: lead.key_person_title || "",
    product: lead.product || "", city: lead.city || "", province: lead.province || "",
    website: lead.website || "", sales_owner: lead.sales_owner || "", background: lead.background || "",
    chemical: lead.chemical || "", priority: lead.priority || "", next_action: lead.next_action || "",
    tonnage_unit: lead.tonnage_unit || "ton",
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
  const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function getDeletedLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function restoreLead(id) {
  const { error } = await supabase.from("leads").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export async function permanentlyDeleteLead(id) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function setLeadStage(id, stage_key) {
  const { error } = await supabase.from("leads").update({ stage_key }).eq("id", id);
  if (error) throw error;
}

export async function updateLeadNextAction(id, next_action) {
  const { error } = await supabase.from("leads").update({ next_action }).eq("id", id);
  if (error) throw error;
}

// ---- LOKASI GPS & CHECK-IN ----
export async function saveLeadLocation(id, latitude, longitude) {
  const { error } = await supabase.from("leads").update({ latitude, longitude }).eq("id", id);
  if (error) throw error;
}

export async function uploadCheckinPhoto(file) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${uid}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("checkin-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("checkin-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function checkIn({ lead_id, lead_name, latitude, longitude, distance_meters, photo_url }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const { data, error } = await supabase
    .from("visit_checkins")
    .insert({ user_id: uid, org_id: orgId, lead_id, lead_name, latitude, longitude, distance_meters, photo_url: photo_url || null })
    .select()
    .single();
  if (error) throw error;
  // Check-in juga otomatis nyatet progress + update last_contact, biar konsisten
  // sama alur progress note yang udah ada.
  const today = new Date().toISOString().slice(0, 10);
  const jarak = distance_meters != null ? `${Math.round(distance_meters)}m dari titik lokasi` : "";
  await supabase.from("progress_notes").insert({
    user_id: uid, org_id: orgId, lead_id, note_date: today,
    text: `Check-in GPS terverifikasi${jarak ? " (" + jarak + ")" : ""}${photo_url ? " + foto bukti" : ""}.`,
  });
  await supabase.from("leads").update({ last_contact: today }).eq("id", lead_id);
  return data;
}

export async function getTodayCheckedInLeadIds() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("visit_checkins")
    .select("lead_id")
    .gte("checked_in_at", `${today}T00:00:00`)
    .lt("checked_in_at", `${today}T23:59:59.999`);
  if (error) throw error;
  return (data || []).map((r) => r.lead_id);
}

export async function getCheckins(monthFilter) {
  let q = supabase.from("visit_checkins").select("*").order("checked_in_at", { ascending: false });
  if (monthFilter) {
    const start = `${monthFilter}-01`;
    const [y, m] = monthFilter.split("-").map(Number);
    const endDate = new Date(y, m, 1).toISOString().slice(0, 10);
    q = q.gte("checked_in_at", start).lt("checked_in_at", endDate);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ---- PROGRESS ----
export async function addProgress(lead_id, text) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const date = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("progress_notes").insert({ user_id: uid, org_id: orgId, lead_id, note_date: date, text }).select().single();
  if (error) throw error;
  await supabase.from("leads").update({ last_contact: date }).eq("id", lead_id);
  return { id: data.id, date, text };
}
export async function deleteProgress(id) {
  await supabase.from("progress_notes").delete().eq("id", id);
}
export async function updateProgress(id, text) {
  const { error } = await supabase.from("progress_notes").update({ text }).eq("id", id);
  if (error) throw error;
}

// ---- REKAM MEETING ----
export async function uploadMeetingAudio(leadId, blob) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const path = `${uid}/${leadId}-${Date.now()}.webm`;
  const { error } = await supabase.storage.from("meeting-audio").upload(path, blob, { contentType: blob.type || "audio/webm" });
  if (error) throw error;
  return path;
}

export async function transcribeMeeting(storagePath, leadName) {
  const { data, error } = await supabase.functions.invoke("transcribe-meeting", { body: { storagePath, leadName } });
  if (error) throw error;
  return data; // { transcript, notes }
}

// ---- DEAL TRANSAKSI (1 perusahaan bisa banyak transaksi/repeat order) ----
export async function getDealTransactions() {
  const { data, error } = await supabase.from("deal_transactions").select("*").order("deal_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addDealTransaction({ lead_id, lead_name, deal_date, deal_value, tonnage, tonnage_unit, chemical }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const { data, error } = await supabase.from("deal_transactions").insert({
    user_id: uid, org_id: orgId, lead_id, lead_name, deal_date: deal_date || null,
    deal_value: Number(deal_value) || 0, tonnage: Number(tonnage) || 0,
    tonnage_unit: tonnage_unit || "ton", chemical: chemical || "",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDealTransaction(id) {
  const { error } = await supabase.from("deal_transactions").delete().eq("id", id);
  if (error) throw error;
}

// ---- SMART IMPORT (AI baca layout Excel yang formatnya ga standar) ----
export async function smartImportMap(sampleRows) {
  const { data, error } = await supabase.functions.invoke("smart-import-map-ts", { body: { sampleRows } });
  if (error) throw error;
  return data;
}

// ---- BULK IMPORT ----
export async function bulkInsertLeads(leads) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const rows = leads.map((l) => ({ user_id: uid, org_id: orgId, assigned_to: l.assigned_to || uid, ...l, phone: sanitizePhone(l.phone) }));
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
  const orgId = await getMyOrgId();
  const row = { user_id: uid, org_id: orgId, name: comp.name, background: comp.background || "", product: comp.product || "", notes: comp.notes || "" };
  let compId = comp.id;
  if (compId) { const { error } = await supabase.from("competitors").update(row).eq("id", compId); if (error) throw error; }
  else { const { data, error } = await supabase.from("competitors").insert(row).select("id").single(); if (error) throw error; compId = data.id; }
  await supabase.from("competitor_usages").delete().eq("competitor_id", compId);
  const usages = (comp.usages || []).filter((u) => u.company || u.product || u.price || u.quantity);
  if (usages.length) {
    const rows = usages.map((u) => ({ user_id: uid, org_id: orgId, competitor_id: compId, company: u.company || "", product: u.product || "", price: u.price || "", quantity: u.quantity || "" }));
    const { error } = await supabase.from("competitor_usages").insert(rows); if (error) throw error;
  }
  return compId;
}
export async function deleteCompetitor(id) {
  const { error } = await supabase.from("competitors").delete().eq("id", id);
  if (error) throw error;
}

// ---- ADVISOR ----
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
    app: "Nexto",
    leads: leadsRes.data || [],
    competitors: compRes.data || [],
    stages: stagesRes.data || [],
    settings: settingsRes.data || null,
    advisor_history: advisorRes.data || [],
  };
}

// ---- MERGE LEADS ----
const MERGE_FILLABLE_FIELDS = [
  "category", "company_type", "email", "phone", "key_person", "key_person_title",
  "product", "city", "province", "website", "sales_owner", "background", "chemical",
  "priority", "next_action", "visit_date", "visit_meet", "visit_agenda",
  "deal_date", "deal_value", "tonnage", "tonnage_unit", "last_contact", "verified", "source",
];
export function computeMergeFill(keepLead, mergeLead) {
  const fill = {};
  for (const f of MERGE_FILLABLE_FIELDS) {
    const kv = keepLead[f]; const mv = mergeLead[f];
    const kEmpty = kv === null || kv === undefined || kv === "" || kv === 0 || kv === false;
    const mHas = mv !== null && mv !== undefined && mv !== "" && mv !== 0 && mv !== false;
    if (kEmpty && mHas) fill[f] = mv;
  }
  return fill;
}
export async function mergeLeads(keepId, mergeId, fillFields) {
  if (fillFields && Object.keys(fillFields).length) {
    const { error } = await supabase.from("leads").update(fillFields).eq("id", keepId);
    if (error) throw error;
  }
  const { error: moveErr } = await supabase.from("progress_notes").update({ lead_id: keepId }).eq("lead_id", mergeId);
  if (moveErr) throw moveErr;
  const { error: delErr } = await supabase.from("leads").delete().eq("id", mergeId);
  if (delErr) throw delErr;
}

// ---- TELEGRAM LINK ----
export async function generateTelegramCode() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60000).toISOString();
  const { error } = await supabase.from("link_codes").insert({ code, user_id: uid, expires_at: expires });
  if (error) throw error;
  return code;
}
export async function getTelegramLink() {
  const { data } = await supabase.from("telegram_links").select("*").maybeSingle();
  return data || null;
}
export async function unlinkTelegram() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("telegram_links").delete().eq("user_id", uid);
  if (error) throw error;
}

// ---- GOOGLE CALENDAR LINK ----
const GOOGLE_CLIENT_ID = "351973989384-gss200qb94ofeg27dnig8uof3rufikqo.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/google-oauth-callback";

export async function getGoogleCalendarLink() {
  const { data } = await supabase.from("google_calendar_links").select("*").maybeSingle();
  return data || null;
}

export async function connectGoogleCalendar() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const state = crypto.randomUUID();
  const expires = new Date(Date.now() + 10 * 60000).toISOString();
  const { error } = await supabase.from("google_oauth_states").insert({ state, user_id: uid, expires_at: expires });
  if (error) throw error;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function disconnectGoogleCalendar() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("google_calendar_links").delete().eq("user_id", uid);
  if (error) throw error;
}

// ---- BULK SYNC CALENDAR ----
export async function bulkSyncCalendar() {
  const { data, error } = await supabase.functions.invoke("sync-calendar-bulk");
  if (error) throw error;
  return data;
}

// ---- CHAT ASISTEN ----
export async function sendChatMessage(message) {
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: { message } });
  if (error) throw error;
  return data.reply;
}

export async function getChatHistory() {
  const { data, error } = await supabase.from("chat_messages").select("role, content, created_at").order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

// ---- NEX (komunitas gaya sosmed) ----
export async function getCommunityDisplayName() {
  const s = await getSettings();
  return s.community_display_name || "";
}
export async function saveCommunityDisplayName(name) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("settings").upsert({ user_id: uid, community_display_name: name, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getCommunityProfile() {
  const s = await getSettings();
  return { name: s.community_display_name || "", bio: s.community_bio || "" };
}
export async function saveCommunityProfile({ name, bio }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from("settings").upsert({ user_id: uid, community_display_name: name, community_bio: bio, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function uploadCommunityImage(file) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("community-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("community-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function getCommunityPosts() {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase
    .from("community_posts")
    .select("*, community_replies(id), community_likes(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    replyCount: (p.community_replies || []).length,
    likeCount: (p.community_likes || []).length,
    likedByMe: (p.community_likes || []).some((l) => l.user_id === uid),
  }));
}

export async function createCommunityPost({ body, imageUrls }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const displayName = (await getCommunityDisplayName()) || "User Nexto";
  const { data, error } = await supabase.from("community_posts").insert({
    user_id: uid, author_name: displayName, body: body || "", image_urls: imageUrls || [],
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCommunityPost(id) {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleCommunityLike(postId, liked) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  if (liked) {
    const { error } = await supabase.from("community_likes").insert({ post_id: postId, user_id: uid });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", uid);
    if (error) throw error;
  }
}

export async function incrementCommunityShare(postId) {
  const { error } = await supabase.rpc("increment_share_count", { p_post_id: postId });
  if (error) throw error;
}

export async function getReplies(postId) {
  const { data, error } = await supabase.from("community_replies").select("*").eq("post_id", postId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addReply(postId, body) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const displayName = (await getCommunityDisplayName()) || "User Nexto";
  const { data, error } = await supabase.from("community_replies").insert({ post_id: postId, user_id: uid, author_name: displayName, body }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReply(id) {
  const { error } = await supabase.from("community_replies").delete().eq("id", id);
  if (error) throw error;
}

export async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// ---- DATA CLEANUP ----
export async function getSuggestedCategories() {
  const { data, error } = await supabase.functions.invoke("suggest-categories");
  if (error) throw error;
  return data.suggestions || [];
}

export async function bulkUpdateCategory(updates) {
  for (const u of updates) {
    await supabase.from("leads").update({ category: u.suggested }).eq("id", u.id);
  }
}

export async function bulkMarkLost(leadIds, lostStageKey) {
  await supabase.from("leads").update({ stage_key: lostStageKey }).in("id", leadIds);
}
