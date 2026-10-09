// Supabase Edge Function: daily-digest
// Dipanggil oleh Cron Job Supabase tiap pagi (bukan oleh user login).
//
// FASE A "Good Morning Command Center":
// 1. Statistik FULL CRM (semua lead aktif, overdue, dingin, win-rate) dihitung
//    rule-based langsung dari data - GRATIS, gak kena biaya AI sama sekali.
// 2. AI deep-dive TETEP dibatesin ke 5 lead paling prioritas (kontrol biaya),
//    industry-aware.
// 3. Hasil (stats + recs) disimpen bareng di advisor_runs, dibaca Dashboard.jsx
//    buat kartu "Good Morning" pas user buka app.
//
// (Riwayat fix lama: tier gate Standard+, ?force=true & ?user_id=<uuid> buat
// testing, cek weekend pake WIB, org_memory diutamakan buat outcomeMemory,
// usage logging, memory-health dipisah ke function sendiri - detail lengkap
// ada di versi sebelumnya.)
//
// === MODEL (29 Sep 2026) === Sonnet 4.6 -> Sonnet 5.5 (lebih murah $2/$10
// vs $3/$15), tanpa "mikir di awal" (between_tools) biar jatah max_tokens
// kepake buat jawaban. Sekalian nambah konteks industri corporate_consultant.
//
// === KATALOG PRODUK (30 Sep 2026, Enterprise) === Kalau org Enterprise udah
// ngisi katalog produk (org_product_catalog), rekomendasi harian nyebut
// produk yang paling nyambung buat tiap lead.
//
// === PROFESIONAL (1 Okt 2026, permintaan Nando) ===
// - Rekomendasi AI dulu diminta "santai tapi profesional" -> bahasa baku.
// - Sapaan suara pagi dulu bahasa Inggris & selalu "Mr <nama>" (salah buat
//   user perempuan) -> bahasa Indonesia tanpa sapaan gender.
// - Teks email harian dirapikan (bahasa baku).
// - Org tanpa industri jatuh ke konteks B2B umum, bukan PVC.
// === HEMAT BIAYA (6 Okt 2026, permintaan Nando) ===
// AI Advisor hanya dijalankan untuk pengguna yang aktif 7 hari terakhir
// (lihat isRecentlyActive). ?force=true dan ?user_id= tetap melewati filter.
// === AKUN DUMMY (9 Okt 2026, permintaan Nando) ===
// Akun dengan email @example.com (anggota dummy untuk uji tampilan) dilewati sepenuhnya: tanpa AI, tanpa suara,
// tanpa email (alamat itu pasti bounce dan merusak reputasi pengirim). ?force=true dan ?user_id= tetap melewati.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "daily-digest";
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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayOfWeek(d = new Date()) {
  return new Date(d.getTime() + WIB_OFFSET_MS).getUTCDay(); // 0 = Minggu, 6 = Sabtu
}

// Konteks singkat per industri buat prompt AI - duplikat ringan dari
// src/lib/industryTemplates.js (Edge Function jalan di Deno, beda runtime).
// Kalau nambah industri baru di industryTemplates.js, tambahin juga di sini.
const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri. Istilah relevan: tonase, resin, kompon, purchasing manager, trader vs manufacturer",
  automotive: "dealer kendaraan (mobil/motor). Istilah relevan: test drive, unit, DP, cicilan, trade-in",
  property: "agen/developer properti. Istilah relevan: viewing, booking fee, KPR, luas tanah/bangunan, timeline pembelian",
  b2b_general: "distributor/trading B2B umum. Istilah relevan: quotation, PO, sample, reorder",
  insurance: "agen asuransi/financial services. Istilah relevan: premi, polis, nilai pertanggungan, ahli waris, renewal",
  retail_fmcg: "distribusi retail/FMCG. Istilah relevan: outlet, karton, distributor area, repeat order",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project buat perusahaan. Istilah relevan: SPK, scope of work, quotation, termin pembayaran, invoice, deliverable, decision maker",
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.b2b_general;
const industryNoun = (key) => (key === "automotive" || key === "property" || key === "insurance" ? "customer" : "perusahaan");

// Taksonomi aksi tetap - biar UI bisa nampilin badge/icon yang konsisten,
// bukan teks bebas yang beda-beda tiap kali AI jawab.
const ACTION_TYPES = ["Call", "WhatsApp", "Visit", "Kirim Penawaran", "Follow-up", "Jadwalkan Meeting", "Tunggu", "Eskalasi", "Closing"];

