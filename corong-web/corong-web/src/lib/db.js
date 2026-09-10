import { supabase } from "./supabaseClient";
import { getIndustryTemplate } from "./industryTemplates";

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

// Simpen pilihan industri org (dipilih sekali pas onboarding lewat IndustryPicker,
// nentuin template pipeline default + label field yang dipake di seluruh CRM).
export async function setOrgIndustry(industryKey) {
  const orgId = await getMyOrgId();
  const { error } = await supabase.from("organizations").update({ industry: industryKey }).eq("id", orgId);
  if (error) throw error;
}

// ---- MODE DEMO INDUSTRI (khusus admin platform) ----
// Beda dari setOrgIndustry biasa (yang cuma dipake SEKALI pas onboarding),
// fungsi ini boleh dipanggil BERKALI-KALI - buat Nando nunjukin "framework"
// tiap industri pas lagi pitching ke calon klien. Selain ganti industry,
// pipeline stages-nya juga ikut di-RESET total sesuai template industri baru
// (bukan cuma label field yang berubah) - biar keliatan strukturnya beneran,
// bukan cuma kosmetik doang.
export async function switchDemoIndustry(industryKey) {
  const orgId = await getMyOrgId();
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error: orgErr } = await supabase.from("organizations").update({ industry: industryKey }).eq("id", orgId);
  if (orgErr) throw orgErr;

  const tpl = getIndustryTemplate(industryKey);
  const { data: rows } = await supabase.from("stages").select("id");
  if (rows?.length) await supabase.from("stages").delete().in("id", rows.map((r) => r.id));
  const payload = tpl.stages.map((s, i) => ({ user_id: uid, org_id: orgId, key: s.key, label: s.label, hex: s.hex, type: s.type, position: i }));
  const { error: stagesErr } = await supabase.from("stages").insert(payload);
  if (stagesErr) throw stagesErr;
}

// Lewat edge function (service role) - bukan cuma query settings.
// community_display_name doang, tapi FALLBACK ke email anggota kalau
// mereka belum pernah ngisi nama profil (misal join lewat kode invite
// tanpa lewat wizard signup lengkap). Client biasa gak bisa baca email
// anggota LAIN (RLS gak ngasih akses ke auth.users), makanya butuh
// service role - sebelumnya nama yang "belum diisi" jatuh ke potongan
// UUID mentah ("Anggota 45dadf81") yang gak kebaca sama sekali.
export async function getOrgMembers() {
  const { data, error } = await supabase.functions.invoke("get-org-members");
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || [];
}

export async function createInviteCode(role = "sales_rep") {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const expires = new Date(Date.now() + 60 * 60000).toISOString(); // 1 jam
  const { error } = await supabase.from("org_invite_codes").insert({ code, org_id: orgId, created_by: uid, role, expires_at: expires });
  if (error) throw error;
  return { code, expires_at: expires };
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

export async function getMyRole() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase.from("organization_members").select("role").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data?.role || null;
}

