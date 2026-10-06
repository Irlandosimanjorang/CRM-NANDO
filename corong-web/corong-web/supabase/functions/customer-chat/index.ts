// Supabase Edge Function: customer-chat
// SASA (Customer Support AI). Dipanggil dari widget chat di landing page
// (publik, tanpa login) DAN dari dalam app (user login - supabase-js otomatis
// ngirim JWT user di header Authorization). Tugasnya:
//  1. Jawab pertanyaan soal Nexto HANYA berdasarkan KNOWLEDGE_BASE di bawah
//     (harga, fitur per paket, industri) - gak boleh ngarang.
//  2. Kalau di luar cakupan / minta manusia / tim > 4 orang -> eskalasi ke
//     admin (Telegram + WhatsApp via Fonnte) dan minta kontak.
//  3. Rate limit per session_id + per IP (anti spam Claude API).
//
// === AUDIT ENTERPRISE (30 Sep 2026) ===
// - KNOWLEDGE_BASE disinkronin ke harga FINAL 22 Sep 2026 (Auth.jsx
//   PRICING_NORMAL/PRICING_EARLY_BIRD) - sebelumnya SASA masih nyebut harga
//   16 Sep (Enterprise Rp1.356.000, dst) dan Bot Telegram yang udah diganti
//   NEX Pro. Fitur Enterprise baru (tab Team, kontrak & termin, target,
//   laporan mingguan, Ringkasan Kebutuhan, katalog) ditambahin.
// - "Prioritas support" Enterprise diwujudkan: kalau yang chat user login
//   dari org Enterprise, kuota harian lebih besar dan eskalasi dikasih label
//   PRIORITAS ENTERPRISE + nama org & email, biar admin langsung tau.
// - Bahasa jawaban formal ("Anda").
//
// PENTING: kalau harga/fitur berubah di Auth.jsx (STANDARD_FEATURES,
// PROFESSIONAL_FEATURES, ENTERPRISE_FEATURES, PRICING_*) atau mapping
// mayar-webhook, WAJIB diupdate di sini juga.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "customer-chat";
const AI_CTX = new AsyncLocalStorage();
const AI_PRICE = { sonnet: [2, 10, 2.5, 0.2], haiku: [1, 5, 1.25, 0.1] };
function aiSetUser(userId, orgId = null) {
  const s = AI_CTX.getStore();
  if (s) { s.userId = userId || null; if (orgId) s.orgId = orgId; }
}
function aiJwtUser(req) {
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated" ? payload.sub : null;
  } catch (_) {
    return null;
  }
}
const AI_RAW_FETCH = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const resp = await AI_RAW_FETCH(input, init);
  try {
    const url = typeof input === "string" ? input : (input?.url || String(input));
    if (resp.ok && (url.startsWith("https://api.anthropic.com/") || url.startsWith("https://api.openai.com/"))) {
      await aiLogUsage(url, init, resp.clone());
    }
  } catch (e) {
    console.log("[ai-usage] gagal mencatat:", String(e));
  }
  return resp;
};
async function aiLogUsage(url, init, resp) {
  const ctx = AI_CTX.getStore() || {};
  const row = {
    feature: AI_FEATURE,
    user_id: ctx.userId !== undefined ? ctx.userId : (ctx.req ? aiJwtUser(ctx.req) : null),
    org_id: ctx.orgId || null,
    provider: url.includes("anthropic") ? "anthropic" : "openai",
  };
  if (row.provider === "anthropic") {
    const d = await resp.json();
    const u = d.usage || {};
    let model = d.model || "";
    if (!model) { try { model = JSON.parse(init?.body || "{}").model || ""; } catch (_) { /* tanpa model */ } }
    const p = model.includes("haiku") ? AI_PRICE.haiku : AI_PRICE.sonnet;
    Object.assign(row, {
      model,
      input_tokens: u.input_tokens || 0,
      output_tokens: u.output_tokens || 0,
      cache_write_tokens: u.cache_creation_input_tokens || 0,
      cache_read_tokens: u.cache_read_input_tokens || 0,
      web_searches: u.server_tool_use?.web_search_requests || 0,
      web_fetches: u.server_tool_use?.web_fetch_requests || 0,
    });
    row.cost_usd = (row.input_tokens * p[0] + row.output_tokens * p[1] + row.cache_write_tokens * p[2] + row.cache_read_tokens * p[3]) / 1e6 + row.web_searches * 0.01;
  } else if (url.includes("/audio/transcriptions")) {
    const d = await resp.json();
    row.model = "whisper-1";
    row.audio_seconds = Math.round(d.duration || 0);
    row.cost_usd = ((d.duration || 0) / 60) * 0.006;
  } else if (url.includes("/audio/speech")) {
    let body = {};
    try { body = JSON.parse(init?.body || "{}"); } catch (_) { /* body bukan JSON */ }
    row.model = body.model || "tts-1";
    row.tts_chars = String(body.input || "").length;
    row.cost_usd = (row.tts_chars * 15) / 1e6;
  } else if (url.includes("/embeddings")) {
    const d = await resp.json();
    row.model = d.model || "text-embedding-3-small";
    row.input_tokens = d.usage?.total_tokens || 0;
    row.cost_usd = (row.input_tokens * 0.02) / 1e6;
  } else {
    return;
  }
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ins = await AI_RAW_FETCH(`${Deno.env.get("SUPABASE_URL")}/rest/v1/ai_usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!ins.ok) console.log("[ai-usage] simpan gagal:", ins.status, (await ins.text()).slice(0, 200));
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_TELEGRAM_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN");
const ADMIN_WHATSAPP_NUMBER = "082279142894";

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MESSAGES_PER_DAY = 20;
const MAX_MESSAGES_PER_DAY_ENTERPRISE = 60;
const MAX_MESSAGES_PER_DAY_PER_IP = 60;
const ESCALATE_MARKER = "[ESKALASI]";

const KNOWLEDGE_BASE = `
NEXTO adalah AI Sales Loop Engine - CRM untuk tim sales Indonesia, dibangun langsung oleh mantan salesperson.

PAKET & HARGA (per bulan; harga early bird berlaku sampai 15 Oktober 2026; tersedia juga paket 3 bulan):
- Free: gratis, fitur CRM dasar (belum termasuk AI).
- Standard: Rp89rb/bulan (early bird Rp59rb/bulan), paket 3 bulan Rp267rb (early bird Rp177rb). Fitur: kelola leads per perusahaan, integrasi MCP ke Grok Bot, Smart Import, Vector Memory, Recycle Bin, deteksi duplikat, komunitas Nex sesama sales, Daily Digest (rekomendasi harian), Rapihin Data, Visit & Follow-up, Meeting Prep, Advisor harian, NEX Pro (update lead pakai voice note, 25x/bulan).
- Professional: Rp249rb/bulan (early bird Rp229rb/bulan), paket 3 bulan Rp747rb (early bird Rp687rb). Semua fitur Standard, PLUS: kuota NEX Pro 150x/bulan, sinkron otomatis Google Calendar, Generate Leads AI, rekam meeting otomatis, Customer State, Outcome Memory, Pipeline Review otomatis, draft follow-up AI (WhatsApp & Email), data kompetitor.
- Enterprise: Rp1.116.000/bulan untuk 4 orang dalam 1 organisasi (Rp279rb/orang; early bird Rp996.000/bulan = Rp249rb/orang), paket 3 bulan Rp3.348.000 (early bird Rp2.988.000). Semua fitur Professional, PLUS: GPS check-in (tracking kunjungan team), Ringkasan Kebutuhan Klien oleh AI dari notulen (15x/bulan per anggota), Katalog Produk & Layanan (AI merekomendasikan produk yang cocok untuk tiap prospek, maksimal 8 produk), role-based visibility (Owner/Manager/Sales Rep), assign & filter lead per anggota, tab Team (rekap aktivitas tiap sales, grafik 7 hari, leaderboard revenue & win rate), kontrak & termin pembayaran per lead (Booking - Revenue - Cash In, pengingat jatuh tempo otomatis), target bulanan per sales + forecast closing, laporan mingguan team otomatis ke email owner/manager tiap Senin, sistem komisi team, undang anggota via kode invite, approval-gate (hapus lead & export data butuh persetujuan owner/manager), prioritas support.

BOT TELEGRAM: sudah tidak tersedia. Penggantinya NEX Pro - update lead, catatan progress, dan jadwal cukup dengan voice note langsung dari app Nexto (tombol mikrofon), tersedia mulai paket Standard.

TIM LEBIH DARI 4 ORANG: paket Enterprise standar untuk 4 orang. Untuk tim 5 orang ke atas, harganya custom dan harus dibicarakan langsung dengan tim Nexto. Jangan pernah menebak angka harga custom.

INDUSTRI YANG DIDUKUNG: template dan rekomendasi AI sudah disesuaikan untuk PVC/kimia (manufaktur), otomotif/dealer, properti, asuransi/financial services, retail/FMCG, corporate consultant (jasa berbasis project/SPK), dan template umum B2B/distributor.

CARA MULAI: buat akun gratis (tanpa kartu kredit untuk Free). Upgrade ke Standard/Professional/Enterprise dibayar lewat Mayar (link pembayaran resmi muncul saat klik tombol upgrade di app).

KEAMANAN DATA (5 lapis):
1. Dipantau AI 24 jam - sistem internal mengecek kesehatan & keamanan platform beberapa kali sehari dan langsung memberi tahu tim bila ada yang janggal.
2. Login aman berlapis - 2FA dengan app authenticator plus 10 kode cadangan sekali pakai.
3. Data terisolasi & terenkripsi - Row Level Security memastikan data satu organisasi tidak bisa diakses organisasi lain; data terenkripsi saat disimpan dan saat dikirim (TLS).
4. Kredensial tidak pernah ke browser - kunci sensitif hanya ada di server Nexto.
5. Audit log & backup berkala - perubahan sensitif tercatat dan database di-backup otomatis.
Data lead/progress tetap milik user dan tidak pernah dijual. Sebagian fitur AI mengirim data relevan ke Anthropic (Claude) & OpenAI untuk diproses - dijelaskan di Kebijakan Privasi.
`.trim();

async function callClaude(history, enterpriseCtx) {
  const systemPrompt = `Kamu SASA, customer support AI Nexto (CRM untuk sales Indonesia). Jawab HANYA berdasarkan fakta di bawah ini. Gunakan Bahasa Indonesia yang ramah dan profesional, sapa lawan bicara dengan "Anda" (jangan pakai "kamu", "gak", "udah", "banget"). Jawaban ringkas (maksimal 80 kata per balasan, kecuali soal keamanan data boleh sedikit lebih panjang).

${KNOWLEDGE_BASE}
${enterpriseCtx ? `
KONTEKS PENTING: yang sedang chat adalah PELANGGAN ENTERPRISE (organisasi "${enterpriseCtx.orgName}"). Pelanggan Enterprise mendapat prioritas support: untuk kendala teknis, masalah akun/tagihan, atau permintaan apa pun yang tidak bisa kamu jawab pasti dari data di atas, LANGSUNG eskalasi (tanpa menunda) dan sampaikan bahwa tim Nexto akan memprioritaskan permintaan mereka. Kontak mereka sudah tercatat, jadi tidak perlu meminta email lagi kecuali mereka ingin dihubungi lewat kontak lain.
` : ""}
ATURAN PENTING:
- JANGAN pakai markdown sama sekali (tidak ada **, #, -, dst) - ini chat widget polos.
- JANGAN pernah mengarang fitur, harga, atau klaim yang tidak ada di data di atas.
- Kalau ditanya soal keamanan/privasi data, jawab dengan poin-poin KEAMANAN DATA yang paling relevan.
- Kalau ditanya soal TIM LEBIH DARI 4 ORANG, SELALU eskalasi dan tanyakan jumlah orangnya (kalau belum disebut).
- Kalau pertanyaannya di luar cakupan data di atas (keluhan teknis, request custom, negosiasi harga, tim > 4 orang, atau minta bicara dengan manusia), balas dengan awalan PERSIS "${ESCALATE_MARKER}" diikuti pesan singkat bahwa tim Nexto akan menindaklanjuti, dan minta kontak (email atau WhatsApp) kalau belum ada.
- Kalau kontak sudah diberikan sebelumnya untuk eskalasi yang sama, jangan minta lagi - cukup konfirmasi akan ditindaklanjuti.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 500,
      thinking: { type: "between_tools" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API gagal (${resp.status})`);
  const dat = await resp.json();
  console.log("[customer-chat] USAGE", JSON.stringify(dat.usage));
  return (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

function extractContact(text) {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const wa = text.match(/(?:\+?62|0)8[0-9]{8,12}/)?.[0];
  return [email, wa].filter(Boolean).join(" / ") || null;
}

async function sendTelegramAlert(text) {
  if (!ADMIN_TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    console.log("[customer-chat] Telegram exception:", String(e));
  }
}

// Notif WA lewat Fonnte - best effort, gak boleh throw.
async function sendWhatsappAlert(text) {
  if (!FONNTE_TOKEN) return;
  try {
    const resp = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: FONNTE_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ target: ADMIN_WHATSAPP_NUMBER, message: text }),
    });
    if (!resp.ok) console.log("[customer-chat] Fonnte WA gagal:", resp.status, await resp.text());
  } catch (e) {
    console.log("[customer-chat] Fonnte WA exception:", String(e));
  }
}

async function notifyEscalation(sessionId, fullHistory, enterpriseCtx) {
  const contact = enterpriseCtx?.email || extractContact(fullHistory.map((m) => m.content).join(" "));
  const transcript = fullHistory.slice(-6).map((m) => `${m.role === "user" ? "Visitor" : "SASA"}: ${m.content}`).join("\n");
  const header = enterpriseCtx
    ? `PRIORITAS ENTERPRISE - ${enterpriseCtx.orgName} (${enterpriseCtx.email}) butuh bantuan:`
    : "SASA eskalasi 1 percakapan customer (widget chat):";
  const text = `${header}\n\n${transcript}\n\nKontak: ${contact || "belum diberikan"}\n\nSession: ${sessionId}`;
  await Promise.all([sendTelegramAlert(text), sendWhatsappAlert(text)]);
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Kalau request bawa JWT user login dari org Enterprise, balikin konteksnya
// (nama org + email). Selain itu null - widget publik tetap jalan normal.
async function getEnterpriseContext(req, admin) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return null;
    const { data: member } = await admin.from("organization_members").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!member) return null;
    const { data: org } = await admin.from("organizations").select("name, plan").eq("id", member.org_id).maybeSingle();
    if (org?.plan !== "enterprise") return null;
    return { orgName: org.name || "Organisasi Enterprise", email: user.email || "" };
  } catch (_) {
    return null;
  }
}

Deno.serve((req) => AI_CTX.run({ req }, async () => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { sessionId, message } = await req.json();
    if (!sessionId || !message || typeof message !== "string" || message.length > 1000) {
      return new Response(JSON.stringify({ error: "Input tidak valid" }), { status: 400, headers: CORS });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const enterpriseCtx = await getEnterpriseContext(req, admin);
    const clientIp = getClientIp(req);
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

    const { count: todayCount } = await admin
      .from("landing_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("role", "user")
      .gte("created_at", todayStart);
    const dailyMax = enterpriseCtx ? MAX_MESSAGES_PER_DAY_ENTERPRISE : MAX_MESSAGES_PER_DAY;
    if ((todayCount ?? 0) >= dailyMax) {
      return new Response(JSON.stringify({ reply: "Batas pertanyaan hari ini sudah tercapai. Silakan coba lagi besok, atau hubungi kami langsung lewat WhatsApp untuk respons lebih cepat.", escalated: false }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Lapisan kedua - per IP (gak bisa dipalsuin dari browser kayak
    // session_id). User Enterprise login gak kena limit IP ini (bisa aja
    // satu kantor pakai satu IP).
    if (clientIp !== "unknown" && !enterpriseCtx) {
      const { count: ipCount } = await admin
        .from("landing_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", clientIp)
        .eq("role", "user")
        .gte("created_at", todayStart);
      if ((ipCount ?? 0) >= MAX_MESSAGES_PER_DAY_PER_IP) {
        return new Response(JSON.stringify({ reply: "Batas pertanyaan dari koneksi ini untuk hari ini sudah tercapai. Silakan coba lagi besok, atau hubungi kami langsung lewat WhatsApp.", escalated: false }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    const { data: pastMessages } = await admin
      .from("landing_chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = [...(pastMessages || []), { role: "user", content: message }];
    const rawReply = await callClaude(history, enterpriseCtx);
    const escalated = rawReply.startsWith(ESCALATE_MARKER);
    const reply = escalated ? rawReply.slice(ESCALATE_MARKER.length).trim() : rawReply;

    await admin.from("landing_chat_messages").insert([
      { session_id: sessionId, role: "user", content: message, escalated: false, client_ip: clientIp },
      { session_id: sessionId, role: "assistant", content: reply, escalated },
    ]);

    if (escalated) {
      await notifyEscalation(sessionId, [...history], enterpriseCtx);
    }

    return new Response(JSON.stringify({ reply, escalated, priority: !!enterpriseCtx }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
}));