function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }

// Tanggal progress note PALING BARU buat satu lead - sinyal aktivitas yang
// lebih jujur dibanding last_contact (yang kadang gak ke-update rutin).
function lastProgressDate(c) {
  const notes = c.progress_notes || [];
  if (notes.length === 0) return null;
  return notes.reduce((latest, p) => (!latest || p.note_date > latest ? p.note_date : latest), null);
}

// Sinyal murah (rule-based, gak manggil AI) buat nebak progress note TERAKHIR
// itu "kelihatannya masih ada yang perlu ditindaklanjuti" apa gak.
const ACTIONABLE_HINTS = ["tanya", "nanya", "harga", "kapan", "minat", "tertarik", "nego", "keberatan", "belum", "?", "kirim", "sample", "penawaran", "cek dulu", "diskusi"];
function progressLooksActionable(noteText) {
  if (!noteText) return false;
  const t = noteText.toLowerCase();
  return ACTIONABLE_HINTS.some((kw) => t.includes(kw));
}

function potential(c, stages) {
  const prioScore = { high: 3, medium: 2, low: 1, "": 0 };
  const idx = (stages || []).findIndex((s) => s.key === c.stage_key);
  const stagePts = idx < 0 ? 0 : idx;
  const notes = c.progress_notes || [];
  const progressCount = notes.length;

  const lastNoteDate = lastProgressDate(c);
  const daysSinceNote = lastNoteDate ? daysSince(lastNoteDate) : null;
  let recencyPts = 0;
  if (daysSinceNote !== null) {
    if (daysSinceNote <= 2) recencyPts = 5;
    else if (daysSinceNote <= 5) recencyPts = 3;
    else if (daysSinceNote <= 10) recencyPts = 1;
  }

  const lastNoteText = notes.length ? notes.reduce((a, b) => (a.note_date >= b.note_date ? a : b)).text : "";
  const contentPts = progressLooksActionable(lastNoteText) ? 4 : 0;

  return (prioScore[c.priority] || 0) * 3 + stagePts * 2 + Math.min(progressCount, 5) + recencyPts + contentPts + (c.deal_value ? 1 : 0);
}

function isWaiting(c, todayISO) {
  if (!c.wait_until) return false;
  return String(c.wait_until) >= todayISO;
}

