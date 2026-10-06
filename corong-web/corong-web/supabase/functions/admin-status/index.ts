// Supabase Edge Function: admin-status
// Dipanggil dari Dashboard Admin - ngasih ringkasan status semua "karyawan AI"
// buat SELURUH platform (bukan cuma satu org doang), makanya butuh service
// role + verifikasi identitas admin dulu (pola sama kayak admin-trigger).
//
// (Riwayat fix lama dipangkas di komentar ini - liat versi sebelumnya kalau
// butuh detail: dedup digest harian, NOVA/SASA/SAPU, limit fitur AI + trend,
// pagination listUsers, katalog dilengkapin, card DATA + usage digabung,
// card TRAFFIC dasar + jam rame/alur halaman/baru-balik/lokasi.)
//
// === DATA DILENGKAPIN (18 Sep 2026, permintaan Nando) ===
// Tiap baris user di card DATA sekarang bawa juga: whatsapp (dari
// settings.whatsapp, kalau udah diisi user pas signup/di Pengaturan) dan
// jumlah baris leads yang DIA buat sendiri (leads.user_id = akun ini, count
// deleted_at null doang). Total baris leads SELURUH platform juga
// ditambahin ke users_overview (sebelumnya cuma ada di 'platform' block
// yang gak ditampilin di UI mana pun).
//
// === BIAYA AI PER AKUN (6 Okt 2026, permintaan Nando) ===
// Respons sekarang membawa `ai_usage` dari RPC admin_ai_usage_report(): per
// akun berbayar - pemakaian vs limit per fitur, token & biaya nyata (tabel
// ai_usage), dan persen dari total limit paketnya. Katalog limit lama juga
// diperbarui: Generate Leads per pengguna, Rekam Meeting 8x, Draft
// Follow-up 3x/hari.
//
// Sumber ini sebelumnya hanya ada di server (tidak ada di repo) - disimpan ke
// repo mulai 6 Okt 2026.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth(), day = wibNow.getUTCDate();
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WIB_OFFSET_MS);
}
function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}
function wibHourOf(iso) {
  const wibNow = new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
  return wibNow.getUTCHours();
}

// Katalog SEMUA fitur AI yang ada di app - dipake buat nampilin daftar
// lengkap di Command Center (bukan cuma yang metered). `functionName` cocok
// sama `function_name` di tabel edge_function_calls (null kalau pake tabel
// lain, atau kalau emang gak metered).
const FEATURE_CATALOG = [
  { key: "smart_import", label: "Smart Import AI", tier: "standard", scope: "user", window: "month", limit: 8, metered: true, functionName: "smart-import-map-ts" },
  { key: "daily_digest", label: "Daily Digest / AI Advisor Harian", tier: "standard", scope: "org", window: "day", limit: null, metered: false, note: "Otomatis 1x/hari lewat cron, bukan dipicu manual - gak ada risiko kebocoran per akun." },
  { key: "suggest_visit_points", label: "Poin Diskusi (AI) / Meeting Prep", tier: "standard", scope: "user", window: "month", limit: 10, metered: true, functionName: "suggest-visit-points" },
  { key: "proactive_check", label: "Chat Proaktif Siang (Telegram)", tier: "professional", scope: "user", window: "day", limit: null, metered: false, note: "Otomatis 1x/hari lewat cron (proactive-check), bukan dipicu manual - gak ada jalur user spam." },
  { key: "generate_leads", label: "Generate Leads AI", tier: "professional", scope: "user", window: "month", limit: 4, metered: true, functionName: null, usesLeadGenRuns: true },
  { key: "transcribe_meeting", label: "Rekam Meeting Otomatis (AI)", tier: "professional", scope: "user", window: "month", limit: 8, metered: true, functionName: "transcribe-meeting" },
  { key: "outcome_memory", label: "Outcome Memory (AI)", tier: "professional", scope: "user", window: "month", limit: 15, metered: true, functionName: "guess-outcome-reason" },
  { key: "draft_followup", label: "AI Draft Follow-up", tier: "professional", scope: "user", window: "day", limit: 3, metered: true, functionName: "draft-followup" },
  { key: "chatbot_messages", label: "Chatbot NEXA (Teks & Voice Note)", tier: "professional", scope: "user", window: "day", limit: 17, metered: true, functionName: null, usesChatMessages: true },
  { key: "customer_state", label: "Customer State (AI)", tier: "professional", scope: "user", window: "month", limit: null, metered: false, note: "Nempel ke data lead yang udah ada, bukan panggilan AI on-demand terpisah." },
  { key: "competitor_analysis", label: "Analisa Kompetitor", tier: "professional", scope: "user", window: "month", limit: null, metered: false, note: "CRUD data kompetitor - gak ada panggilan AI sama sekali." },
  { key: "verify_selfie_photo", label: "Verifikasi Selfie GPS Check-in", tier: "enterprise", scope: "user", window: "month", limit: 60, metered: true, functionName: "verify-selfie-photo", requiresEnterpriseOrg: true },
  { key: "nova_content", label: "NOVA - Konten Marketing", tier: "internal", scope: "platform", window: "week", limit: null, metered: false, note: "Otomatis mingguan buat marketing Nexto sendiri, bukan kuota per akun customer." },
  { key: "sasa_chat", label: "SASA - Customer Support", tier: "internal", scope: "platform", window: "none", limit: null, metered: false, note: "Chat visitor landing page, gak dibatesin by design." },
];
const METERED_FUNCTION_NAMES = FEATURE_CATALOG.filter((f) => f.metered && f.functionName).map((f) => f.functionName);
const TIER_LEVEL = { free: 0, standard: 1, professional: 2, enterprise: 2, internal: 2 };

