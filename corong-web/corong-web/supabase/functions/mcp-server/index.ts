// Supabase Edge Function: mcp-server
// Remote MCP server buat Nexto CRM - dipanggil dari luar (Grok Bot "Bring Your
// Own MCP", atau agent lain yang support protokol MCP) buat baca & nulis data
// CRM atas nama SATU akun Nexto tertentu.
//
// Auth: BUKAN Supabase JWT biasa. Client kirim `Authorization: Bearer <api key>`
// - key di-generate manual per akun (tabel mcp_api_keys), disimpan sebagai hash
// SHA-256 (plaintext cuma ditunjukin sekali pas dibuat). Ini dipisah dari auth
// login Nexto biar bisa di-revoke independen tanpa ganggu sesi login user.
//
// Protokol: JSON-RPC 2.0 di atas HTTP POST (MCP "Streamable HTTP" transport,
// mode non-streaming - server stateless, gak perlu Mcp-Session-Id karena tiap
// request udah bawa auth-nya sendiri via Authorization header).
//
// === FIX (12 Sep 2026) ===
// Grok Bot connector gagal load ('failed_to_load') karena dia probe dulu pake
// GET (pola umum client MCP buat cek dukungan SSE stream) sebelum lanjut POST.
// Server ini SEBELUMNYA gak nangenin GET sama sekali - jatuh ke branch parsing
// body JSON, gagal (GET gak punya body), balesnya 400 generik yang bikin
// client bingung. Sekarang GET dijawab eksplisit 405 + header Allow: POST,
// sesuai spek Streamable HTTP buat server yang gak dukung SSE stream (stateless
// POST-only) - client yang comply spec bakal lanjut ke POST setelah ini.
//
// === SECURITY FIX (16 Sep 2026, ketauan pas audit) ===
// authenticate() sebelumnya CUMA ngecek key_hash cocok & belum di-revoke -
// gak pernah ngecek ulang apa user pemilik key itu MASIH anggota org-nya.
// delete-my-account sekarang udah hapus mcp_api_keys pas akun dihapus, tapi
// itu gak nutup kasus "user masih ada akunnya tapi udah dikeluarin dari tim
// Enterprise" - key lama dia tetep valid kalau cuma ngandelin revoked_at.
// Sekarang authenticate() JUGA ngecek organization_members punya baris
// (user_id, org_id) itu - kalau enggak (keluar/dikeluarin dari tim), key
// dianggap invalid meskipun belum di-revoke eksplisit.
//
// === FIX #16 (16 Sep 2026, ketauan pas audit keseluruhan) ===
// Server ini punya 3 celah dibanding fitur MCP di frontend (Settings.jsx):
// 1. PLAN GATE: frontend nge-lock UI generate API key ini di myLevel < 1
//    ("Integrasi MCP itu fitur Standard ke atas") - tapi endpoint ini sendiri
//    GAK PERNAH ngecek plan. Kalau org di-downgrade ke Free setelah key udah
//    kebuat (expired/dibatalin), key lama TETEP jalan penuh selamanya -
//    plan gate cuma kosmetik di frontend doang.
// 2. RATE LIMIT: gak ada sama sekali - API key ini bisa dipanggil berapa kali
//    pun (misal loop bug di agent eksternal, atau key bocor), gak ada batas.
// 3. ROLE SCOPING: sales_rep di app biasa cuma bisa liat/edit lead yang
//    assigned_to dia sendiri (lihat pola yang sama di telegram-webhook.ts).
//    Tools di sini (list_leads/get_lead/update_lead_stage/add_progress_note/
//    get_pipeline_stats) semuanya query murni by org_id - sales_rep yang
//    generate API key sendiri bisa baca DAN EDIT lead siapa aja di
//    organisasinya, bukan cuma jatahnya - beda banget dari batasan yang sama
//    persis ditegakin di app utama & bot Telegram.
// Ketiganya dibenerin di bawah: authenticate() sekarang ngecek plan level
// (settings.plan / organizations.plan, sama kayak telegram-webhook) DAN
// balikin role user; ada rate limit harian per user pake tabel
// edge_function_calls (pola yang sama kayak checkRateLimitPerUserMonthly di
// telegram-webhook); dan tiap tool yang nyentuh data lead di-scope ke
// assigned_to kalau role-nya sales_rep.
//
// === RACE FIX (17 Sep 2026, ketauan pas audit) ===
// checkDailyToolCallLimit sebelumnya SELECT count() dulu baru INSERT kalau
// masih di bawah limit - 2 langkah TERPISAH, jadi 2 request bersamaan bisa
// dua-duanya lolos hitungan sebelum salah satu sempet insert. Sekarang lewat
// RPC reserve_edge_function_call (check+insert 1 transaksi, advisory lock
// per user+function) - beneran atomic.
//
// === ROLE SCOPING GAP FIX (17 Sep 2026, ketauan pas audit MCP) ===
// scopedToSelf (fix #16 di atas) udah diterapin ke list_leads/get_lead/
// add_progress_note, tapi KELEWAT di update_lead_stage - sales_rep bisa
// pindahin stage lead siapa aja di org-nya, bukan cuma lead yang assigned_to
// dia. Ini penting karena mcp-server pakai SERVICE ROLE client (admin) yang
// BYPASS RLS leads_role_access sepenuhnya - beda dari app utama yang
// ngandelin RLS itu buat negakin batasan sales_rep. Sekarang update_lead_stage
// ikut di-scope sama kayak tool lain.
//
// Dibuat 12 Sep 2026 - scope AWAL cuma buat 1 akun (Nando) buat testing sambil
// nyiapin submit ke marketplace Grok Bot. Tools: read + write (list/get/create
// lead, update stage, tambah progress note, lihat stats pipeline & stages).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
const MAX_TOOL_CALLS_PER_DAY = 200;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(admin, req) {
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const keyHash = await sha256Hex(m[1].trim());
  const { data } = await admin
    .from("mcp_api_keys")
    .select("id, user_id, org_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;

  // Cek ulang user-nya MASIH beneran anggota org itu (bukan cuma ngandelin
  // revoked_at, yang cuma keisi kalau ada yang inget nge-revoke manual/lewat
  // delete-my-account) - kalau udah dikeluarin dari tim tapi akunnya sendiri
  // masih ada, key lama harusnya ikut mati. Ambil role sekalian buat
  // role-scoping tool di bawah.
  const { data: stillMember } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", data.user_id)
    .eq("org_id", data.org_id)
    .maybeSingle();
  if (!stillMember) return null;

  // PLAN GATE (fix #16) - samain sama batasan di frontend (Settings.jsx:
  // "Integrasi MCP itu fitur Standard ke atas", myLevel < 1 dikunci). Kalau org/akunnya udah balik ke Free (misal langganan expired), key lama HARUS
  // ikut berhenti jalan, bukan tetep aktif selamanya cuma karena udah kadung
  // kebuat pas masih Standard+.
  const [{ data: settingsRow }, { data: orgRow }] = await Promise.all([
    admin.from("settings").select("plan").eq("user_id", data.user_id).maybeSingle(),
    admin.from("organizations").select("plan").eq("id", data.org_id).maybeSingle(),
  ]);
  const isEnterprise = orgRow?.plan === "enterprise";
  const myPlanLevel = isEnterprise ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
  if (myPlanLevel < 1) return null;

  admin.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return { userId: data.user_id, orgId: data.org_id, role: stillMember.role || "sales_rep" };
}

// RATE LIMIT (fix #16) - pola sama kayak checkRateLimitPerUserMonthly di
// telegram-webhook, tapi window harian (bukan bulanan) karena tools/call di
// sini murni dipanggil agent eksternal (potensial jauh lebih sering/loop
// dibanding chat manusia). Lewat RPC reserve_edge_function_call biar
// check+insert atomic (fix race 17 Sep 2026, ketauan pas audit).
async function checkDailyToolCallLimit(admin, userId) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: "mcp-server", p_window_start: dayStart.toISOString(), p_max_calls: MAX_TOOL_CALLS_PER_DAY });
  if (error) { console.error("[mcp-server] reserve_edge_function_call gagal:", error); return false; }
  return !!data;
}

