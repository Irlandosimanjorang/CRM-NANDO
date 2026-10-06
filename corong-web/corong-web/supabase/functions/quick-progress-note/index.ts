// Supabase Edge Function: quick-progress-note
// Voice command dari NEX Pro (modal QuickVoiceNoteModal.jsx). Function ini
// CUMA mengklasifikasi (Whisper transkrip + Claude nentuin aksi + field-nya),
// TIDAK PERNAH nulis ke DB - hasilnya balik ke frontend buat DIREVIEW MANUAL
// dulu, baru dieksekusi via db.js pas user tap Simpan.
//
// TIER + KUOTA: Standard 25x/bulan, Professional/Enterprise 150x/bulan
// (1 bulan sejak pemakaian pertama, lihat quota_periods). Mode `checkQuotaOnly` (tanpa audio) buat nampilin sisa
// jatah tanpa motong kuota.
//
// === AUDIT ISTILAH INDUSTRI (30 Sep 2026) ===
// Prompt klasifikasi sebelumnya ditulis mati "industri PVC/kimia" buat SEMUA
// org - sekarang pakai konteks industri org masing-masing. Sekalian fix
// releaseSlot: `.catch()` langsung di hasil rpc() (builder PostgREST gak
// punya .catch) bikin pengembalian kuota error sendiri - diganti try/await.
// Pesan error ke user pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "quick-progress-note";
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
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // voice command pendek (maks 3 menit di frontend)
const QUOTA_STANDARD = 25;
const QUOTA_PROFESSIONAL = 150;

// Duplikat ringan dari src/lib/industryTemplates.js (Deno beda runtime).
const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri (istilah: tonase, resin, kompon, sample, PO)",
  automotive: "dealer kendaraan mobil/motor (istilah: test drive, unit, DP, cicilan, trade-in, booking)",
  property: "agen/developer properti (istilah: viewing, booking fee, KPR, unit, luas tanah/bangunan)",
  b2b_general: "distributor/trading B2B umum (istilah: quotation, PO, sample, reorder)",
  insurance: "agen asuransi/financial services (istilah: premi, polis, nasabah, nilai pertanggungan)",
  retail_fmcg: "distribusi retail/FMCG (istilah: outlet, karton, repeat order, distributor area)",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project untuk perusahaan (istilah: proposal, quotation, SPK, scope of work, termin pembayaran, invoice, kickoff, deliverable)",
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.b2b_general;

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function wibNowLabel(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const dateStr = `${HARI[wibNow.getUTCDay()]}, ${wibNow.getUTCDate()} ${BULAN[wibNow.getUTCMonth()]} ${wibNow.getUTCFullYear()}`;
  const isoDate = `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, "0")}-${String(wibNow.getUTCDate()).padStart(2, "0")}`;
  return { dateStr, isoDate };
}

async function reserveMonthlySlot(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[quick-progress-note] reserve_edge_function_call gagal:", error); return null; }
  return data;
}
async function releaseSlot(admin, reservationId) {
  if (!reservationId) return;
  try {
    const { error } = await admin.rpc("release_edge_function_call", { p_id: reservationId });
    if (error) console.error("[quick-progress-note] gagal release slot:", error);
  } catch (e) {
    console.error("[quick-progress-note] gagal release slot:", e);
  }
}
async function removeAudio(admin, path) {
  if (!path) return;
  try { await admin.storage.from("meeting-audio").remove([path]); } catch (_) { /* best effort */ }
}
// Pemakaian periode berjalan (1 bulan sejak pemakaian pertama) + tanggal
// kuota terisi kembali.
async function getQuotaUsage(admin, userId, functionName) {
  const { data, error } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: functionName });
  if (error) { console.error("[quick-progress-note] getQuotaUsage gagal:", error); return { used: 0, reset_at: null }; }
  return { used: data?.used || 0, reset_at: data?.reset_at || null };
}