function computeStats(active, allLeads, stagesArr, todayISO) {
  const actionable = active.filter((c) => !isWaiting(c, todayISO));
  const overdue = actionable.filter((c) => {
    const dContact = daysSince(c.last_contact);
    const noteDate = lastProgressDate(c);
    const dNote = noteDate ? daysSince(noteDate) : null;
    const mostRecent = [dContact, dNote].filter((d) => d !== null);
    if (mostRecent.length === 0) return true;
    return Math.min(...mostRecent) > 7;
  }).length;
  const neverContacted = actionable.filter((c) => !c.last_contact).length;
  const waitingCount = active.length - actionable.length;

  const wonKeys = stagesArr.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stagesArr.filter((s) => s.type === "lost").map((s) => s.key);
  const closedWon = allLeads.filter((c) => wonKeys.includes(c.stage_key));
  const closedLost = allLeads.filter((c) => lostKeys.includes(c.stage_key));
  const totalClosed = closedWon.length + closedLost.length;
  const winRate = totalClosed >= 5 ? Math.round((closedWon.length / totalClosed) * 100) : null;

  const catCount = {};
  for (const c of active) { const k = c.category || "Lainnya"; catCount[k] = (catCount[k] || 0) + 1; }
  const topCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const MIN_OUTCOME_SAMPLE = 3;
  const lossReasons = {};
  for (const c of closedLost) { const cat = c.outcome?.reason_category; if (cat) lossReasons[cat] = (lossReasons[cat] || 0) + 1; }
  const winReasons = {};
  for (const c of closedWon) { const cat = c.outcome?.reason_category; if (cat) winReasons[cat] = (winReasons[cat] || 0) + 1; }
  const lossTotal = Object.values(lossReasons).reduce((a, b) => a + b, 0);
  const winTotal = Object.values(winReasons).reduce((a, b) => a + b, 0);
  const topLossReason = lossTotal >= MIN_OUTCOME_SAMPLE ? Object.entries(lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null : null;
  const topWinReason = winTotal >= MIN_OUTCOME_SAMPLE ? Object.entries(winReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null : null;

  return {
    total_active: active.length,
    overdue_followup: overdue,
    never_contacted: neverContacted,
    waiting_count: waitingCount,
    win_rate: winRate,
    total_closed_sample: totalClosed,
    top_category: topCategory,
    top_loss_reason: topLossReason,
    top_win_reason: topWinReason,
  };
}

// Sapaan suara pagi - bahasa Indonesia, tanpa sapaan gender (Bapak/Ibu)
// karena Nexto gak tahu gender user.
function buildGreetingText(displayName, stats) {
  const hourWIB = (new Date().getUTCHours() + 7) % 24;
  const greeting = hourWIB < 11 ? "Selamat pagi" : hourWIB < 15 ? "Selamat siang" : hourWIB < 18 ? "Selamat sore" : "Selamat malam";
  const firstName = (displayName || "").split(" ")[0];
  const who = firstName ? `, ${firstName}` : "";
  const active = stats.total_active ?? 0;
  const overdue = stats.overdue_followup ?? 0;
  let line = `${greeting}${who}. Berikut rekomendasi Anda hari ini. Anda memiliki ${active} lead aktif`;
  line += overdue > 0 ? `, dan ${overdue} di antaranya perlu di-follow-up hari ini.` : ", dan semua follow-up sudah tertangani.";
  return line;
}

async function generateAndUploadVoice(admin, userId, text) {
  if (!OPENAI_API_KEY) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" }),
    });
    if (!resp.ok) { console.log("[digest] TTS api error", resp.status); return null; }
    const buf = new Uint8Array(await resp.arrayBuffer());
    const path = `${userId}/${new Date().toISOString().slice(0, 10)}.mp3`;
    const { error: upErr } = await admin.storage.from("morning-audio").upload(path, buf, { contentType: "audio/mpeg", upsert: true });
    if (upErr) { console.log("[digest] storage upload error", String(upErr)); return null; }
    const { data } = admin.storage.from("morning-audio").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.log("[digest] TTS EXCEPTION", String(err));
    return null;
  }
}

async function getEmbedding(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 4000) }),
  });
  if (!resp.ok) return null;
  const dat = await resp.json();
  return dat.data?.[0]?.embedding || null;
}

async function getRelevantNotes(admin, lead) {
  const allNotes = lead.progress_notes || [];
  if (allNotes.length === 0) return [];
  const sorted = [...allNotes].sort((a, b) => (a.note_date < b.note_date ? 1 : -1));
  if (allNotes.length <= 4) return sorted.slice(0, 4).reverse();

  const recent = sorted.slice(0, 2);
  try {
    const queryText = `${lead.name} ${lead.product || ""} status pelanggan, objection, sinyal beli, langkah selanjutnya`;
    const queryEmbedding = await getEmbedding(queryText);
    if (!queryEmbedding) return sorted.slice(0, 4).reverse();

    const { data: matches } = await admin.rpc("match_progress_notes", {
      query_embedding: queryEmbedding,
      match_lead_id: lead.id,
      match_count: 3,
    });

    const merged = [...recent];
    for (const m of matches || []) {
      if (!merged.find((n) => n.id === m.id)) merged.push(m);
    }
    return merged.slice(0, 4).reverse();
  } catch (e) {
    console.log("[digest] vector search gagal, fallback ke recent:", String(e));
    return sorted.slice(0, 4).reverse();
  }
}