const TOOLS = [
  {
    name: "list_leads",
    description: "List lead/prospek di CRM Nexto. Bisa difilter by stage, kategori, atau priority. Balikin ringkasan (bukan detail lengkap) - pakai get_lead buat detail satu lead.",
    inputSchema: {
      type: "object",
      properties: {
        stage_key: { type: "string", description: "Filter by stage key tertentu (lihat list_stages buat opsinya)." },
        category: { type: "string", description: "Filter by kategori/industri lead." },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Filter by priority." },
        search: { type: "string", description: "Cari berdasarkan nama lead (partial match)." },
        limit: { type: "number", description: "Maks jumlah hasil, default 20, maks 50." },
      },
    },
  },
  {
    name: "get_lead",
    description: "Ambil detail lengkap satu lead by ID, termasuk progress notes terbaru.",
    inputSchema: { type: "object", properties: { lead_id: { type: "string", description: "UUID lead." } }, required: ["lead_id"] },
  },
  {
    name: "create_lead",
    description: "Buat lead/prospek baru di CRM Nexto. Lead baru masuk ke stage pertama secara default kalau stage_key gak dikasih.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nama perusahaan/customer. WAJIB." },
        category: { type: "string" },
        product: { type: "string" },
        city: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        key_person: { type: "string" },
        key_person_title: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        next_action: { type: "string" },
        stage_key: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_lead_stage",
    description: "Pindahin lead ke stage pipeline lain (misal dari 'Kontak Awal' ke 'Negosiasi').",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string" }, stage_key: { type: "string", description: "Key stage tujuan, lihat list_stages." } },
      required: ["lead_id", "stage_key"],
    },
  },
  {
    name: "add_progress_note",
    description: "Tambah catatan progress/aktivitas terbaru ke satu lead (misal hasil telepon, WA, atau meeting).",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        text: { type: "string", description: "Isi catatan." },
        note_date: { type: "string", description: "Format YYYY-MM-DD, default hari ini." },
      },
      required: ["lead_id", "text"],
    },
  },
  {
    name: "list_stages",
    description: "List semua stage pipeline yang ada di CRM ini beserta key, label, dan tipenya (normal/won/lost).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_pipeline_stats",
    description: "Ringkasan statistik pipeline: total lead aktif, jumlah yang overdue follow-up, dan win rate.",
    inputSchema: { type: "object", properties: {} },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}