function statusOf(used, limit) {
  if (limit === null || limit === undefined) return "unlimited";
  if (used >= limit) return "over";
  if (used / limit >= 0.8) return "warning";
  return "ok";
}

async function getAllUsers(admin) {
  let allUsers = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) { console.log("[admin-status] listUsers GAGAL di halaman", page, ":", String(error)); break; }
    const batch = data?.users || [];
    allUsers = allUsers.concat(batch);
    if (batch.length < perPage) break;
    page++;
    if (page > 20) { console.log("[admin-status] listUsers berhenti di halaman 20 (safety net)"); break; }
  }
  return allUsers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Cuma admin platform yang boleh liat ini" }), { status: 403, headers: CORS });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString();
    const dayStart = wibDayStartUTC();
    const monthStart = wibMonthStartUTC();

    const [
      { data: lastHealthCheck },
      { data: healthHistory },
      { data: todayDigests },
      { data: digestHistory },
      { data: lastChatMsg },
      { count: chatMsgTodayCount },
      { count: pendingEmbedCount },
      { count: totalLeadsCount },
      { count: totalOrgsCount },
      { count: pendingDraftsCount },
      { data: recentDrafts },
      { count: supportMsgTodayCount },
      { count: supportEscalatedTodayCount },
      { data: allMembers },
      { data: allOrgs },
      { data: allSettings },
      { data: monthlyCalls },
      { data: monthlyLeadGenRuns },
      { data: todayChatMessages },
      { data: lastGarbageSweep },
      { data: recentVisits },
      { data: allLeadOwners },
      { data: aiUsageReport, error: aiUsageErr },
    ] = await Promise.all([
      admin.from("health_check_runs").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("health_check_runs").select("checked_at, status, issue_count, ai_flagged_count").gte("checked_at", sevenDaysAgo).order("checked_at", { ascending: true }),
      admin.from("advisor_runs").select("user_id").gte("updated_at", todayStart),
      admin.from("advisor_runs").select("updated_at, user_id").gte("updated_at", sevenDaysAgo).order("updated_at", { ascending: true }),
      admin.from("chat_messages").select("created_at").eq("source", "telegram").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("source", "telegram").gte("created_at", todayStart),
      admin.from("progress_notes").select("id", { count: "exact", head: true }).is("embedding", null).gte("created_at", oneDayAgo),
      admin.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin.from("content_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("content_drafts").select("*").order("created_at", { ascending: false }).limit(5),
      admin.from("landing_chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", todayStart),
      admin.from("landing_chat_messages").select("id", { count: "exact", head: true }).eq("escalated", true).gte("created_at", todayStart),
      admin.from("organization_members").select("user_id, org_id, role"),
      admin.from("organizations").select("id, name, plan"),
      admin.from("settings").select("user_id, community_display_name, plan, whatsapp"),
      admin.from("edge_function_calls").select("user_id, function_name, called_at").in("function_name", METERED_FUNCTION_NAMES).gte("called_at", monthStart.toISOString()),
      admin.from("lead_gen_runs").select("org_id, user_id, generated_at").gte("generated_at", monthStart.toISOString()),
      admin.from("chat_messages").select("user_id").eq("role", "user").eq("source", "telegram").gte("created_at", dayStart.toISOString()),
      admin.from("garbage_sweep_runs").select("*").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("page_visits").select("session_id, page_path, referrer, device, country, city, created_at").gte("created_at", sevenDaysAgo),
      admin.from("leads").select("user_id").is("deleted_at", null),
      admin.rpc("admin_ai_usage_report"),
    ]);
    if (aiUsageErr) console.log("[admin-status] admin_ai_usage_report gagal:", aiUsageErr.message);

    const dayBuckets = {};
    for (const row of healthHistory || []) {
      const day = row.checked_at.slice(0, 10);
      if (!dayBuckets[day]) dayBuckets[day] = { day, issues: 0, checks: 0, aiFlagged: 0, aiChecks: 0 };
      dayBuckets[day].issues += row.issue_count || 0;
      dayBuckets[day].checks += 1;
      // ai_flagged_count baru mulai dicatet 9 Sep 2026 - run LAMA gak punya
      // kolom ini (null), jangan dianggap 0 (nanti tren-nya keliatan turun
      // drastis padahal cuma belum pernah dicatet).
      if (row.ai_flagged_count !== null && row.ai_flagged_count !== undefined) {
        dayBuckets[day].aiFlagged += row.ai_flagged_count;
        dayBuckets[day].aiChecks += 1;
      }
    }

    const digestUsersByDay = {};
    for (const row of digestHistory || []) {
      const day = row.updated_at.slice(0, 10);
      if (!digestUsersByDay[day]) digestUsersByDay[day] = new Set();
      digestUsersByDay[day].add(row.user_id);
    }
    const digestByDay = {};
    for (const [day, userSet] of Object.entries(digestUsersByDay)) {
      digestByDay[day] = userSet.size;
    }
    const todayUniqueUsers = new Set((todayDigests || []).map((r) => r.user_id)).size;

    // Jumlah baris leads yang dibuat tiap user (leads.user_id = pembuat) -
    // dipake buat kolom "Leads" di card DATA.
    const leadsCountByUser = {};
    for (const row of allLeadOwners || []) {
      leadsCountByUser[row.user_id] = (leadsCountByUser[row.user_id] || 0) + 1;
    }

    // ---- RAKIT "Limit Fitur AI" per akun ----
    const orgById = {};
    for (const o of allOrgs || []) orgById[o.id] = o;
    const settingsByUser = {};
    for (const s of allSettings || []) settingsByUser[s.user_id] = s;

    let allUsersRaw = [];
    try {
      allUsersRaw = await getAllUsers(admin);
    } catch (_) {
      allUsersRaw = [];
    }
    const emailByUser = {};
    for (const u of allUsersRaw) emailByUser[u.id] = u.email;

    const usedMonthlyByUserFn = {};
    const usedDailyByUserFn = {};
    for (const row of monthlyCalls || []) {
      const k = `${row.user_id}::${row.function_name}`;
      usedMonthlyByUserFn[k] = (usedMonthlyByUserFn[k] || 0) + 1;
      if (new Date(row.called_at) >= dayStart) {
        usedDailyByUserFn[k] = (usedDailyByUserFn[k] || 0) + 1;
      }
    }
    // Generate Leads dihitung per pengguna sejak 6 Okt 2026 (lead_gen_runs.user_id).
    const usedLeadGenByUser = {};
    for (const row of monthlyLeadGenRuns || []) {
      if (!row.user_id) continue;
      usedLeadGenByUser[row.user_id] = (usedLeadGenByUser[row.user_id] || 0) + 1;
    }
    const chatMsgTodayByUser = {};
    for (const row of todayChatMessages || []) {
      chatMsgTodayByUser[row.user_id] = (chatMsgTodayByUser[row.user_id] || 0) + 1;
    }

    const accounts = (allMembers || []).map((m) => {
      const org = orgById[m.org_id] || null;
      const settingsRow = settingsByUser[m.user_id] || null;
      const isEnterprise = org?.plan === "enterprise";
      const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
      const level = isEnterprise ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
      const planLabel = isEnterprise ? "enterprise" : (settingsRow?.plan === "premium" ? "professional" : (settingsRow?.plan || "free"));

      const usage = {};
      for (const f of FEATURE_CATALOG) {
        if (!f.metered) continue;
        const requiredLevel = TIER_LEVEL[f.tier] ?? 0;
        // requiresEnterpriseOrg (fix 17 Sep 2026): sebagian fitur (verifikasi
        // selfie GPS check-in) sebenernya ngecek org.plan === 'enterprise'
        // BENERAN di edge function-nya sendiri, BUKAN cuma level personal >=2
        // - Professional (level 2 juga, tapi bukan org Enterprise) HARUS
        // tetep keitung gak applicable buat fitur ini.
        const applicable = f.requiresEnterpriseOrg ? isEnterprise : (level >= requiredLevel);
        let used = 0;
        if (f.usesLeadGenRuns) {
          used = usedLeadGenByUser[m.user_id] || 0;
        } else if (f.usesChatMessages) {
          used = chatMsgTodayByUser[m.user_id] || 0;
        } else if (f.functionName) {
          const k = `${m.user_id}::${f.functionName}`;
          used = f.window === "day" ? (usedDailyByUserFn[k] || 0) : (usedMonthlyByUserFn[k] || 0);
        }
        usage[f.key] = { used, limit: f.limit, applicable, status: applicable ? statusOf(used, f.limit) : "n/a" };
      }

      return {
        user_id: m.user_id,
        email: emailByUser[m.user_id] || null,
        display_name: settingsRow?.community_display_name || null,
        role: m.role,
        org_id: m.org_id,
        org_name: org?.name || "(org tanpa nama)",
        plan: planLabel,
        usage,
      };
    });

    const anyOver = accounts.some((a) => Object.values(a.usage).some((u) => u.status === "over"));
    const anyWarning = accounts.some((a) => Object.values(a.usage).some((u) => u.status === "warning"));

    const aiLimitsTrend = Object.values(dayBuckets)
      .filter((d) => d.aiChecks > 0)
      .map((d) => ({ day: d.day, count: d.aiFlagged }));

    // ---- RAKIT "DATA" (direktori semua user platform) ----
    const usageByUserId = {};
    for (const a of accounts) usageByUserId[a.user_id] = a.usage;

    const membersByUser = {};
    for (const m of allMembers || []) membersByUser[m.user_id] = m;
    const sevenDaysAgoDate = new Date(sevenDaysAgo);
    const byPlanCounts = { free: 0, standard: 0, professional: 0, enterprise: 0 };
    let new7d = 0;
    const usersList = allUsersRaw.map((u) => {
      const memberRow = membersByUser[u.id] || null;
      const org = memberRow ? orgById[memberRow.org_id] : null;
      const settingsRow = settingsByUser[u.id] || null;
      const isEnterprise = org?.plan === "enterprise";
      const planLabel = isEnterprise ? "enterprise" : (settingsRow?.plan === "premium" ? "professional" : (settingsRow?.plan || "free"));
      byPlanCounts[planLabel] = (byPlanCounts[planLabel] || 0) + 1;
      if (u.created_at && new Date(u.created_at) >= sevenDaysAgoDate) new7d++;
      return {
        user_id: u.id,
        email: u.email || null,
        display_name: settingsRow?.community_display_name || null,
        org_name: org?.name || null,
        whatsapp: settingsRow?.whatsapp || null,
        leads_count: leadsCountByUser[u.id] || 0,
        plan: planLabel,
        role: memberRow?.role || null,
        created_at: u.created_at || null,
        last_sign_in_at: u.last_sign_in_at || null,
        usage: usageByUserId[u.id] || {},
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const totalLeadsAllUsers = (allLeadOwners || []).length;
    const usersOverview = { total: allUsersRaw.length, by_plan: byPlanCounts, new_7d: new7d, total_leads: totalLeadsAllUsers, list: usersList };

    // ---- RAKIT "TRAFFIC" (analitik sendiri, dari page_visits) ----
    const visits = recentVisits || [];
    const todayStartDate = new Date(todayStart);
    const visitsToday = visits.filter((v) => new Date(v.created_at) >= todayStartDate);
    const uniqueToday = new Set(visitsToday.map((v) => v.session_id)).size;

    const trafficByDay = {};
    for (const v of visits) {
      const day = v.created_at.slice(0, 10);
      if (!trafficByDay[day]) trafficByDay[day] = { day, visits: 0, sessions: new Set() };
      trafficByDay[day].visits += 1;
      trafficByDay[day].sessions.add(v.session_id);
    }
    const trafficTrend = Object.values(trafficByDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ day: d.day, visits: d.visits, unique: d.sessions.size }));

    const pageCounts = {};
    const referrerCounts = {};
    let mobileCount = 0, desktopCount = 0;
    for (const v of visits) {
      pageCounts[v.page_path] = (pageCounts[v.page_path] || 0) + 1;
      if (v.device === "mobile") mobileCount++; else desktopCount++;
      if (v.referrer) {
        try {
          const host = new URL(v.referrer).hostname.replace(/^www\./, "");
          referrerCounts[host] = (referrerCounts[host] || 0) + 1;
        } catch (_) { /* referrer bukan URL valid, skip */ }
      }
    }
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([page, count]) => ({ page, count }));
    const topReferrers = Object.entries(referrerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([host, count]) => ({ host, count }));

    // Jam-jam rame (WIB) - dari SELURUH window 7 hari, bukan cuma hari ini,
    // biar pola jam-nya lebih stabil (hari ini doang kadang kurang datanya).
    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    for (const v of visits) hourlyCounts[wibHourOf(v.created_at)]++;
    const hourly = hourlyCounts.map((count, hour) => ({ hour, count }));

    // Alur halaman per sesi - sesi yang cuma buka 1 halaman ('single') vs yang
    // lanjut ke halaman lain juga ('multi') dalam window 7 hari.
    const pagesBySession = {};
    for (const v of visits) {
      if (!pagesBySession[v.session_id]) pagesBySession[v.session_id] = new Set();
      pagesBySession[v.session_id].add(v.page_path);
    }
    let singlePageSessions = 0, multiPageSessions = 0;
    for (const pages of Object.values(pagesBySession)) {
      if (pages.size > 1) multiPageSessions++; else singlePageSessions++;
    }

    // Visitor baru vs balik lagi (hari ini) - "balik lagi" kalau session_id
    // yang sama udah pernah nongol SEBELUM hari ini, dalam window 7 hari yang
    // di-fetch (approksimasi - visitor yang absen >7 hari bakal kehitung
    // "baru" lagi pas balik, ini trade-off sengaja biar query tetep ringan).
    const sessionsBeforeToday = new Set(visits.filter((v) => new Date(v.created_at) < todayStartDate).map((v) => v.session_id));
    const todaySessions = new Set(visitsToday.map((v) => v.session_id));
    let returningToday = 0;
    for (const sid of todaySessions) if (sessionsBeforeToday.has(sid)) returningToday++;
    const newToday = todaySessions.size - returningToday;

    // Lokasi (negara/kota) - dari lookup IP di track-visit, bukan IP mentah.
    const countryCounts = {};
    const cityCounts = {};
    for (const v of visits) {
      if (v.country) countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
      if (v.city) {
        const label = v.country ? `${v.city}, ${v.country}` : v.city;
        cityCounts[label] = (cityCounts[label] || 0) + 1;
      }
    }
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([country, count]) => ({ country, count }));
    const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([city, count]) => ({ city, count }));

    const traffic = {
      visits_today: visitsToday.length,
      unique_today: uniqueToday,
      visits_7d: visits.length,
      trend: trafficTrend,
      top_pages: topPages,
      top_referrers: topReferrers,
      device: { mobile: mobileCount, desktop: desktopCount },
      hourly,
      page_flow: { single: singlePageSessions, multi: multiPageSessions },
      new_vs_returning_today: { new: newToday, returning: returningToday },
      top_countries: topCountries,
      top_cities: topCities,
    };

    return new Response(JSON.stringify({
      ok: true,
      security: lastHealthCheck || null,
      security_trend: Object.values(dayBuckets),
      sales_advisor: { runs_today: todayUniqueUsers, trend: Object.entries(digestByDay).map(([day, count]) => ({ day, count })) },
      assistant: { last_activity: lastChatMsg?.created_at || null, messages_today: chatMsgTodayCount ?? 0 },
      vector_memory: { pending_embeddings: pendingEmbedCount ?? 0 },
      platform: { total_leads: totalLeadsCount ?? 0, total_orgs: totalOrgsCount ?? 0 },
      content_studio: { pending_count: pendingDraftsCount ?? 0, recent_drafts: recentDrafts || [] },
      support: { messages_today: supportMsgTodayCount ?? 0, escalated_today: supportEscalatedTodayCount ?? 0 },
      ai_limits: { features: FEATURE_CATALOG, accounts, any_over: anyOver, any_warning: anyWarning, trend: aiLimitsTrend },
      ai_usage: aiUsageReport || null,
      garbage_sweep: lastGarbageSweep || null,
      users_overview: usersOverview,
      traffic,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