async function analyzeLead(admin, c, stages, today, industryKey, outcomeMemory, catalogText) {
  const stageLabel = (key) => (stages || []).find((s) => s.key === key)?.label || key;
  const hasContact = !!(c.key_person && c.key_person.trim());
  const noun = industryNoun(industryKey);
  const relevantNotes = await getRelevantNotes(admin, c);
  const payload = {
    name: c.name, city: c.city || "", category: c.category || "",
    stage: stageLabel(c.stage_key), priority: c.priority || "—",
    days_since_contact: daysSince(c.last_contact) ?? "belum pernah",
    product: (c.product || "").slice(0, 80), current_next_action: (c.next_action || "").slice(0, 80),
    existing_key_person: hasContact ? `${c.key_person}${c.key_person_title ? " (" + c.key_person_title + ")" : ""}` : "belum ada di data",
    recent_progress: relevantNotes.map((p) => `${p.note_date}: ${(p.text || "").slice(0, 200)}`),
  };
  const prompt = `Kamu sales coach yang tajam untuk sales di bisnis ${industryContext(industryKey)}. Hari ini ${today}. Lead/${noun} ini kemungkinan perorangan ATAU perusahaan - sesuaikan bahasa ke konteks datanya, jangan asumsi selalu B2B.

Data ${noun} ini: ${JSON.stringify(payload)}
${outcomeMemory ? `\nKONTEKS HISTORI ORG INI (Outcome Memory - dari lead-lead lain yang udah closed sebelumnya): ${outcomeMemory} Pake ini buat WASPADA kalau lead ini nunjukkin pola serupa (misal kalau histori org sering kalah karena harga, dan lead ini juga lagi nanya-nanya harga, itu sinyal buat diprioritasin/di-treat hati-hati).\n` : ""}${catalogText ? `\nKATALOG PRODUK/LAYANAN KITA (penjual): ${catalogText} Kalau ada produk di katalog yang nyambung sama kebutuhan/histori lead ini, sebut nama produknya di "action" atau "talking_point" (maks 1 produk paling relevan). JANGAN sebut produk di luar katalog, dan gak usah maksa kalau gak ada yang nyambung.\n` : ""}
PENTING - cara kamu menilai lead ini: JANGAN cuma berpatokan ke "days_since_contact" (itu cuma info pendukung, bisa aja gak akurat kalau field-nya lupa di-update). SUMBER UTAMA penilaian kamu adalah ISI recent_progress - baca apa yang beneran terjadi/dibicarakan: apakah ada pertanyaan yang belum kejawab? Objection yang belum diselesaikan? Sinyal minat/buying signal? Atau justru customer-nya sendiri yang eksplisit minta ditunggu/dijadwalkan ulang (kalau iya, itu BUKAN alasan buat urgency tinggi - hormati permintaan mereka, jangan sarankan follow up sebelum waktunya)?

Tugas kamu:
1. Nilai posisi ${noun} ini sekarang & alasannya (3 kalimat, spesifik, berdasar ISI progress notes di atas - bukan generik, bukan cuma bilang "sudah lama tidak dihubungi").
2. Tentukan action_type dari daftar TETAP ini SAJA: ${JSON.stringify(ACTION_TYPES)}. Kalau dari progress notes keliatan customer minta ditunggu/waktu tertentu, action_type-nya "Tunggu".
3. Kasih SATU aksi paling penting berikutnya (1 kalimat jelas, imperatif, detail dari action_type di atas, nyambung ke konteks progress notes).
4. Kasih 2-3 langkah pendukung konkret (tiap poin di bawah 14 kata).
5. Kalau belum ada key person tercatat, sarankan peran (contact_role) yang perlu dicari sales. JANGAN mengarang nama orang.
6. Kasih satu kalimat pembuka percakapan (talking_point) yang natural dan sopan, nyambung ke apa yang terakhir dibicarakan (dari progress notes).
7. Tentukan urgency (high/medium/low) - berdasar SUBSTANSI progress notes (ada buying signal/objection mendesak = high; masih adem/nunggu = low), bukan cuma lama-gaknya kontak.
8. Nilai "Customer State" terstruktur berdasar progress notes:
   - interest (high/medium/low): seberapa tertarik keliatannya dari respons/sikap mereka.
   - intent (high/medium/low): seberapa deket mereka ke keputusan beli (bukan cuma minat doang).
   - risk (high/medium/low): resiko opportunity ini gagal/hilang (kompetitor kuat, komunikasi macet, dst).
   - objection: objection UTAMA yang keliatan dari progress notes (frasa pendek, contoh "harga terlalu tinggi", "masih membandingkan vendor lain", "belum ada anggaran") - kalau gak ada objection jelas, isi string kosong "".
   - decision_maker_known (true/false): apakah key person yang tercatat itu KELIATANNYA orang yang punya kewenangan mutusin (dari jabatan/konteks), bukan cuma kontak biasa.
   - expected_decision_date: kalau progress notes nyebut kapan mereka bakal mutusin (misal "minggu depan", "tanggal 5"), konversi ke YYYY-MM-DD. Kalau gak disebut, null.
   - state_reason: SATU kalimat pendek kenapa kamu nilai state ini gitu (buat transparansi - bukan black box).

Balas HANYA dengan JSON object (bukan array, bukan markdown), persis field ini:
{"assessment":"...","action_type":"...","action":"...","steps":["...","..."],"contact_role":"...","talking_point":"...","urgency":"high|medium|low","customer_state":{"interest":"high|medium|low","intent":"high|medium|low","risk":"high|medium|low","objection":"...","decision_maker_known":true,"expected_decision_date":null,"state_reason":"..."}}
Semua teks dalam Bahasa Indonesia baku yang profesional dan ringkas - JANGAN pakai bahasa gaul (misal "gak", "udah", "aja", "banget").`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 1200, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) { console.log("[digest] api error", c.name, resp.status, (await resp.text()).slice(0, 200)); return null; }
    const dat = await resp.json();
    console.log("[digest] USAGE for", c.name, ":", JSON.stringify(dat.usage), "prompt_chars:", prompt.length);
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) obj = JSON.parse(x.slice(a, e + 1));
    const lvl = (v) => (["high", "medium", "low"].includes(v) ? v : "medium");
    const cs = obj.customer_state || {};
    return {
      id: c.id, name: c.name,
      assessment: obj.assessment || "",
      action_type: ACTION_TYPES.includes(obj.action_type) ? obj.action_type : "Follow-up",
      action: obj.action || "",
      steps: Array.isArray(obj.steps) ? obj.steps : [],
      contact_role: obj.contact_role || "", contact_name_guess: "", contact_title_guess: "", contact_source: "",
      talking_point: obj.talking_point || "", urgency: obj.urgency || "low",
      customer_state: {
        interest: lvl(cs.interest), intent: lvl(cs.intent), risk: lvl(cs.risk),
        objection: (cs.objection || "").slice(0, 120),
        decision_maker_known: !!cs.decision_maker_known,
        expected_decision_date: /^\d{4}-\d{2}-\d{2}$/.test(cs.expected_decision_date) ? cs.expected_decision_date : null,
        state_reason: (cs.state_reason || "").slice(0, 200),
        computed_at: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.log("[digest] EXCEPTION analyzing", c.name, String(err));
    return null;
  }
}