// ---- APPROVAL GATE (Enterprise) - sales_rep butuh persetujuan owner/manager
// buat hapus lead atau export data, biar data tim gak bisa dibawa kabur atau
// dihapus sepihak tanpa sepengetahuan owner. ----
export async function requestApproval(action_type, payload = {}) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const { data, error } = await supabase
    .from("approval_requests")
    .insert({ org_id: orgId, requested_by: uid, action_type, payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Request approval PALING BARU milik user ini sendiri buat 1 jenis aksi -
// dipake sales_rep buat ngecek "request gua udah di-approve belum".
export async function getMyLatestApproval(action_type) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("requested_by", uid)
    .eq("action_type", action_type)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function markApprovalUsed(id) {
  const { error } = await supabase.from("approval_requests").update({ status: "used" }).eq("id", id);
  if (error) throw error;
}

// Buat owner/manager - daftar request yang masih nunggu keputusan di org-nya.
export async function getPendingApprovals() {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return rows;
  const userIds = [...new Set(rows.map((r) => r.requested_by))];
  const { data: settingsRows } = await supabase.from("settings").select("user_id, community_display_name").in("user_id", userIds);
  const nameByUid = {};
  for (const s of settingsRows || []) nameByUid[s.user_id] = s.community_display_name;
  return rows.map((r) => ({ ...r, requester_name: nameByUid[r.requested_by] || null }));
}

export async function decideApproval(id, approve) {
  const { data: reqRow, error: fErr } = await supabase.from("approval_requests").select("*").eq("id", id).single();
  if (fErr) throw fErr;
  if (approve && reqRow.action_type === "delete_lead" && reqRow.payload?.lead_id) {
    await deleteLead(reqRow.payload.lead_id);
  }
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase
    .from("approval_requests")
    .update({ status: approve ? "approved" : "denied", decided_by: uid, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function removeMember(memberId) {
  const { data: member, error: mErr } = await supabase
    .from("organization_members")
    .select("user_id, org_id")
    .eq("id", memberId)
    .single();
  if (mErr) throw mErr;

  // Leads yang tadinya assigned_to anggota ini dibalikin ke OWNER org, biar
  // gak nyangkut nunjuk ke uid yang udah gak ada di tim lagi begitu dia
  // dikeluarin (datanya sendiri aman - RLS owner tetep liat semua lead - tapi
  // gak ada satu pun sales rep aktif yang "pegang" lead itu lagi kalau
  // dibiarin nunjuk ke mantan anggota).
  const { data: org, error: oErr } = await supabase
    .from("organizations")
    .select("owner_user_id")
    .eq("id", member.org_id)
    .single();
  if (oErr) throw oErr;

  if (org?.owner_user_id && org.owner_user_id !== member.user_id) {
    const { error: reassignErr } = await supabase
      .from("leads")
      .update({ assigned_to: org.owner_user_id })
      .eq("org_id", member.org_id)
      .eq("assigned_to", member.user_id);
    if (reassignErr) throw reassignErr;
  }

  const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
  if (error) throw error;
}

// Naikin/turunin role anggota (sales_rep <-> manager) - dulu gak ada satupun
// cara buat bikin "manager" beneran (invite selalu hardcode sales_rep, dan
// gak ada policy UPDATE di organization_members sama sekali), padahal
// approval-gate & RLS leads udah lama nyebut "owner/manager" berkali-kali.
export async function updateMemberRole(memberId, role) {
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", memberId);
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
// Validasi SEBELUM upload - biar user dapet pesan error yang jelas & gak
// buang-buang bandwidth upload file yang bakal ditolak. CATATAN: ini validasi
// sisi klien (bisa di-skip orang yang manggil API langsung), jadi proteksi
// SEBENERNYA harus di-set juga di level Storage bucket Supabase (Dashboard ->
// Storage -> bucket "avatars" -> Settings -> allowed MIME types & max file size).
const AVATAR_MAX_SIZE_MB = 5;
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadAvatar(file) {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Format file harus JPG, PNG, WEBP, atau GIF ya.");
  }
  if (file.size > AVATAR_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Ukuran file maksimal ${AVATAR_MAX_SIZE_MB}MB (file Anda ${(file.size / 1024 / 1024).toFixed(1)}MB).`);
  }
  const uid = (await supabase.auth.getUser()).data.user.id;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveMyProfile({ avatar_url, job_title, name, whatsapp }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const patch = { user_id: uid, updated_at: new Date().toISOString() };
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  if (job_title !== undefined) patch.job_title = job_title;
  if (name !== undefined) patch.community_display_name = name;
  if (whatsapp !== undefined) patch.whatsapp = whatsapp;
  const { error } = await supabase.from("settings").upsert(patch);
  if (error) throw error;
}

// Ganti nama organisasi (dipake sekali pas isi form daftar - "Nama
// Perusahaan" - biar gak nyangkut nama default "Organisasi Saya" terus).
export async function setOrgName(name) {
  const orgId = await getMyOrgId();
  const { error } = await supabase.from("organizations").update({ name }).eq("id", orgId);
  if (error) throw error;
}

// Nambahin/nge-update nama slot custom_field_1..5 punya org - dipake pas user
// klik "+ Custom..." di ManualColumnMapModal buat namain kolom Excel yang gak
// ada padanannya di field bawaan (misal "Production Lines"). MERGE ke label
// yang udah ada (bukan replace total), biar slot lain yang udah dinamain
// sebelumnya (dari import lain atau template industri) gak ke-reset.
export async function mergeCustomFieldLabels(newLabels) {
  const orgId = await getMyOrgId();
  const { data: orgRow, error: getErr } = await supabase.from("organizations").select("custom_field_labels").eq("id", orgId).single();
  if (getErr) throw getErr;
  const merged = { ...(orgRow?.custom_field_labels || {}), ...newLabels };
  const { error } = await supabase.from("organizations").update({ custom_field_labels: merged }).eq("id", orgId);
  if (error) throw error;
  return merged;
}

// ---- GENERATE LEADS (AI cari calon lead lewat web search) ----
export async function generateLeads({ keyword, province, targetRole, productSold, companyScale } = {}) {
  const { data, error } = await supabase.functions.invoke("generate-leads", { body: { keyword, province, targetRole, productSold, companyScale } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getGeneratedLeads() {
  // Ambil SEMUA riwayat (bukan cuma yang pending) - biar tetep keliatan
  // walau udah diimport, gak ilang dari daftar.
  // Urutan: batch generate TERBARU dulu (run_started_at desc), dan DI DALAM
  // tiap batch, urut score TERTINGGI ke terendah - jadi gak campur aduk
  // antar generate dan gak perlu di-sort manual lagi di frontend.
  const { data, error } = await supabase
    .from("generated_leads")
    .select("*")
    .order("run_started_at", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false });
  if (error) throw error;
  return data || [];
}

// QUOTA FIX (8 Sep 2026): sebelumnya ini ngitung "1x/minggu" (malah ada sisa
// logic "2x/minggu" yang lebih tua lagi) - gak nyambung sama backend
// (generate-leads edge function) yang udah lama diubah jadi 4x/BULAN
// kalender WIB. Sekarang dihitung sama persis kayak backend: awal bulan
// kalender WIB, maks 4x, biar counter "X/4 bulan ini" di UI gak bohong.
const GEN_LEADS_QUOTA_MAX = 4;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}
function wibNextMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0) - WIB_OFFSET_MS);
}
export async function getLeadGenCooldown() {
  const orgId = await getMyOrgId();
  const monthStart = wibMonthStartUTC().toISOString();
  const { data, error } = await supabase
    .from("lead_gen_runs")
    .select("generated_at")
    .eq("org_id", orgId)
    .gte("generated_at", monthStart)
    .order("generated_at", { ascending: true });
  if (error) throw error;
  const runs = data || [];
  const usedThisMonth = runs.length;
  const canGenerate = usedThisMonth < GEN_LEADS_QUOTA_MAX;
  const nextAvailableAt = canGenerate ? null : wibNextMonthStartUTC().toISOString();
  return { canGenerate, usedThisMonth, quotaMax: GEN_LEADS_QUOTA_MAX, nextAvailableAt };
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

// ---- KIRIM EMAIL KE LEAD ----
export async function sendLeadEmail({ lead_id, to_email, to_name, subject, body, sender_name }) {
  const { data, error } = await supabase.functions.invoke("send-lead-email", { body: { lead_id, to_email, to_name, subject, body, sender_name } });
  if (error) {
    // supabase.functions.invoke() ngasih pesan generik doang kalau function-nya
    // return status non-2xx - alasan ASLI-nya (dari body JSON yang kita kirim)
    // ada di error.context (Response object), harus dibaca manual.
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) { /* biarin null, pake fallback di bawah */ }
    throw new Error(specificMsg || error.message || "Gagal kirim email");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// AI bikinin draft pesan follow-up personal berdasar histori lead - dipanggil
// ON-DEMAND doang (pas user klik tombol "Draft WhatsApp"/"Draft Email"), gak
// otomatis, jadi biaya AI cuma kejadi pas beneran dipake.
export async function draftFollowup(leadId, channel) {
  const { data, error } = await supabase.functions.invoke("draft-followup", { body: { lead_id: leadId, channel } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal bikin draft");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---- HAPUS AKUN SENDIRI - self-service dari tab Pengaturan (sebelumnya gak
// ada fitur ini sama sekali, satu-satunya cara hapus akun minta admin
// jalanin SQL manual). Perilaku beda tergantung role - lihat komentar di
// edge function delete-my-account: owner = seluruh organisasi ikut kehapus
// (ditolak kalau masih ada anggota lain), role lain = cukup keluar dari tim. ----
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke("delete-my-account");
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal hapus akun");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---- DASHBOARD ADMIN - status "karyawan AI" (health-check, daily-digest,
// bot Telegram, dst) buat SELURUH platform. Cuma bisa dipanggil sama admin
// (dicek server-side di Edge Function-nya, bukan cuma disembunyiin di UI). ----
export async function getAdminStatus() {
  const { data, error } = await supabase.functions.invoke("admin-status");
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal ambil status admin");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function callAdminTrigger(target) {
  const { data, error } = await supabase.functions.invoke("admin-trigger", { body: { target } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal manggil function");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Kirim 1 pesan ke widget chat publik landing page (karyawan AI SASA -
// Customer Support). Dipanggil TANPA login (visitor anonim) - beda dari
// fungsi lain di file ini yang butuh sesi user, makanya invoke-nya polos
// tanpa perlu Authorization header khusus (customer-chat verify_jwt: false).
export async function sendSupportChatMessage(sessionId, message) {
  const { data, error } = await supabase.functions.invoke("customer-chat", { body: { sessionId, message } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal kirim pesan");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Approve/reject 1 draft konten NOVA (Marketing & Content) - "approve" bikin
// function-nya LANGSUNG coba publish ke Instagram (kalau kredensial IG udah
// di-set), "reject" cuma nandain gak dipake. Satu-satunya titik di mana
// konten NOVA beneran bisa tayang ke publik - gak ada jalur otomatis lain.
export async function reviewContentDraft(draftId, action) {
  const { data, error } = await supabase.functions.invoke("content-action", { body: { draftId, action } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal proses draft");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Tandain 1 sinyal ATOM buat ditindaklanjuti - CUMA nyatet + notif Telegram,
// BUKAN eksekusi perbaikan otomatis (lihat komentar di edge function-nya).
export async function flagHealthIssue(check_key, label, detail) {
  const { data, error } = await supabase.functions.invoke("flag-health-issue", { body: { check_key, label, detail } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal nandain sinyal");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---- OUTCOME MEMORY - dicatet pas lead ditutup Menang/Kalah, dipake AI
// Advisor besok-besok buat belajar pola "apa yang biasanya berhasil/gagal"
// di bisnis org ini (nutup loop Context->Decision->Action->Memory->Decision). ----
export async function saveOutcome(leadId, { result, reason_category, reason, ai_generated }) {
  const outcome = { result, reason_category: reason_category || "", reason: reason || "", ai_generated: !!ai_generated, recorded_at: new Date().toISOString() };
  const { error } = await supabase.from("leads").update({ outcome }).eq("id", leadId);
  if (error) throw error;
  return outcome;
}

// AI nebak alasan menang/kalah dari progress notes - on-demand, cuma jalan
// pas user klik tombolnya (biar males isi manual bisa tetep kecatet).
export async function guessOutcomeReason(leadId, result) {
  const { data, error } = await supabase.functions.invoke("guess-outcome-reason", { body: { lead_id: leadId, result } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal nebak alasan");
  }
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
// Pipeline yang di-seed ngikutin template industri yang udah dipilih org
// (org.industry, diisi lewat IndustryPicker) - fallback ke PVC/Kimia kalau
// entah kenapa belum ada (org lama sebelum fitur ini ada).
export async function initDefaultStages() {
  const { data: existing } = await supabase.from("stages").select("id").limit(1);
  if (existing && existing.length > 0) return; // udah ada isinya, jangan ditimpa
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const org = await getMyOrg().catch(() => null);
  const tpl = getIndustryTemplate(org?.industry);
  const payload = tpl.stages.map((s, i) => ({ user_id: uid, org_id: orgId, key: s.key, label: s.label, hex: s.hex, type: s.type, position: i }));
  const { error } = await supabase.from("stages").insert(payload);
  if (error) throw error;
}

// ---- SETTINGS ----
export async function getSettings() {
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  return data || {};
}

// ---- LEADS ----
// BUG FIX (9 Sep 2026): sebelumnya .range(0, 9999) - kalau org-nya kelak
// punya lebih dari 10rb lead, sisanya kepotong DIAM-DIAM (bukan error, cuma
// gak keambil) - bug korupsi data yang gak ketauan sampe ada yang nanya "kok
// lead gua ilang". Sekarang loop ambil per 1000 baris sampe abis, gak ada
// batas atas lagi.
export async function getLeads() {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("*, progress_notes(id, note_date, text)")
      .is("deleted_at", null)
      .order("last_contact", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allRows = allRows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows.map((l) => ({
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
    // Tanggal terstruktur "diminta nunggu sampai" - beda dari next_action (teks
    // bebas). Dipake reminder/AI Advisor buat DIEM dulu sampai tanggal ini lewat,
    // biar gak nge-nudge lead yang customernya udah eksplisit minta waktu.
    wait_until: lead.wait_until || null,
    tonnage_unit: lead.tonnage_unit || "ton",
    // 5 slot field bebas - namanya ditentuin per industri (lihat customFieldLabels
    // di industryTemplates.js), kolom fisiknya generic biar gak perlu migrasi tiap
    // ada industri baru.
    custom_field_1: lead.custom_field_1 || "", custom_field_2: lead.custom_field_2 || "", custom_field_3: lead.custom_field_3 || "",
    custom_field_4: lead.custom_field_4 || "", custom_field_5: lead.custom_field_5 || "",
    visit_date: lead.visit_date || null, visit_meet: lead.visit_meet || "", visit_agenda: lead.visit_agenda || "",
    deal_date: lead.deal_date || null, deal_value: lead.deal_value || 0, tonnage: lead.tonnage || 0,
    last_contact: lead.last_contact || null, verified: !!lead.verified, source: lead.source || "manual",
  };
  let saved;
  if (lead.id) {
    const { data, error } = await supabase.from("leads").update(row).eq("id", lead.id).select().single();
    if (error) throw error; saved = data;
  } else {
    const { data, error } = await supabase.from("leads").insert(row).select().single();
    if (error) throw error; saved = data;
  }

  // Auto-sync ke Google Calendar - dulu HARUS diinget manual buat buka
  // Pengaturan terus klik "Sync" tiap kali ada jadwal visit/next action baru
  // atau berubah (gampang kelupaan - persis kejadian yang bikin ATOM salah
  // nuduh "sinkronisasi gagal diam-diam" padahal emang belum pernah di-sync
  // manual). Sekarang otomatis fire-and-forget tiap upsertLead yang nyentuh
  // visit_date/next_action - gagal (belum connect Calendar, bukan Professional+,
  // dst) DIABAIKAN diem-diem, fail-open, gak boleh bikin simpen lead-nya gagal
  // cuma gara-gara sync Calendar-nya bermasalah.
  if (row.visit_date || row.next_action) {
    bulkSyncCalendar().catch(() => {});
  }

  return saved;
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

export async function updateLeadNextAction(id, next_action) {
  const { error } = await supabase.from("leads").update({ next_action }).eq("id", id);
  if (error) throw error;
}

// Reassign lead ke anggota tim lain - dipake owner/manager di tab Leads buat
// mindahin lead yang keupload sales_rep A ke sales_rep B, karena RLS
// (leads_role_access) bikin sales_rep cuma bisa liat lead yang assigned_to
// dirinya sendiri.
export async function updateLeadAssignee(id, assigned_to) {
  const { error } = await supabase.from("leads").update({ assigned_to }).eq("id", id);
  if (error) throw error;
}

// ---- LOKASI GPS & CHECK-IN ----
export async function saveLeadLocation(id, latitude, longitude, accuracy_m = null) {
  const { error } = await supabase.from("leads").update({ latitude, longitude, location_accuracy_m: accuracy_m }).eq("id", id);
  if (error) throw error;
}

// Ubah lat/lng jadi alamat yang bisa dibaca manusia (pakai Nominatim OSM,
// gratis tanpa API key) - biar popup konfirmasi lokasi nunjukin alamat
// asli, bukan cuma teks generik "GPS Anda saat ini". Susun manual dari
// addressdetails (bukan pake display_name mentah) biar nama jalan/gang
// ditaro paling depan kalo datanya ada di OSM - kalo OSM emang belum
// punya data jalan/gang buat titik itu (umum di area yang belum lengkap
// dipetain), gak ada API gratis manapun yang bisa "ngarang" nama jalannya,
// jadi fallback ke bagian paling detail yang tersedia (dusun/RT-RW/desa).
// Fail-open: kalau gagal (network/rate-limit), balikin null biar caller
// fallback ke koordinat mentah.
async function reverseGeocodeOnce(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const a = data?.address;
  if (!a) return data?.display_name || null;
  const jalan = [a.road, a.house_number].filter(Boolean).join(" No. ");
  const parts = [
    jalan,
    a.hamlet, // dusun/gang kecil, kalo ke-mapping di OSM
    a.neighbourhood || a.suburb,
    a.village || a.town,
    a.city_district,
    a.city || a.county,
  ].filter(Boolean);
  // Buang duplikat berurutan (misal suburb & village kebetulan sama nama)
  const dedup = parts.filter((p, i) => p !== parts[i - 1]);
  return dedup.length ? dedup.join(", ") : data?.display_name || null;
}

// User gak mau lagi liat angka koordinat mentah kalau alamatnya gagal
// ke-resolve - jadi di sini dicoba 2x (Nominatim kadang timeout/rate-limit
// sesaat) sebelum bener-bener nyerah dan balikin null ke caller.
export async function reverseGeocode(lat, lng) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const address = await reverseGeocodeOnce(lat, lng);
      if (address) return address;
    } catch (_) { /* coba lagi */ }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }
  return null;
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

// AI ngecek foto check-in beneran ada orangnya (selfie), bukan foto struk/
// random dari galeri - dulu siapapun bisa "check-in terverifikasi" cuma
// dengan upload foto apapun, gak ada yang beneran dicek isinya.
export async function verifySelfiePhoto(photo_url) {
  const { data, error } = await supabase.functions.invoke("verify-selfie-photo", { body: { photo_url } });
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Gagal verifikasi foto");
  }
  if (data?.error) throw new Error(data.error);
  return data; // { isSelfie, reason }
}

// Kuota check-in GPS - 20x/bulan PER USER (bukan per org), soalnya check-in
// itu tindakan personal tiap sales rep ngunjungin customer, bukan hal yang
// masuk akal dibagi rata se-org. Dihitung per bulan kalender WIB, sama pola
// kayak GEN_LEADS_QUOTA_MAX di atas. Dicek di DUA tempat: checkIn() (di sini,
// SUMBER KEBENARAN - nolak insert kalo udah abis, gak bisa dibypass lewat
// panggilan API langsung) dan getCheckinCooldown() (buat UI nampilin sisa
// kuota SEBELUM user buka kamera, biar gak buang-buang usaha foto duluan).
const CHECKIN_QUOTA_MAX = 20;
async function countCheckinsThisMonth(uid) {
  const monthStart = wibMonthStartUTC().toISOString();
  const { count, error } = await supabase
    .from("visit_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("checked_in_at", monthStart);
  if (error) throw error;
  return count || 0;
}
export async function getCheckinCooldown() {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const usedThisMonth = await countCheckinsThisMonth(uid);
  const canCheckIn = usedThisMonth < CHECKIN_QUOTA_MAX;
  const nextAvailableAt = canCheckIn ? null : wibNextMonthStartUTC().toISOString();
  return { canCheckIn, usedThisMonth, quotaMax: CHECKIN_QUOTA_MAX, nextAvailableAt };
}

export async function checkIn({ lead_id, lead_name, latitude, longitude, distance_meters, photo_url, accuracy_m = null }) {
  const uid = (await supabase.auth.getUser()).data.user.id;
  const orgId = await getMyOrgId();
  const usedThisMonth = await countCheckinsThisMonth(uid);
  if (usedThisMonth >= CHECKIN_QUOTA_MAX) {
    throw new Error(`Kuota check-in GPS bulan ini udah abis (maks ${CHECKIN_QUOTA_MAX}x/bulan per user). Bisa lagi awal bulan depan.`);
  }
  const { data, error } = await supabase
    .from("visit_checkins")
    .insert({ user_id: uid, org_id: orgId, lead_id, lead_name, latitude, longitude, distance_meters, photo_url: photo_url || null, accuracy_m })
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

  // Notif in-app ke owner/manager - FIRE AND FORGET. Ini fitur tambahan
  // (bukan inti check-in), jadi kalau gagal (network dst) JANGAN sampai
  // bikin check-in si sales rep keliatan error - .catch aja, gak di-await
  // dan gak throw ke pemanggil.
  supabase.functions.invoke("notify-checkin", { body: { checkin_id: data.id } }).catch((e) => {
    console.error("notify-checkin gagal (fail-open):", e);
  });

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

// Dulu cuma nunjukkin lead_name + waktu - buat tim isinya lebih dari 1 orang
// (owner/manager review kunjungan tim), penting keliatan SIAPA yang check-in,
// gak cuma di lead mana. Narik nama tampilan tiap rep dari settings, sama pola
// kayak getOrgMembers().
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
  const rows = data || [];
  if (rows.length === 0) return rows;
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: settingsRows } = await supabase.from("settings").select("user_id, community_display_name").in("user_id", userIds);
  const nameByUid = {};
  for (const s of settingsRows || []) nameByUid[s.user_id] = s.community_display_name;
  return rows.map((r) => ({ ...r, rep_name: nameByUid[r.user_id] || null }));
}

// ---- NOTIFIKASI IN-APP (bell) ----
// Baris-barisnya diinsert dari edge function pake service role (liat
// notify-checkin) - RLS di sini cuma izinin select/update MILIK SENDIRI.
export async function getMyNotifications(limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}
export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}
export async function markAllNotificationsRead() {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
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
  if (error) {
    let specificMsg = null;
    try { specificMsg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(specificMsg || error.message || "Smart Import AI gagal diproses");
  }
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

// Ambil hasil digest HARI INI doang - dipake buat kartu "Good Morning" di
// Dashboard. Balikin null kalau belum ada (misal weekend, atau cron belum
// jalan) - biar UI bisa nampilin state kosong yang jelas, bukan error.
export async function getTodayAdvisorRun() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("advisor_runs").select("*").eq("run_date", today).maybeSingle();
  if (error) throw error;
  return data || null;
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
