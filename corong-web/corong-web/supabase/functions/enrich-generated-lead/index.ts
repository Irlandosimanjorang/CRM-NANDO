// Supabase Edge Function: enrich-generated-lead
// Lengkapi & verifikasi kontak SATU perusahaan hasil Generate Leads:
// website resmi, telepon, email, dan PIC yang MASIH bekerja di sana.
//
// Hanya dipanggil OTOMATIS - generate-leads, abis nyimpen hasil, nembak fungsi
// ini buat SEMUA lead sekaligus lewat pg_net (dispatch_lead_enrichment) dengan
// header x-cron-secret. Tiap lead = 1 invocation sendiri, jadi paralel & gak
// kepotong batas 150 detik generate-leads. Jalur manual (tombol "coba lagi")
// dihapus 6 Okt 2026. verify_jwt dimatiin di gateway karena pemanggilnya gak
// bawa JWT - auth dicek lewat cron secret di bawah.
//
// === HEMAT BIAYA (6 Okt 2026, permintaan Nando) ===
// Versi sebelumnya: AI (Haiku) dengan 3 pencarian web + 2 web_fetch per lead
// = $0,08-0,23 (±Rp2.750) per lead, 40-90 ribu token input - mayoritas dari
// isi halaman & hasil pencarian. Sekarang dua tahap:
//   Tahap 1 (GRATIS, tanpa AI): server membuka sendiri halaman utama +
//     halaman Kontak website perusahaan, ambil telepon & email dari tautan
//     tel:/mailto: dan teks halaman.
//   Tahap 2 (AI hemat): Haiku dengan maksimal DUA pencarian web, tanpa
//     web_fetch, khusus mencari PIC di jabatan target - prioritas utama
//     klien (Nando: "yang paling penting cari nama PIC sesuai keinginan
//     client"). Plus SATU pencarian kontak hanya kalau website tidak memuat
//     telepon/email (banyak website perusahaan dirender lewat JavaScript
//     atau tidak mencantumkan kontak di halaman yang bisa dibaca langsung).
// Target biaya ±Rp700-1.000 per lead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "enrich-generated-lead";
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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_CONTINUATIONS = 2;
const MAX_RATE_RETRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Tahap 1: baca website resmi (tanpa AI)
// ---------------------------------------------------------------------------
const PAGE_TIMEOUT_MS = 9000;
const MAX_HTML_CHARS = 1500000;
const CONTACT_PATHS = ["/contact", "/contact-us", "/kontak", "/hubungi-kami"];
const CONTACT_LINK_RE = /(contact|kontak|hubungi|reach-us|get-in-touch)/i;
const JUNK_EMAIL_RE = /\.(png|jpe?g|gif|svg|webp|css|js)$|@(example|domain|email|sentry|wixpress|sentry-next)\.|^(no-?reply|noreply|donotreply)@|@\d+x\./i;