function errorResult(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function callTool(admin, ctx, name, args) {
  args = args || {};
  const orgId = ctx.orgId;
  // ROLE SCOPING (fix #16) - sales_rep cuma boleh liat/edit lead yang jadi
  // jatahnya sendiri (assigned_to), sama persis kayak batasan di app utama
  // & bot Telegram (myRole === "sales_rep" ? q.eq("assigned_to", userId)).
  // Owner/manager tetap bebas akses semua lead di org-nya.
  const scopedToSelf = ctx.role === "sales_rep";

  if (name === "list_leads") {
    let q = admin.from("leads").select("id, name, category, stage_key, priority, city, last_contact, deal_value").eq("org_id", orgId).is("deleted_at", null);
    if (scopedToSelf) q = q.eq("assigned_to", ctx.userId);
    if (args.stage_key) q = q.eq("stage_key", args.stage_key);
    if (args.category) q = q.eq("category", args.category);
    if (args.priority) q = q.eq("priority", args.priority);
    if (args.search) q = q.ilike("name", `%${args.search}%`);
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
    const { data, error } = await q.order("updated_at", { ascending: false }).limit(limit);
    if (error) return errorResult(String(error.message || error));
    return textResult({ leads: data || [] });
  }

  if (name === "get_lead") {
    if (!args.lead_id) return errorResult("lead_id wajib diisi.");
    let q = admin
      .from("leads")
      .select("*, progress_notes(note_date, text)")
      .eq("id", args.lead_id)
      .eq("org_id", orgId)
      .is("deleted_at", null);
    if (scopedToSelf) q = q.eq("assigned_to", ctx.userId);
    const { data, error } = await q.maybeSingle();
    if (error) return errorResult(String(error.message || error));
    if (!data) return errorResult("Lead gak ketemu.");
    return textResult(data);
  }

  if (name === "create_lead") {
    if (!args.name || !String(args.name).trim()) return errorResult("name wajib diisi.");
    let stageKey = args.stage_key;
    if (!stageKey) {
      const { data: firstStage } = await admin.from("stages").select("key").eq("org_id", orgId).eq("type", "normal").order("position").limit(1).maybeSingle();
      stageKey = firstStage?.key || null;
    }
    const row = {
      user_id: ctx.userId,
      org_id: orgId,
      assigned_to: ctx.userId,
      name: String(args.name).trim(),
      category: args.category || "",
      product: args.product || "",
      city: args.city || "",
      priority: args.priority || "",
      key_person: args.key_person || "",
      key_person_title: args.key_person_title || "",
      phone: args.phone || "",
      email: args.email || "",
      next_action: args.next_action || "",
      stage_key: stageKey,
      source: "grok_bot_mcp",
    };
    const { data, error } = await admin.from("leads").insert(row).select("id, name, stage_key").maybeSingle();
    if (error) return errorResult(String(error.message || error));
    return textResult({ created: data });
  }

  if (name === "update_lead_stage") {
    if (!args.lead_id || !args.stage_key) return errorResult("lead_id dan stage_key wajib diisi.");
    const { data: stageExists } = await admin.from("stages").select("key").eq("org_id", orgId).eq("key", args.stage_key).maybeSingle();
    if (!stageExists) return errorResult(`Stage key "${args.stage_key}" gak ketemu di CRM ini. Pakai list_stages buat lihat opsi yang valid.`);
    let updQ = admin
      .from("leads")
      .update({ stage_key: args.stage_key, updated_at: new Date().toISOString() })
      .eq("id", args.lead_id)
      .eq("org_id", orgId);
    if (scopedToSelf) updQ = updQ.eq("assigned_to", ctx.userId);
    const { data, error } = await updQ.select("id, name, stage_key").maybeSingle();
    if (error) return errorResult(String(error.message || error));
    if (!data) return errorResult("Lead gak ketemu.");
    return textResult({ updated: data });
  }

  if (name === "add_progress_note") {
    if (!args.lead_id || !args.text) return errorResult("lead_id dan text wajib diisi.");
    let leadQ = admin.from("leads").select("id").eq("id", args.lead_id).eq("org_id", orgId);
    if (scopedToSelf) leadQ = leadQ.eq("assigned_to", ctx.userId);
    const { data: leadExists } = await leadQ.maybeSingle();
    if (!leadExists) return errorResult("Lead gak ketemu di CRM ini.");
    const noteDate = /^\d{4}-\d{2}-\d{2}$/.test(args.note_date || "") ? args.note_date : new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("progress_notes")
      .insert({ user_id: ctx.userId, org_id: orgId, lead_id: args.lead_id, text: args.text, note_date: noteDate })
      .select("id, note_date")
      .maybeSingle();
    if (error) return errorResult(String(error.message || error));
    await admin.from("leads").update({ last_contact: noteDate, updated_at: new Date().toISOString() }).eq("id", args.lead_id);
    return textResult({ added: data });
  }

  if (name === "list_stages") {
    const { data, error } = await admin.from("stages").select("key, label, type, position").eq("org_id", orgId).order("position");
    if (error) return errorResult(String(error.message || error));
    return textResult({ stages: data || [] });
  }

  if (name === "get_pipeline_stats") {
    const { data: stages } = await admin.from("stages").select("key, type").eq("org_id", orgId);
    const wonKeys = (stages || []).filter((s) => s.type === "won").map((s) => s.key);
    const lostKeys = (stages || []).filter((s) => s.type === "lost").map((s) => s.key);
    let statsQ = admin.from("leads").select("stage_key, last_contact, wait_until").eq("org_id", orgId).is("deleted_at", null);
    if (scopedToSelf) statsQ = statsQ.eq("assigned_to", ctx.userId);
    const { data: leads, error } = await statsQ;
    if (error) return errorResult(String(error.message || error));
    const all = leads || [];
    const active = all.filter((l) => !wonKeys.includes(l.stage_key) && !lostKeys.includes(l.stage_key));
    const todayISO = new Date().toISOString().slice(0, 10);
    const actionable = active.filter((l) => !l.wait_until || String(l.wait_until) < todayISO);
    const overdue = actionable.filter((l) => {
      if (!l.last_contact) return true;
      const days = Math.floor((Date.now() - new Date(l.last_contact).getTime()) / 86400000);
      return days > 7;
    }).length;
    const won = all.filter((l) => wonKeys.includes(l.stage_key)).length;
    const lost = all.filter((l) => lostKeys.includes(l.stage_key)).length;
    const totalClosed = won + lost;
    return textResult({
      total_active: active.length,
      overdue_followup: overdue,
      total_won: won,
      total_lost: lost,
      win_rate: totalClosed >= 5 ? Math.round((won / totalClosed) * 100) : null,
    });
  }

  return errorResult(`Tool "${name}" gak dikenal.`);
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Server ini stateless, POST-only JSON-RPC (gak dukung SSE stream via GET)." } }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Allow": "POST, OPTIONS" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: { ...CORS_HEADERS, "Allow": "POST, OPTIONS" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(jsonRpcError(null, -32700, "Parse error")), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  const { id, method, params } = body || {};

  // initialize gak butuh auth granular per-tool tapi tetep harus dari key yang valid,
  // biar server gak jadi open probe buat siapa aja nebak-nebak endpoint ini isinya apa.
  const ctx = await authenticate(admin, req);
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
  }

  if (method === "notifications/initialized" || (typeof method === "string" && method.startsWith("notifications/"))) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === "initialize") {
    const clientVersion = params?.protocolVersion || "2025-06-18";
    return new Response(
      JSON.stringify(jsonRpcResult(id, {
        protocolVersion: clientVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "nexto-crm-mcp", version: "1.0.0" },
      })),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (method === "tools/list") {
    return new Response(JSON.stringify(jsonRpcResult(id, { tools: TOOLS })), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  if (method === "tools/call") {
    const withinLimit = await checkDailyToolCallLimit(admin, ctx.userId);
    if (!withinLimit) {
      return new Response(
        JSON.stringify(jsonRpcResult(id, errorResult(`Kuota panggilan tool MCP harian (${MAX_TOOL_CALLS_PER_DAY}x/hari) udah kepake abis. Coba lagi besok.`))),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    try {
      const result = await callTool(admin, ctx, params?.name, params?.arguments);
      return new Response(JSON.stringify(jsonRpcResult(id, result)), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    } catch (err) {
      console.log("[mcp-server] EXCEPTION calling tool", params?.name, String(err));
      return new Response(JSON.stringify(jsonRpcResult(id, errorResult(String(err)))), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
  }

  if (method === "ping") {
    return new Response(JSON.stringify(jsonRpcResult(id, {})), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(jsonRpcError(id, -32601, `Method "${method}" gak didukung.`)), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});