async function runAdvisorForUser(admin, userId, orgId, myRole) {
  const [{ data: stages }, leadsRes, orgRes] = await Promise.all([
    admin.from("stages").select("*").eq("org_id", orgId).order("position"),
    (() => {
      let q = admin.from("leads").select("*, progress_notes(id, note_date, text)").eq("org_id", orgId).is("deleted_at", null);
      if (myRole === "sales_rep") q = q.eq("assigned_to", userId);
      return q;
    })(),
    admin.from("organizations").select("industry, plan").eq("id", orgId).maybeSingle(),
  ]);
  const stagesArr = stages || [];
  const leadsArr = leadsRes.data || [];
  const industryKey = orgRes.data?.industry || "b2b_general";
  const wonKeys = stagesArr.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stagesArr.filter((s) => s.type === "lost").map((s) => s.key);
  const active = leadsArr.filter((c) => !wonKeys.includes(c.stage_key) && !lostKeys.includes(c.stage_key));
  const todayISO = new Date().toISOString().slice(0, 10);

  const stats = computeStats(active, leadsArr, stagesArr, todayISO);

  const actionable = active.filter((c) => !isWaiting(c, todayISO));
  const queue = [...actionable].sort((a, b) => potential(b, stagesArr) - potential(a, stagesArr)).slice(0, 5);
  if (queue.length === 0) { console.log("[digest] no actionable leads for", userId); return { recs: [], stats }; }

  const today = todayISO;
  console.log("[digest] analyzing", queue.length, "leads in parallel for", userId, "industry:", industryKey);

  let outcomeMemory = "";
  try {
    const { data: orgMem } = await admin.from("org_memory").select("ideal_customer_profile, common_objections, winning_playbook").eq("org_id", orgId).maybeSingle();
    if (orgMem && (orgMem.ideal_customer_profile || (orgMem.common_objections || []).length || (orgMem.winning_playbook || []).length)) {
      const objections = (orgMem.common_objections || []).map((o) => `"${o.objection}" -> ${o.how_to_handle}`).join("; ");
      const playbook = (orgMem.winning_playbook || []).join("; ");
      const parts = [];
      if (orgMem.ideal_customer_profile) parts.push(`Ideal customer profile org ini: ${orgMem.ideal_customer_profile}`);
      if (objections) parts.push(`Objection yang sering muncul & cara ngatasin yang kebukti berhasil: ${objections}`);
      if (playbook) parts.push(`Taktik yang kebukti berhasil di deal lain: ${playbook}`);
      outcomeMemory = parts.join(" ");
    }
  } catch (e) {
    console.log("[digest] gagal baca org_memory, fallback ke stats lama:", String(e));
  }
  if (!outcomeMemory && (stats.top_loss_reason || stats.top_win_reason)) {
    const parts = [];
    if (stats.top_win_reason) parts.push(`biasanya MENANG karena "${stats.top_win_reason}"`);
    if (stats.top_loss_reason) parts.push(`biasanya KALAH karena "${stats.top_loss_reason}"`);
    outcomeMemory = `Dari histori org ini, ${parts.join(", ")}.`;
  }

  // Katalog produk (Enterprise) - maks 8 item, dipake bareng buat 5 lead.
  let catalogText = "";
  if (orgRes.data?.plan === "enterprise") {
    try {
      const { data: catalog } = await admin.from("org_product_catalog").select("company_profile, products").eq("org_id", orgId).maybeSingle();
      const products = (Array.isArray(catalog?.products) ? catalog.products : []).filter((p) => p?.name).slice(0, 8);
      if (products.length) {
        catalogText = `${catalog.company_profile ? `${catalog.company_profile} ` : ""}Produk: ${products.map((p) => `${p.name}${p.fit_for ? ` (cocok untuk: ${p.fit_for})` : ""}`).join("; ")}.`;
      }
    } catch (e) {
      console.log("[digest] gagal baca katalog produk:", String(e));
    }
  }

  const results = await Promise.all(queue.map((c) => analyzeLead(admin, c, stagesArr, today, industryKey, outcomeMemory, catalogText)));
  const all = results.filter((r) => r !== null);

  await Promise.all(
    all.filter((r) => r.customer_state).map((r) => admin.from("leads").update({ customer_state: r.customer_state }).eq("id", r.id))
  );

  const uRank = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => (uRank[a.urgency] ?? 3) - (uRank[b.urgency] ?? 3));
  return { recs: all, stats };
}