function normalizeSite(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    return u.origin;
  } catch (_) {
    return null;
  }
}
const domainOf = (origin) => { try { return new URL(origin).hostname.replace(/^www\./, "").toLowerCase(); } catch (_) { return ""; } };

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NextoBot/1.0; +https://nexto.site)", Accept: "text/html,application/xhtml+xml" },
    });
    if (!resp.ok || !(resp.headers.get("content-type") || "").includes("text/html")) return null;
    return { html: (await resp.text()).slice(0, MAX_HTML_CHARS), finalUrl: resp.url };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Nomor telepon Indonesia: +62 / 62 / 0 diikuti 7-12 digit (boleh berspasi,
// strip, titik, kurung). Disimpan dalam format aslinya (spasi dirapikan),
// misal "021-5095-9900" tetap seperti itu.
function cleanPhone(raw) {
  const pretty = String(raw || "").replace(/\s+/g, " ").trim();
  const s = pretty.replace(/[^\d+]/g, "");
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  if (!/^(\+?62|0)/.test(s)) return "";
  return /^62/.test(pretty) ? "+" + pretty : pretty;
}

function extractContacts(html) {
  const decoded = html.replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, "@").replace(/&amp;/g, "&");
  const emails = new Set(), phones = new Set();
  for (const m of decoded.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of decoded.matchAll(/tel:([^"'>]+)/gi)) { const p = cleanPhone(decodeURIComponent(m[1])); if (p) phones.add(p); }
  // Data terstruktur di dalam <script> (schema.org JSON-LD, data halaman
  // Next.js/Nuxt): banyak website perusahaan dirender lewat JavaScript, jadi
  // kontaknya hanya ada di sini, bukan di teks HTML.
  for (const m of decoded.matchAll(/\\?"(?:telephone|phone|phoneNumber|phone_number|contactPhone|whatsapp)\\?"\s*:\s*\\?"([^"\\]{6,30})\\?"/gi)) { const p = cleanPhone(m[1]); if (p) phones.add(p); }
  for (const m of decoded.matchAll(/\\?"(?:email|contactEmail|e-mail)\\?"\s*:\s*\\?"([^"\\\s]+@[^"\\\s]+\.[a-z]{2,})\\?"/gi)) emails.add(m[1].toLowerCase());
  const text = decoded.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) emails.add(m[0].toLowerCase());
  for (const m of text.matchAll(/(?:\+62|\b62|\b0)[\s.\-()]*\d[\d\s.\-()]{6,16}\d/g)) { const p = cleanPhone(m[0]); if (p) phones.add(p); }
  const links = [...decoded.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]).filter((h) => CONTACT_LINK_RE.test(h));
  return { emails: [...emails].filter((e) => !JUNK_EMAIL_RE.test(e)), phones: [...phones], links };
}

// Email paling cocok: domain perusahaan sendiri dulu, lalu awalan sesuai
// kebutuhan (HR kalau jabatan target HR, selain itu sales/marketing/info).
function pickEmail(emails, domain, isHrTarget) {
  if (!emails.length) return { email: "", type: "" };
  const prefs = isHrTarget
    ? [["hr", /^(hr|hrd|human|people|recruit|career|karir|talent)/], ["general", /^(info|contact|admin|halo|hello|cs|office)/]]
    : [["sales", /^(sales|marketing|bisnis|business|partnership)/], ["general", /^(info|contact|admin|halo|hello|cs|office|enquir|inquir)/]];
  const sameDomain = emails.filter((e) => domain && e.endsWith("@" + domain));
  const pool = sameDomain.length ? sameDomain : emails;
  for (const [type, re] of prefs) {
    const hit = pool.find((e) => re.test(e));
    if (hit) return { email: hit, type };
  }
  return { email: pool[0], type: "general" };
}

async function scrapeWebsite(site) {
  const origin = normalizeSite(site);
  if (!origin) return null;
  const home = await fetchPage(origin);
  if (!home) return { origin, reachable: false, emails: [], phones: [], pages: 0 };
  const base = new URL(home.finalUrl).origin;
  // Dialihkan ke domain lain = bukan website perusahaan lagi (domain
  // kedaluwarsa yang diambil situs judi/spam, dll - ditemukan 6 Okt 2026:
  // sehatq.com -> situs judi). Hanya terima pengalihan di domain yang sama
  // (www, subdomain, http -> https).
  const want = domainOf(origin), got = domainOf(base);
  if (got !== want && !got.endsWith("." + want) && !want.endsWith("." + got)) {
    console.log("[enrich-generated-lead] website dialihkan ke domain lain, diabaikan:", want, "->", got);
    return { origin, reachable: false, redirected: got, emails: [], phones: [], pages: 0 };
  }
  const found = extractContacts(home.html);
  const emails = new Set(found.emails), phones = new Set(found.phones);
  // Halaman kontak: utamakan tautan yang memang ada di halaman utama, lalu
  // tebakan alamat umum. Maksimal 2 halaman tambahan.
  const candidates = [];
  for (const h of found.links) { try { const u = new URL(h, base); if (u.origin === base) candidates.push(u.href); } catch (_) {} }
  for (const p of CONTACT_PATHS) candidates.push(base + p);
  let pages = 1;
  for (const url of [...new Set(candidates)]) {
    if (pages >= 3 || (emails.size && phones.size)) break;
    const page = await fetchPage(url);
    if (!page) continue;
    pages++;
    const c = extractContacts(page.html);
    c.emails.forEach((e) => emails.add(e));
    c.phones.forEach((p) => phones.add(p));
  }
  return { origin: base, reachable: true, emails: [...emails], phones: [...phones], pages };
}

// ---------------------------------------------------------------------------
// Tahap 2: AI hemat (2 pencarian PIC, +1 kontak bila perlu, tanpa web_fetch)
// ---------------------------------------------------------------------------
// - "pause_turn": server tool berhenti di tengah, harus dilanjutin biar JSON
//   final-nya keluar.
// - 429/529: belasan lead jalan paralel bisa kena rate limit/overload -
//   retry dengan jeda acak biar gak barengan lagi.
async function callClaudeWithContinuation(body, signal) {
  const messages = [...body.messages];
  let dat = null;
  const usage = { input: 0, cache_write: 0, cache_read: 0, output: 0, searches: 0, fetches: 0, calls: 0 };
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    let resp;
    for (let r = 0; r <= MAX_RATE_RETRIES; r++) {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ ...body, messages }),
        signal,
      });
      if (resp.status !== 429 && resp.status !== 529) break;
      await sleep(4000 + Math.random() * 6000 * (r + 1));
    }
    if (!resp.ok) throw new Error(`AI gagal: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    dat = await resp.json();
    const u = dat.usage || {};
    usage.input += u.input_tokens || 0;
    usage.cache_write += u.cache_creation_input_tokens || 0;
    usage.cache_read += u.cache_read_input_tokens || 0;
    usage.output += u.output_tokens || 0;
    usage.searches += u.server_tool_use?.web_search_requests || 0;
    usage.fetches += u.server_tool_use?.web_fetch_requests || 0;
    usage.calls += 1;
    if (dat.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: dat.content });
  }
  // Harga Haiku 4.5 (per MTok): input $1, cache write 5m $1.25, cache read
  // $0.1, output $5; web search $10/1000.
  const costUsd = (usage.input * 1 + usage.cache_write * 1.25 + usage.cache_read * 0.1 + usage.output * 5) / 1e6 + usage.searches * 0.01;
  console.log("[enrich-generated-lead] USAGE", JSON.stringify({ ...usage, cost_usd: Math.round(costUsd * 10000) / 10000 }));
  return (dat?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// Kena bunuh platform di 150 detik = gak sempet nyatet status (nyangkut
// "pending"). Dipotong sendiri lebih dulu biar statusnya jadi "failed" dan
// layar Generate Leads berhenti menunggu.
const ENRICH_DEADLINE_MS = 110 * 1000;
// Skor keseluruhan = rumus pasti (6 Okt 2026, permintaan Nando): 40% sinyal
// beli + 35% kecocokan industri + 25% kelengkapan kontak. Sebelumnya skor
// besar ditebak AI sebelum kontak dilengkapi dan tidak pernah dihitung ulang,
// jadi bisa lebih rendah dari ketiga komponennya. null = komponen AI tidak ada.
function overallScore(industry, buying, contact) {
  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const ind = n(industry), buy = n(buying), con = n(contact);
  if (!Number.isFinite(ind) || !Number.isFinite(buy)) return null;
  const c = Number.isFinite(con) ? con : 0;
  return Math.max(1, Math.min(100, Math.round(0.4 * buy + 0.35 * ind + 0.25 * c)));
}

const FORMER_RE = /\b(mantan|former|ex)\b|\bex-/i;
const HR_RE = /\b(hr|hrd|human|people|talent|recruit|personalia|sdm)\b/i;

async function askAi({ gl, targetRole, site, needWebsite, needPhone, needEmail }, signal) {
  const extra = [
    needWebsite ? "- website: domain resmi perusahaan (bukan direktori/portal lowongan/media sosial)" : "",
    needPhone ? "- phone: telepon kantor yang TERTULIS di hasil pencarian" : "",
    needEmail ? "- email: email perusahaan yang TERTULIS di hasil pencarian" : "",
  ].filter(Boolean).join("\n");
  const prompt = `Cari PIC perusahaan berikut untuk kebutuhan sales B2B di Indonesia. Ini tugas UTAMA: temukan orang di jabatan yang diminta klien. Untuk PIC kamu punya MAKSIMAL DUA pencarian web:
1. Pertama: site:linkedin.com/in "${gl.name}" ${targetRole}
2. Hanya kalau belum ketemu: coba padanan jabatannya (misal HRD: HR Manager, Head of People, HR Business Partner, Talent Acquisition; Purchasing: Procurement Manager, Head of Purchasing, Buyer) atau halaman tim/manajemen perusahaan.

Perusahaan: "${gl.name}"
Kota: ${gl.city || "-"}
Website: ${site || "(belum diketahui)"}
PIC yang tercatat: ${gl.key_person ? `${gl.key_person} (${gl.key_person_title || "-"})` : "(belum ada)"}
Jabatan PIC yang dicari: ${targetRole}

Cari orang dengan jabatan target (atau padanan dekatnya) yang MASIH bekerja di perusahaan ini menurut cuplikan hasil pencarian. Tolak yang tertulis "ex-", "former", "mantan", atau sudah di perusahaan lain. JANGAN ganti dengan CEO/Direktur kalau bukan jabatan target.${extra ? `\n\nSetelah urusan PIC selesai, kamu boleh memakai SATU pencarian tambahan (misal: "${gl.name}" ${gl.city || ""} kontak telepon email) untuk mengisi:\n${extra}` : ""}

ATURAN: jangan mengarang nama, nomor, atau pola email. Yang tidak terlihat jelas = string kosong.
Balas HANYA JSON tanpa markdown:
{"key_person":"","key_person_title":"","pic_status":"confirmed|left|not_found","website":"","phone":"","email":""}
pic_status: "confirmed" = PIC terbukti masih bekerja di sini; "left" = PIC yang tercatat terbukti sudah pindah; "not_found" = tidak berhasil memastikan.`;
  const text = await callClaudeWithContinuation({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
    // 2 pencarian untuk PIC (prioritas), +1 hanya kalau website tidak
    // memuat kontak yang dibutuhkan.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: extra ? 3 : 2 }],
  }, signal);
  const x = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"), e = x.lastIndexOf("}");
  if (a !== -1 && e !== -1) { try { return JSON.parse(x.slice(a, e + 1)); } catch (_) {} }
  return null;
}

async function enrich(admin, gl) {
  // Jabatan yang dicari user di form generate (bukan jabatan PIC yang
  // kebetulan ketemu di tahap 1 - itu sering CEO/Direktur).
  let { data: job } = gl.run_id
    ? await admin.from("lead_gen_jobs").select("params").eq("run_id", gl.run_id).limit(1).maybeSingle()
    : { data: null };
  if (!job) {
    // Enrichment dikirim SEBELUM job-nya sempet dicatet run_id-nya (masih
    // "running") - ambil job terbaru org ini yang dibuat sebelum lead ini.
    ({ data: job } = await admin.from("lead_gen_jobs").select("params").eq("org_id", gl.org_id).lte("created_at", gl.created_at || new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle());
  }
  const requestedRole = String(job?.params?.targetRole || "").trim();
  const targetRole = requestedRole || gl.key_person_title || "pengambil keputusan pembelian yang relevan dengan produk";
  const isHrTarget = HR_RE.test(targetRole);

  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), ENRICH_DEADLINE_MS);
  try {
    const clean = (s) => String(s || "").trim();
    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

    // Tahap 1 - website yang sudah tercatat dibaca langsung (gratis).
    let scraped = gl.website ? await scrapeWebsite(gl.website) : null;
    let site = scraped?.reachable ? scraped.origin : "";

    // Tahap 2 - satu pencarian AI: PIC (+ website/telepon/email yang belum ketemu).
    const needWebsite = !site;
    const ai = await askAi({
      gl, targetRole, site: site || gl.website,
      needWebsite, needPhone: !scraped?.phones?.length, needEmail: !scraped?.emails?.length,
    }, abort.signal).catch((e) => { if (abort.signal.aborted) throw e; console.log("[enrich-generated-lead] AI gagal (lanjut tanpa PIC):", String(e)); return null; });

    // Website baru dari AI -> baca juga (gratis) untuk telepon & email resmi.
    if (needWebsite && ai?.website) {
      const s2 = await scrapeWebsite(ai.website);
      if (s2?.reachable) { scraped = s2; site = s2.origin; }
    }

    const domain = domainOf(site);
    const picked = pickEmail(scraped?.emails || [], domain, isHrTarget);
    const sitePhone = scraped?.phones?.[0] || "";
    const aiPhone = cleanPhone(ai?.phone);
    const aiEmail = clean(ai?.email).toLowerCase();

    const phone = sitePhone || aiPhone || gl.phone || "";
    // Email umum dari website (info@, help@) tidak menggantikan email lama
    // yang sudah ada - email lama sering lebih spesifik (mis. email HR dari
    // tahap generate). Email website hanya menggantikan kalau jenisnya cocok
    // dengan jabatan target (HR / sales).
    const keepOldEmail = !!gl.email && (!picked.email || picked.type === "general");
    const email = keepOldEmail ? gl.email : (picked.email || (isEmail(aiEmail) && !JUNK_EMAIL_RE.test(aiEmail) ? aiEmail : "") || gl.email || "");

    // PIC lama cuma dihapus kalau TERBUKTI udah pindah ("left"); kalau AI
    // cuma gagal mastiin ("not_found"), data lama dipertahanin.
    const pic = clean(ai?.key_person);
    const picStatus = clean(ai?.pic_status);
    let keyPerson = pic || (picStatus === "left" ? "" : (gl.key_person || ""));
    let keyPersonTitle = pic ? clean(ai?.key_person_title) : (picStatus === "left" ? "" : (gl.key_person_title || ""));
    // Jaring pengaman: PIC yang jabatannya ketulis "mantan/former/ex" jelas
    // udah gak di situ - buang, walau AI-nya kelolosan ngisi.
    if (FORMER_RE.test(keyPersonTitle)) { keyPerson = ""; keyPersonTitle = ""; }

    const notes = [];
    if (site) notes.push(`website resmi${scraped?.reachable ? " (terverifikasi, dibuka langsung)" : ""}`);
    if (sitePhone) notes.push("telp kantor dari website");
    else if (aiPhone) notes.push("telp dari pencarian web");
    if (picked.email) notes.push(`${{ hr: "email HR", sales: "email sales", general: "email umum" }[picked.type] || "email"} dari website`);
    else if (email && email !== gl.email) notes.push("email dari pencarian web");
    if (pic) notes.push("PIC dari pencarian web");

    // Skor kelengkapan kontak (tanpa AI): website terverifikasi, telepon,
    // email, PIC.
    const score = (scraped?.reachable ? 30 : site ? 15 : 0) + (phone ? 25 : 0) + (email ? 25 : 0) + (keyPerson ? 20 : 0);

    const update = {
      website: site || clean(ai?.website) || gl.website || "",
      phone,
      email,
      key_person: keyPerson,
      key_person_title: keyPersonTitle,
      source_note: [gl.source_note, `Dilengkapi: ${notes.join("; ") || "data belum ditemukan"}`].filter(Boolean).join(" | ").slice(0, 600),
      enrich_status: "done",
      score_contact_quality: Math.max(1, score),
      // Skor keseluruhan dihitung ulang dengan kontak yang sudah dilengkapi.
      ...(overallScore(gl.score_industry_match, gl.score_buying_signal, Math.max(1, score)) !== null
        ? { score: overallScore(gl.score_industry_match, gl.score_buying_signal, Math.max(1, score)) }
        : {}),
    };
    console.log("[enrich-generated-lead] hasil", JSON.stringify({ id: gl.id, website_read: !!scraped?.reachable, pages: scraped?.pages || 0, phone: !!phone, email: !!email, pic: !!keyPerson, ai: !!ai }));

    const { data: updated, error: upErr } = await admin.from("generated_leads").update(update).eq("id", gl.id).eq("org_id", gl.org_id).select("*").single();
    if (upErr) throw new Error("Gagal menyimpan hasil: " + upErr.message);
    return updated;
  } catch (e) {
    if (abort.signal.aborted) throw new Error("Website perusahaan terlalu lama merespons (lebih dari 2 menit)");
    throw e;
  } finally {
    clearTimeout(deadline);
  }
}

Deno.serve((req) => AI_CTX.run({ req }, async () => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // Cuma diisi SETELAH lolos auth - biar catch di bawah gak bisa nandain
  // "failed" lead milik org lain dari request yang gak berhak.
  let authorizedId = null;
  try {
    const { generated_lead_id: glId } = await req.json();
    if (!glId) return json({ error: "generated_lead_id wajib diisi" }, 400);

    // Hanya dari generate-leads (otomatis). Lengkapi ulang manual dihapus
    // 6 Okt 2026 (Nando: "hanya dari hasil generate lead itu hasil semuanya").
    const isInternal = !!CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;
    if (!isInternal) return json({ error: "Lengkapi kontak manual tidak tersedia. Kontak dilengkapi otomatis saat Generate Leads." }, 410);

    const { data: gl } = await admin.from("generated_leads").select("*").eq("id", glId).maybeSingle();
    if (!gl) return json({ error: "Lead hasil generate tidak ditemukan" }, 404);

    authorizedId = gl.id;
    aiSetUser(gl.created_by, gl.org_id);
    await admin.from("generated_leads").update({ enrich_status: "pending", enrich_started_at: new Date().toISOString() }).eq("id", gl.id);
    const updated = await enrich(admin, gl);
    return json({ ok: true, lead: updated });
  } catch (e) {
    console.log("[enrich-generated-lead] gagal", authorizedId, String(e));
    if (authorizedId) { try { await admin.from("generated_leads").update({ enrich_status: "failed" }).eq("id", authorizedId); } catch (_) {} }
    return json({ error: String(e?.message || e) }, 500);
  }
}));
