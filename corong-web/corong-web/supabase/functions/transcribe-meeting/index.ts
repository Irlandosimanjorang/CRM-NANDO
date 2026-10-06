// Supabase Edge Function: transcribe-meeting
// Terima path audio meeting yang udah diupload ke storage, transkrip pake Whisper,
// terus minta Claude rapiin jadi catatan meeting yang terstruktur. Audio dihapus
// dari storage abis selesai diproses (ga nyimpen rekaman mentah selamanya).
//
// Tier gate Professional+ (Enterprise ikut level 2), kuota 8x/bulan (6 Okt 2026, dulu 10x) per
// user dengan reservasi atomic - kuota dikembalikan kalau proses gagal.
//
// === AUDIT ISTILAH INDUSTRI (30 Sep 2026) ===
// Prompt ringkasan sebelumnya ditulis mati "industri PVC Indonesia" (contoh
// next action "kirim sample") buat SEMUA org - sekarang pakai konteks industri
// org masing-masing. Sekalian fix releaseSlot (`.catch()` di hasil rpc() bikin
// pengembalian kuota error sendiri) dan pesan error pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "transcribe-meeting";
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

// Kuota bulanan berlaku 1 bulan sejak pemakaian pertama (6 Okt 2026, tabel
// quota_periods) - bukan lagi reset tiap tanggal 1. reserve_edge_function_call
// menghitung periodenya sendiri; helper ini untuk menampilkan tanggal terisi
// kembali di pesan kuota habis.
async function quotaRefillText(admin, userId, feature) {
  try {
    const { data } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: feature });
    if (data?.reset_at) return `Kuota terisi kembali pada ${new Date(data.reset_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}.`;
  } catch (_) { /* pesan tanpa tanggal */ }
  return "Kuota terisi kembali 1 bulan setelah pemakaian pertama.";
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

// Duplikat ringan dari src/lib/industryTemplates.js (Deno beda runtime).
// `example` = contoh next action yang wajar buat industri itu.
const INDUSTRY = {
  pvc_chemical: { ctx: "distribusi/manufaktur PVC dan bahan kimia industri", example: "kirim sample kompon minggu depan" },
  automotive: { ctx: "dealer kendaraan mobil/motor", example: "kirim simulasi kredit ke Pak Andi" },
  property: { ctx: "agen/developer properti", example: "jadwalkan viewing unit contoh hari Sabtu" },
  b2b_general: { ctx: "distributor/trading B2B umum", example: "kirim quotation revisi minggu depan" },
  insurance: { ctx: "agen asuransi/financial services", example: "kirim ilustrasi polis ke Bu Rina" },
  retail_fmcg: { ctx: "distribusi retail/FMCG", example: "kirim daftar harga grosir ke pemilik toko" },
  corporate_consultant: { ctx: "konsultan/kontraktor jasa berbasis project untuk perusahaan (proposal, SPK, scope of work, termin pembayaran)", example: "kirim revisi proposal dan draft SPK minggu depan" },
};
const industryInfo = (key) => INDUSTRY[key] || INDUSTRY.b2b_general;

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}

async function reserveMonthlySlot(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[transcribe-meeting] reserve_edge_function_call gagal:", error); return null; }
  return data;
}
async function releaseSlot(admin, reservationId) {
  if (!reservationId) return;
  try {
    const { error } = await admin.rpc("release_edge_function_call", { p_id: reservationId });
    if (error) console.error("[transcribe-meeting] gagal release slot:", error);
  } catch (e) {
    console.error("[transcribe-meeting] gagal release slot:", e);
  }
}
async function removeAudio(admin, path) {
  if (!path) return;
  try { await admin.storage.from("meeting-audio").remove([path]); } catch (_) { /* best effort */ }
}

// Format audio (2 Okt 2026): Whisper membaca format dari ekstensi nama file.
// Chrome/Android merekam WebM, Safari/iPhone merekam MP4 - nama file
// sekarang mengikuti ekstensi path di storage (dulu selalu .webm, sehingga
// rekaman iPhone berisiko gagal ditranskrip).
const AUDIO_EXT = ["webm", "m4a", "mp4", "ogg", "wav", "mp3"];
const audioFileName = (path) => {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return `meeting.${AUDIO_EXT.includes(ext) ? ext : "webm"}`;
};

async function transcribeAudio(audioBlob, path) {
  const form = new FormData();
  form.append("file", audioBlob, audioFileName(path));
  form.append("model", "whisper-1");
  form.append("language", "id");
  form.append("response_format", "verbose_json"); // berisi durasi audio untuk pencatatan biaya
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Whisper error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return (data.text || "").trim();
}

function parseObj(t) {
  let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); if (a !== -1) x = x.slice(a);
  const end = x.lastIndexOf("}");
  if (end !== -1) { try { return JSON.parse(x.slice(0, end + 1)); } catch (_) {} }
  return null;
}