function renderEmail(recs, stats, dateStr) {
  const uColor = { high: "#e11d48", medium: "#d97706", low: "#64748b" };
  const uLabel = { high: "Tinggi", medium: "Sedang", low: "Rendah" };
  const statsBlock = stats ? `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
    <div style="flex:1;min-width:100px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;"><div style="font-size:18px;font-weight:800;color:#0f172a;">${stats.total_active}</div><div style="font-size:10px;color:#94a3b8;">Lead aktif</div></div>
    <div style="flex:1;min-width:100px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;"><div style="font-size:18px;font-weight:800;color:#dc2626;">${stats.overdue_followup}</div><div style="font-size:10px;color:#94a3b8;">Perlu follow-up</div></div>
    ${stats.waiting_count > 0 ? `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;"><div style="font-size:18px;font-weight:800;color:#0284c7;">${stats.waiting_count}</div><div style="font-size:10px;color:#94a3b8;">Sedang ditunggu</div></div>` : ""}
    ${stats.win_rate !== null ? `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;"><div style="font-size:18px;font-weight:800;color:#16a34a;">${stats.win_rate}%</div><div style="font-size:10px;color:#94a3b8;">Win rate</div></div>` : ""}
  </div>` : "";
  const rows = recs.map((r) => {
    const contactBlock = r.contact_role ? `<div style="font-size:12px;color:#475569;margin-top:8px;">Kontak yang perlu dicari: <b>${r.contact_role}</b></div>` : "";
    const steps = r.steps.length ? `<ul style="margin:6px 0 0;padding-left:18px;">${r.steps.map((s) => `<li style="font-size:12px;color:#475569;margin-bottom:2px;">${s}</li>`).join("")}</ul>` : "";
    const talk = r.talking_point ? `<div style="font-size:12px;color:#0369a1;background:#f0f9ff;border-radius:8px;padding:8px 10px;margin-top:8px;">Pembuka percakapan: "${r.talking_point}"</div>` : "";
    return `<tr><td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;">
      <div style="font-weight:700;font-size:14px;color:#0f172a;">${r.name}
        <span style="font-size:10px;font-weight:700;color:#fff;background:#0f172a;padding:2px 8px;border-radius:999px;margin-left:6px;">${r.action_type || ""}</span>
        <span style="font-size:10px;font-weight:700;color:#fff;background:${uColor[r.urgency] || "#64748b"};padding:2px 8px;border-radius:999px;margin-left:4px;">${uLabel[r.urgency] || r.urgency || "-"}</span>
      </div>
      <div style="font-size:13px;color:#475569;margin-top:4px;">${r.assessment}</div>
      <div style="font-size:13px;color:#92400e;background:#fffbeb;border-radius:8px;padding:8px 10px;margin-top:8px;"><b>Rekomendasi:</b> ${r.action}</div>
      ${steps}${contactBlock}${talk}
    </td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <div style="width:36px;height:36px;border-radius:12px;background:#f59e0b;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0f172a;">N</div>
      <div><div style="font-weight:800;color:#0f172a;">Nexto · Rekomendasi Harian</div><div style="font-size:11px;color:#94a3b8;">${dateStr}</div></div>
    </div>
    ${statsBlock}
    <p style="font-size:13px;color:#475569;">Berikut ${recs.length} rekomendasi lead paling potensial untuk hari ini.</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">${rows || `<tr><td style="padding:20px;color:#94a3b8;font-size:13px;">Belum ada lead aktif untuk dianalisis hari ini.</td></tr>`}</table>
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;">Email otomatis harian dari Nexto.</p>
  </div></body></html>`;
}

async function getAllUsers(admin) {
  let allUsers = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.log("[digest] listUsers GAGAL di halaman", page, ":", String(error));
      break;
    }
    const batch = data?.users || [];
    allUsers = allUsers.concat(batch);
    if (batch.length < perPage) break;
    page++;
    if (page > 20) { console.log("[digest] listUsers berhenti di halaman 20 (safety net)"); break; }
  }
  return allUsers;
}

// Hemat biaya AI (6 Okt 2026, permintaan Nando): AI Advisor hanya dijalankan
// untuk pengguna yang aktif dalam 7 hari terakhir. Aktif = login baru-baru
// ini, akun baru (agar tetap dapat rekomendasi pertama), atau ada aktivitas
// data (lead diubah, catatan progress, check-in). Pengguna yang kembali
// setelah libur langsung masuk hitungan di run berikutnya; sementara itu
// Dashboard memakai kartu cadangan (tanpa rekomendasi AI).
const ACTIVE_WINDOW_DAYS = 7;
async function isRecentlyActive(admin, u) {
  const sinceMs = Date.now() - ACTIVE_WINDOW_DAYS * 86400000;
  if (u.last_sign_in_at && Date.parse(u.last_sign_in_at) >= sinceMs) return true;
  if (u.created_at && Date.parse(u.created_at) >= sinceMs) return true;
  const since = new Date(sinceMs).toISOString();
  const [leadsRes, notesRes, checkinsRes] = await Promise.all([
    admin.from("leads").select("id", { count: "exact", head: true }).or(`user_id.eq.${u.id},assigned_to.eq.${u.id}`).gte("updated_at", since),
    admin.from("progress_notes").select("id", { count: "exact", head: true }).eq("user_id", u.id).gte("created_at", since),
    admin.from("visit_checkins").select("id", { count: "exact", head: true }).eq("user_id", u.id).gte("created_at", since),
  ]);
  // Gagal membaca = anggap aktif (lebih baik tetap kirim daripada melewatkan pengguna aktif).
  if (leadsRes.error || notesRes.error || checkinsRes.error) return true;
  return (leadsRes.count || 0) + (notesRes.count || 0) + (checkinsRes.count || 0) > 0;
}

Deno.serve((req) => AI_CTX.run({ req }, async () => {
  console.log("[digest] request received");
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const reqUrl = new URL(req.url);
  const forceRun = reqUrl.searchParams.get("force") === "true";
  const onlyUserId = reqUrl.searchParams.get("user_id") || null;

  if (!forceRun) {
    const dayOfWeek = wibDayOfWeek();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log("[digest] Weekend (WIB), skip run. Day:", dayOfWeek);
      return new Response(JSON.stringify({ ok: true, skipped: "weekend" }), { headers: { "Content-Type": "application/json" } });
    }
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let allUsers;
    if (onlyUserId) {
      const { data: singleUserRes, error: singleUserErr } = await admin.auth.admin.getUserById(onlyUserId);
      if (singleUserErr || !singleUserRes?.user) {
        console.log("[digest] user_id testing target gak ketemu:", onlyUserId, String(singleUserErr));
        return new Response(JSON.stringify({ error: "user_id tidak ditemukan" }), { status: 404 });
      }
      allUsers = [singleUserRes.user];
      console.log("[digest] MODE TESTING - cuma jalanin buat 1 user:", onlyUserId);
    } else {
      allUsers = await getAllUsers(admin);
    }
    console.log("[digest] users found:", allUsers.length);

    const results = [];
    const todayISO = new Date().toISOString().slice(0, 10);
    const cutoffISO = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const orgWideCache = new Map();

    for (const u of allUsers) {
      // Akun dummy (email @example.com) dilewati: tanpa AI, suara, maupun email (9 Okt 2026).
      if (!forceRun && !onlyUserId && /@example.com$/i.test(u.email || "")) {
        console.log("[digest] skip, akun dummy:", u.id);
        results.push({ user: u.email, skipped: "akun_dummy" });
        continue;
      }
      console.log("[digest] processing user", u.id, u.email);
      aiSetUser(u.id);
      try {
        const { data: memberRow } = await admin.from("organization_members").select("org_id, role").eq("user_id", u.id).limit(1).maybeSingle();
        if (!memberRow) { console.log("[digest] skip, no org for", u.id); continue; }

        const [{ data: settingsRow }, { data: orgPlanRow }] = await Promise.all([
          admin.from("settings").select("plan, community_display_name").eq("user_id", u.id).maybeSingle(),
          admin.from("organizations").select("plan, owner_user_id, features").eq("id", memberRow.org_id).maybeSingle(),
        ]);
        // Saklar owner_monitor (8 Okt 2026): owner yang hanya memantau tidak menerima digest.
        if (orgPlanRow?.features?.owner_monitor === true && orgPlanRow.owner_user_id === u.id) {
          console.log("[digest] skip, owner pemantau (owner_monitor):", u.id);
          continue;
        }
        const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
        const myPlanLevel = orgPlanRow?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
        if (myPlanLevel < 1) {
          console.log("[digest] skip, plan Free (bukan Standard+):", u.id);
          continue;
        }
        if (!forceRun && !onlyUserId && !(await isRecentlyActive(admin, u))) {
          console.log("[digest] skip, tidak aktif", ACTIVE_WINDOW_DAYS, "hari terakhir:", u.id);
          results.push({ user: u.email, skipped: "tidak_aktif" });
          continue;
        }

        let recs, stats;
        if (memberRow.role !== "sales_rep" && orgWideCache.has(memberRow.org_id)) {
          ({ recs, stats } = orgWideCache.get(memberRow.org_id));
          console.log("[digest] reuse cached org-wide analysis for", u.id, "org", memberRow.org_id);
        } else {
          ({ recs, stats } = await runAdvisorForUser(admin, u.id, memberRow.org_id, memberRow.role));
          if (memberRow.role !== "sales_rep") orgWideCache.set(memberRow.org_id, { recs, stats });
        }
        console.log("[digest] recs generated:", recs.length);

        const greetingText = buildGreetingText(settingsRow?.community_display_name, stats);
        const audioUrl = await generateAndUploadVoice(admin, u.id, greetingText);
        console.log("[digest] audio:", audioUrl ? "ok" : "skipped/failed");

        const dateStr = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        await admin.from("advisor_runs").upsert(
          { user_id: u.id, run_date: todayISO, ran_at: dateStr, recs, stats, audio_url: audioUrl, updated_at: new Date().toISOString() },
          { onConflict: "user_id,run_date" }
        );
        await admin.from("advisor_runs").delete().eq("user_id", u.id).lt("run_date", cutoffISO);
        if (u.email && recs.length > 0) {
          const emailResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: "Nexto <noreply@nexto.site>",
              to: [u.email],
              subject: `Nexto · ${recs.length} rekomendasi lead hari ini`,
              html: renderEmail(recs, stats, dateStr),
            }),
          });
          console.log("[digest] email sent status:", emailResp.status);
        }
        results.push({ user: u.email, count: recs.length });
      } catch (userErr) {
        console.log("[digest] EXCEPTION for user", u.id, String(userErr));
        results.push({ user: u.email, error: String(userErr) });
      }
    }
    console.log("[digest] done", JSON.stringify(results));
    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[digest] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}));
