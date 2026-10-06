// Supabase Edge Function: guess-outcome-reason
//
// === SECRET DIPINDAH KE VAULT (28 Sep 2026) ===
// Sebelumnya secret HMAC trigger->function ini ada sebagai FALLBACK HARDCODED
// di source (dan nempel juga di badan fungsi trigger DB). Sekarang nilainya
// acak-baru & cuma ada di Supabase Vault (nama: outcome_guess_secret) -
// dibaca lewat RPC get_webhook_secret (khusus service_role). Gak ada lagi env
// OUTCOME_GUESS_SECRET & gak ada fallback: kalau secret gak bisa diambil,
// jalur trigger dianggap TIDAK valid (jatuh ke jalur login user biasa).
//
// === MODEL (29 Sep 2026) === Sonnet 4.6 -> Sonnet 5.5 (lebih murah), tanpa
// "mikir di awal" (between_tools) - tugasnya klasifikasi pendek.
//
// === BAHASA BAKU (1 Okt 2026) ===
// Pesan ke user & alasan hasil AI pakai bahasa baku. Kategori "Gak ada
// budget/kebutuhan" -> "Tidak ada anggaran/kebutuhan" (samain dengan
// REASON_CATEGORIES di LeadModal.jsx). Kuota dikembalikan kalau AI gagal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "guess-outcome-reason";
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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REPLAY_WINDOW_SECONDS = 300;

async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function getVaultSecret(admin, name) {
  const { data, error } = await admin.rpc("get_webhook_secret", { p_name: name });
  if (error) { console.log("[guess-outcome-reason] gagal ambil secret dari Vault:", String(error.message || error)); return null; }
  return data || null;
}

// Balikin id baris pemakaian (buat dihapus lagi kalau AI gagal), atau null
// kalau kuota habis. Lewat reserve_edge_function_call (atomic) - periodenya
// 1 bulan sejak pemakaian pertama (quota_periods, 6 Okt 2026).
async function reserveMonthly(admin, userId, functionName, maxCalls) {
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: new Date(Date.now() - 86400000).toISOString(), p_max_calls: maxCalls });
  if (error) { console.error("[guess-outcome-reason] reserve_edge_function_call gagal:", error); return null; }
  return data || null;
}

async function releaseMonthly(admin, id) {
  if (!id || id === "reserved") return;
  try { await admin.from("edge_function_calls").delete().eq("id", id); } catch (_) { /* best effort */ }
}

const REASON_CATEGORIES = ["Harga", "Timing", "Kompetitor", "Tidak ada anggaran", "Tidak ada kebutuhan", "Kualitas/spek", "Respons lambat", "Lainnya"];