// Format audio (2 Okt 2026): Whisper membaca format dari ekstensi nama file.
// Chrome/Android merekam WebM, Safari/iPhone merekam MP4 - nama file
// sekarang mengikuti ekstensi path di storage (dulu selalu .webm, sehingga
// rekaman iPhone berisiko gagal ditranskrip).
const AUDIO_EXT = ["webm", "m4a", "mp4", "ogg", "wav", "mp3"];
const audioFileName = (path) => {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return `quicknote.${AUDIO_EXT.includes(ext) ? ext : "webm"}`;
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

async function classifyVoiceCommand(transcript, leads, dateLabel, industryKey) {
  // Hemat token (6 Okt 2026): lead dikirim dengan nomor urut pendek, bukan UUID
  // 36 karakter; nomor dipetakan balik ke id asli setelah AI menjawab.
  const leadList = leads.map((l, i) => `${i + 1}|${l.name}|${l.key_person || ""}`).join("\n");
  const prompt = `Ini transkrip voice note singkat dari sales lapangan di bisnis ${industryContext(industryKey)}, di Indonesia. Tanggal SEKARANG: ${dateLabel.dateStr} (${dateLabel.isoDate}), pakai ini buat mikirin tanggal relatif ("besok", "minggu depan", dst).

Daftar lead org ini (format: nomor|nama|kontak utama):
${leadList}

Tentuin SATU aksi yang paling sesuai maksud user dari pilihan ini:
- "update_lead": update info lead yang SUDAH ADA di daftar (jadwal visit, next action, progress, kontak, dll) - INI DEFAULT kalau user cuma cerita update/progress biasa tanpa maksud lain yang eksplisit.
- "close_lead": user bilang deal ini udah MENANG (deal/closing/PO masuk/kontrak/SPK) atau KALAH (batal/hilang/gak jadi) secara PERMANEN.
- "create_lead": user cerita ada calon customer BARU yang belum ada di daftar lead di atas.
- "delete_lead": user EKSPLISIT minta hapus/buang lead ini dari CRM.
- "send_email": user EKSPLISIT minta kirim/email-in follow-up ke lead ini SEKARANG.

Balas HANYA JSON, tanpa markdown, PERSIS struktur ini (isi cuma field yang relevan sama aksi yang dipilih, field lain biarin default kayak contoh):
{
  "action": "update_lead",
  "lead_id": "<NOMOR dari daftar di atas, atau null kalau gak ada yang cukup yakin cocok / action create_lead>",
  "confidence": "high",
  "progress_note": "<ringkasan info baru dari transkrip INI SAJA, bahasa Indonesia baku yang rapi, pakai istilah bisnis di atas, buang basa-basi/pengulangan - kosongkan kalau gak ada info baru buat dicatet>",
  "updates": { "visit_date": null, "visit_agenda": null, "visit_meet": null, "next_action": null, "phone": null, "email": null, "website": null, "key_person": null, "key_person_title": null, "product": null, "city": null, "priority": null },
  "cancel_visit": false,
  "result": null,
  "new_lead": { "name": null, "category": null, "phone": null, "email": null, "website": null, "key_person": null, "key_person_title": null, "product": null, "city": null }
}

ATURAN:
- updates.visit_date format YYYY-MM-DD (hitung dari tanggal sekarang di atas kalau user nyebut relatif), atau null kalau gak disebut.
- updates.priority cuma salah satu dari "high"/"medium"/"low", atau null.
- cancel_visit true CUMA kalau user eksplisit minta BATALIN jadwal (bukan pindah tanggal - itu masuk updates.visit_date biasa).
- result cuma diisi "won" atau "lost" kalau action close_lead.
- new_lead cuma diisi kalau action create_lead, name WAJIB ada.
- JANGAN karang info yang gak ada/gak tersirat di transkrip.

Transkrip: """${transcript}"""`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude API ${resp.status}`);
  const dat = await resp.json();
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const parsed = parseObj(t);
  if (parsed && typeof parsed.action === "string") {
    // Petakan nomor urut kembali ke id lead asli (nomor di luar daftar = tidak
    // cocok). Hanya angka murni yang diterima; kalau AI tetap membalas UUID,
    // terima hanya bila UUID itu memang ada di daftar.
    const raw = String(parsed.lead_id ?? "").trim();
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10);
      parsed.lead_id = n >= 1 && n <= leads.length ? leads[n - 1].id : null;
    } else {
      parsed.lead_id = leads.some((l) => l.id === raw) ? raw : null;
    }
    return parsed;
  }
  // Fallback kalau AI gagal balas format JSON - transkrip mentah jadi
  // progress note biasa, user masih bisa pilih lead manual & edit.
  return { action: "update_lead", lead_id: null, confidence: "low", progress_note: transcript, updates: {}, cancel_visit: false, result: null, new_lead: null };
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
    if (gateMyPlanLevel < 1) {
      return new Response(JSON.stringify({ error: "NEX Pro (voice) tersedia untuk paket Standard ke atas. Silakan upgrade melalui tab Pengaturan." }), { status: 403, headers: cors });
    }
    const monthlyMax = gateMyPlanLevel >= 2 ? QUOTA_PROFESSIONAL : QUOTA_STANDARD;
    const industryKey = gateOrgResult.data?.industry || "b2b_general";

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();

    if (body.checkQuotaOnly) {
      const { used, reset_at } = await getQuotaUsage(admin, userData.user.id, "quick-progress-note");
      return new Response(JSON.stringify({ used, max: monthlyMax, reset_at }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    reservationId = await reserveMonthlySlot(admin, userData.user.id, "quick-progress-note", monthlyMax);
    if (!reservationId) {
      return new Response(JSON.stringify({ error: `Kuota NEX Pro (${monthlyMax}x per bulan) sudah terpakai. ${await quotaRefillText(admin, userData.user.id, "quick-progress-note")} Sementara itu, Anda dapat mencatat manual di tab Leads.` }), { status: 429, headers: cors });
    }

    storagePath = body.storagePath;
    if (!storagePath) {
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "storagePath kosong" }), { status: 400, headers: cors });
    }
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
      return new Response(JSON.stringify({ error: `Rekaman terlalu besar (maks ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB). NEX Pro untuk catatan singkat, bukan rekaman meeting panjang.` }), { status: 413, headers: cors });
    }

    const transcript = await transcribeAudio(fileBlob, storagePath);
    if (!transcript) {
      await removeAudio(admin, storagePath);
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: "Suara tidak terdengar jelas atau audio kosong. Kuota Anda tidak terpakai." }), { status: 422, headers: cors });
    }

    // RLS otomatis nge-filter ke lead org sendiri doang.
    const { data: leads } = await supabase.from("leads").select("id, name, key_person").order("last_contact", { ascending: false }).limit(200);

    const dateLabel = wibNowLabel();
    const [classified] = await Promise.all([
      classifyVoiceCommand(transcript, leads || [], dateLabel, industryKey),
      removeAudio(admin, storagePath),
    ]);

    const matchedLead = classified.lead_id ? (leads || []).find((l) => l.id === classified.lead_id) || null : null;
    const quotaNow = await getQuotaUsage(admin, userData.user.id, "quick-progress-note");

    // Sampe sini berarti SUKSES - reservasi slot TETEP kepake (gak di-release).
    return new Response(JSON.stringify({
      transcript,
      action: classified.action || "update_lead",
      lead_id: matchedLead?.id || null,
      lead_name: matchedLead?.name || null,
      confidence: classified.confidence || "low",
      progress_note: classified.progress_note || "",
      updates: classified.updates || {},
      cancel_visit: !!classified.cancel_visit,
      result: classified.result || null,
      new_lead: classified.new_lead || null,
      quota: { used: quotaNow.used, max: monthlyMax, reset_at: quotaNow.reset_at },
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    if (admin && reservationId) await releaseSlot(admin, reservationId);
    if (admin && storagePath) await removeAudio(admin, storagePath);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
}));