async function summarizeMeeting(transcript, leadName, industryKey) {
  const ind = industryInfo(industryKey);
  const prompt = `Ini transkrip rekaman meeting sales dengan calon customer "${leadName || "customer"}" di bisnis ${ind.ctx}, di Indonesia. Tugas kamu:

1. Rapikan jadi catatan meeting yang terstruktur dan mudah dibaca, isinya:
   - Ringkasan poin-poin penting yang dibahas
   - Kebutuhan/concern customer (kalau disebut)
   - Kesepakatan yang muncul (kalau ada)
2. Ekstrak SATU next action/rencana lanjutan yang paling konkret yang disebut di meeting (misal "${ind.example}"). Kalau memang TIDAK ADA next step yang jelas disebut di percakapan, kosongkan saja - JANGAN karang.

Tulis dalam Bahasa Indonesia baku yang profesional, pakai istilah yang lazim di bisnis ini. Notes ringkas tapi lengkap, pakai bullet point. JANGAN karang informasi yang tidak ada di transkrip - kalau transkripnya kurang jelas/pendek, sampaikan apa adanya.

Balas HANYA JSON, tanpa markdown, persis format ini:
{"notes": "<catatan meeting lengkap>", "next_action": "<next step singkat 1 kalimat, atau string kosong kalau tidak ada>"}

Transkrip:
"""${transcript}"""`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 6000, thinking: { type: "adaptive" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude API ${resp.status}`);
  const dat = await resp.json();
  console.log("[transcribe-meeting] USAGE", JSON.stringify(dat.usage), "transcript_chars:", transcript.length);
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const parsed = parseObj(t);
  if (parsed && typeof parsed.notes === "string") return parsed;
  // Fallback kalau AI gagal balas format JSON - tetep kasih notes-nya aja
  return { notes: t, next_action: "" };
}

Deno.serve((req) => AI_CTX.run({ req }, async () => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let admin = null;
  let reservationId = null;
  let storagePath = null;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const [{ data: gateMemberRow }, { data: gateSettingsRow }] = await Promise.all([
      supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle(),
      supabase.from("settings").select("plan").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    const gateOrgResult = gateMemberRow ? await supabase.from("organizations").select("plan, industry").eq("id", gateMemberRow.org_id).maybeSingle() : { data: null };
    const GATE_PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const gateIsEnterprise = gateOrgResult.data?.plan === "enterprise";
    const gateMyPlanLevel = gateIsEnterprise ? 2 : (GATE_PLAN_LEVEL[gateSettingsRow?.plan] ?? 0);
    if (gateMyPlanLevel < 2) {
      return new Response(JSON.stringify({ error: "Rekam Meeting otomatis (AI) tersedia untuk paket Professional ke atas. Silakan upgrade melalui tab Pengaturan." }), { status: 403, headers: cors });
    }
    const industryKey = gateOrgResult.data?.industry || "b2b_general";

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const MAX_CALLS = 8;
    reservationId = await reserveMonthlySlot(admin, userData.user.id, "transcribe-meeting", MAX_CALLS);
    if (!reservationId) {
      return new Response(JSON.stringify({ error: `Kuota Rekam Meeting (${MAX_CALLS}x per bulan) sudah terpakai. ${await quotaRefillText(admin, userData.user.id, "transcribe-meeting")} Sementara itu, Anda dapat mencatat secara manual.` }), { status: 429, headers: cors });
    }

    const body = await req.json();
    storagePath = body.storagePath;
    const leadName = body.leadName;
    if (!storagePath) {
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "storagePath kosong" }), { status: 400, headers: cors });
    }

    // OWNERSHIP CHECK - storagePath HARUS di bawah folder milik user ini.
    if (!storagePath.startsWith(`${userData.user.id}/`)) {
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "File audio bukan milik akun Anda" }), { status: 403, headers: cors });
    }

    const { data: fileBlob, error: dlErr } = await admin.storage.from("meeting-audio").download(storagePath);
    if (dlErr) {
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "Gagal mengambil file audio: " + dlErr.message }), { status: 500, headers: cors });
    }

    if (fileBlob.size > MAX_AUDIO_BYTES) {
      await removeAudio(admin, storagePath);
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: `Rekaman terlalu panjang/besar (maks ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB). Silakan pecah menjadi beberapa rekaman yang lebih pendek.` }), { status: 413, headers: cors });
    }

    const transcript = await transcribeAudio(fileBlob, storagePath);
    if (!transcript) {
      await removeAudio(admin, storagePath);
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "Suara tidak terdengar jelas atau audio kosong. Kuota Anda tidak terpakai." }), { status: 422, headers: cors });
    }

    const [{ notes, next_action }] = await Promise.all([
      summarizeMeeting(transcript, leadName, industryKey),
      removeAudio(admin, storagePath),
    ]);

    // Sampe sini berarti SUKSES - reservasi slot TETEP kepake.
    return new Response(JSON.stringify({ transcript, notes, next_action: next_action || "" }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    if (admin && reservationId) await releaseSlot(admin, reservationId);
    if (admin && storagePath) await removeAudio(admin, storagePath);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
}));