Deno.serve((req) => AI_CTX.run({ req }, async () => {
  const cors = { "Access-Control-Allow-Origin": "https://nexto.site", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let admin = null;
  let usageId = null;
  try {
    const { lead_id, result } = await req.json();
    if (!lead_id || !["won", "lost"].includes(result)) {
      return new Response(JSON.stringify({ error: "lead_id dan result (won/lost) wajib diisi" }), { status: 400, headers: cors });
    }

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let isTriggerCall = false;
    const tsHeader = req.headers.get("x-webhook-ts");
    const sigHeader = req.headers.get("x-webhook-sig");
    if (tsHeader && sigHeader) {
      const tsNum = Number(tsHeader);
      const nowSec = Math.floor(Date.now() / 1000);
      if (Number.isFinite(tsNum) && Math.abs(nowSec - tsNum) <= REPLAY_WINDOW_SECONDS) {
        const secret = await getVaultSecret(admin, "outcome_guess_secret");
        if (secret) {
          const expectedSig = await hmacHex(secret, `${lead_id}:${tsHeader}`);
          isTriggerCall = safeEqual(expectedSig, sigHeader);
        }
      }
    }

    let userId;
    let db;

    if (isTriggerCall) {
      const { data: leadOwner } = await admin.from("leads").select("assigned_to").eq("id", lead_id).maybeSingle();
      if (!leadOwner?.assigned_to) {
        console.log("[guess-outcome-reason] auto-skip, lead/assigned_to gak ketemu:", lead_id);
        return new Response(JSON.stringify({ ok: true, skipped: "no assigned_to" }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      userId = leadOwner.assigned_to;
      aiSetUser(userId);
      db = admin;
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
      userId = userData.user.id;
      db = supabase;
    }

    const { data: settingsRow } = await admin.from("settings").select("plan").eq("user_id", userId).maybeSingle();
    const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
    let orgPlan = null;
    if (memberRow) {
      const { data: org } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
      orgPlan = org?.plan;
    }
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const myPlanLevel = orgPlan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (myPlanLevel < 2) {
      if (isTriggerCall) return new Response(JSON.stringify({ ok: true, skipped: "plan bukan Professional+" }), { headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Fitur ini tersedia untuk paket Professional ke atas. Silakan upgrade di tab Pengaturan, atau isi secara manual." }), { status: 403, headers: cors });
    }

    const { data: lead, error: leadErr } = await db.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", lead_id).single();
    if (leadErr || !lead) return new Response(JSON.stringify({ error: "Lead tidak ditemukan" }), { status: 404, headers: cors });

    if (isTriggerCall && lead.outcome?.reason_category) {
      console.log("[guess-outcome-reason] auto-skip, outcome udah keisi manual:", lead_id);
      return new Response(JSON.stringify({ ok: true, skipped: "outcome sudah ada" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Tanpa catatan progress gak ada yang dianalisis - jawab tanpa motong kuota.
    const notes = (lead.progress_notes || []).slice(-8).map((p) => `${p.note_date}: ${(p.text || "").slice(0, 200)}`);
    if (notes.length === 0) {
      const fallback = { reason_category: "Lainnya", reason: "Belum ada catatan progress untuk dianalisis - silakan isi secara manual." };
      if (isTriggerCall) {
        await admin.from("leads").update({ outcome: { ...fallback, source: "ai_auto", computed_at: new Date().toISOString() } }).eq("id", lead_id);
      }
      return new Response(JSON.stringify(fallback), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    usageId = await reserveMonthly(admin, userId, "guess-outcome-reason", 15);
    if (!usageId) {
      if (isTriggerCall) {
        console.log("[guess-outcome-reason] auto-skip, jatah 15x/bulan udah abis buat user:", userId);
        return new Response(JSON.stringify({ ok: true, skipped: "rate limited (15x/bulan)" }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: `Kuota tebak alasan (15x per bulan) sudah terpakai. ${await quotaRefillText(admin, userId, "guess-outcome-reason")} Silakan isi secara manual.` }), { status: 429, headers: cors });
    }

    const resultWord = result === "won" ? "MENANG (deal closed)" : "KALAH (lost/tidak jadi)";
    const prompt = `Kamu analis sales. Lead ini status akhirnya ${resultWord}. Baca histori progress notes-nya, terus tebak alasan paling mungkin kenapa hasilnya begitu.

Progress notes:
${notes.join("\n")}

Customer/perusahaan: ${lead.name}, produk: ${lead.product || "-"}

Pilih SATU kategori paling cocok dari daftar ini: ${JSON.stringify(REASON_CATEGORIES)}
Terus kasih alasan singkat (1 kalimat, spesifik berdasar isi notes di atas, bukan generik), dalam Bahasa Indonesia baku yang profesional.

Balas HANYA JSON, tanpa markdown: {"reason_category":"...","reason":"..."}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 400, thinking: { type: "between_tools" }, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) {
      if (isTriggerCall) console.log("[guess-outcome-reason] auto-guess AI gagal, status", resp.status);
      await releaseMonthly(admin, usageId);
      return new Response(JSON.stringify({ error: "AI gagal menebak alasan. Kuota Anda tidak terpakai, silakan isi secara manual." }), { status: 500, headers: cors });
    }
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }

    const finalResult = {
      reason_category: REASON_CATEGORIES.includes(obj.reason_category) ? obj.reason_category : "Lainnya",
      reason: obj.reason || "",
    };

    if (isTriggerCall) {
      await admin.from("leads").update({ outcome: { ...finalResult, source: "ai_auto", computed_at: new Date().toISOString() } }).eq("id", lead_id);
      console.log("[guess-outcome-reason] auto-guess selesai buat", lead_id, "->", finalResult.reason_category);
    }

    return new Response(JSON.stringify(finalResult), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    if (admin) await releaseMonthly(admin, usageId);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
}));
