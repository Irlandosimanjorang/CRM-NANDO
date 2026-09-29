// Supabase Edge Function: enrich-generated-lead
// Lengkapi & verifikasi kontak SATU perusahaan hasil Generate Leads: buka
// website resminya (web_fetch) buat dapet website terverifikasi, telepon,
// email resmi, dan PIC yang MASIH kerja di situ.
//
// Dua cara dipanggil:
// 1. OTOMATIS (utama) - generate-leads, abis nyimpen hasil, nembak fungsi ini
//    buat SEMUA lead sekaligus lewat pg_net (dispatch_lead_enrichment) dengan
//    header x-cron-secret. Tiap lead = 1 invocation sendiri, jadi paralel &
//    gak kepotong batas 150 detik generate-leads.
// 2. MANUAL - tombol "Coba lagi" di kartu yang enrich_status-nya gagal (JWT
//    user biasa, kena tier gate + kuota harian).
// verify_jwt dimatiin di gateway karena mode 1 gak bawa JWT - auth dicek
// manual di bawah (cron secret ATAU user login).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DAILY_LIMIT = 20;
const MAX_CONTINUATIONS = 4;
const MAX_RATE_RETRIES = 3;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()) - WIB_OFFSET_MS);
}

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
  // $0.1, output $5; web search $10/1000. Web fetch gratis (cuma token).
  const costUsd = (usage.input * 1 + usage.cache_write * 1.25 + usage.cache_read * 0.1 + usage.output * 5) / 1e6 + usage.searches * 0.01;
  console.log("[enrich-generated-lead] USAGE", JSON.stringify({ ...usage, cost_usd: Math.round(costUsd * 10000) / 10000 }));
  return (dat?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// Kena bunuh platform di 150 detik = gak sempet nyatet status (nyangkut
// "pending"). Dipotong sendiri lebih dulu biar statusnya jadi "failed" dan
// user bisa klik "coba lagi".
const ENRICH_DEADLINE_MS = 125 * 1000;
const FORMER_RE = /\b(mantan|former|ex)\b|\bex-/i;

async function enrich(admin, gl) {
  // Jabatan yang dicari user di form generate (bukan jabatan PIC yang
  // kebetulan ketemu di tahap 1 - itu sering CEO/Direktur).
  let requestedRole = "";
  let { data: job } = gl.run_id
    ? await admin.from("lead_gen_jobs").select("params").eq("run_id", gl.run_id).limit(1).maybeSingle()
    : { data: null };
  if (!job) {
    // Enrichment dikirim SEBELUM job-nya sempet dicatet run_id-nya (masih
    // "running") - ambil job terbaru org ini yang dibuat sebelum lead ini.
    ({ data: job } = await admin.from("lead_gen_jobs").select("params").eq("org_id", gl.org_id).lte("created_at", gl.created_at || new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle());
  }
  requestedRole = String(job?.params?.targetRole || "").trim();
  const targetRole = requestedRole || gl.key_person_title || "pengambil keputusan pembelian yang relevan sama produk";
  const prompt = `Tugas: lengkapi & VERIFIKASI data kontak SATU perusahaan di Indonesia buat kebutuhan sales B2B.

Perusahaan: "${gl.name}"
Kota: ${gl.city || "-"}
Kategori: ${gl.category || "-"}
Produk yang mau ditawarin ke mereka: ${gl.product || "-"}
Website yang tercatat (BELUM tentu benar): ${gl.website || "(belum ada)"}
PIC yang tercatat: ${gl.key_person ? `${gl.key_person} (${gl.key_person_title || "-"})` : "(belum ada)"}
Jabatan PIC yang dicari: ${targetRole}

Langkah:
1. Pastikan website resmi perusahaan ini lewat web search (domain resmi, bukan direktori/portal lowongan). Kalau website tercatat di atas ternyata salah, ganti.
2. Buka (web_fetch) MAKSIMAL 2 halaman website resmi yang paling mungkin berisi kontak: prioritas halaman Kontak/Contact Us, lalu Karir/Careers. Ambil telepon dan email yang tercantum di situ. Jatah pencarian cuma 3x - gabungin kebutuhan (misal cari domain resmi + halaman kontak dalam 1 query).
3. Cari PIC dengan JABATAN TARGET di atas (atau padanan dekatnya - misal buat HRD: HR Manager, Head of People, HR Business Partner, Talent Acquisition, CHRO) lewat web search (misal site:linkedin.com/in "${gl.name}" ${targetRole}). Ambil HANYA kalau cuplikan menunjukkan orang itu MASIH kerja di perusahaan ini (bukan "ex-", "former", "mantan", atau perusahaan lain). JANGAN ganti dengan CEO/Direktur/jabatan lain yang bukan target - kalau gak nemu PIC di jabatan target, kosongin key_person.

PRIORITAS KONTAK:
- phone: (1) nomor kontak bisnis PIC kalau DIPUBLIKASIKAN secara publik oleh PIC itu sendiri atau perusahaannya (misal di halaman tim/kontak), kalau gak ada (2) telepon kantor/perusahaan yang tercantum publik.
- email: (1) email bisnis PIC kalau tertulis publik, kalau gak ada (2) email HR/karir/recruitment (kalau jabatan target HR), kalau gak ada (3) email umum/info/sales perusahaan.

ATURAN KERAS:
- JANGAN mengarang atau menebak pola email (misal nama.belakang@domain) atau nomor telepon. Cuma boleh diisi kalau TERTULIS PERSIS di halaman/cuplikan yang kamu lihat.
- Field yang gak ketemu dengan yakin = string kosong.

Balas HANYA JSON object tanpa markdown:
{"website":"","website_verified":false,"phone":"","phone_type":"pic|office|","email":"","email_type":"pic|hr|careers|general|sales|","key_person":"","key_person_title":"","pic_status":"confirmed|left|not_found","sources":"1 kalimat: halaman/sumber yang dipakai","score_contact_quality":0}
pic_status: "confirmed" = PIC di key_person terbukti masih kerja di sini; "left" = PIC yang tercatat terbukti udah pindah dan gak nemu penggantinya; "not_found" = gak berhasil mastiin apa-apa.
score_contact_quality 1-100 = seberapa lengkap & terverifikasi kontak hasil akhirnya.`;

  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), ENRICH_DEADLINE_MS);
  let text;
  try {
    text = await callClaudeWithContinuation({
      // Target biaya ±$0,10/lead (29 Sep 2026, permintaan Nando). Diukur:
      // Sonnet 5.5 + 5 search/4 fetch = ±$0,22; Sonnet 5.5 + 3 search/2
      // fetch = ±$0,17 (mayoritas token dari hasil search). Tugas ini cuma
      // ekstraksi kontak, jadi pakai Haiku 4.5 (setengah harga). Haiku 4.5
      // gak dukung dynamic filtering, jadi pakai versi tool basic.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: 2, max_content_tokens: 3000 },
      ],
    }, abort.signal);
  } catch (e) {
    if (abort.signal.aborted) throw new Error("Kelamaan buka website perusahaannya (lewat 2 menit)");
    throw e;
  } finally {
    clearTimeout(deadline);
  }

  let obj = null;
  const x = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"), e = x.lastIndexOf("}");
  if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }
  if (!obj) throw new Error("AI gagal ngolah hasil pencarian");

  const clean = (s) => String(s || "").trim();
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const newEmail = clean(obj.email);
  const pic = clean(obj.key_person);
  const picStatus = clean(obj.pic_status);
  // PIC lama cuma dihapus kalau TERBUKTI udah pindah ("left"); kalau AI
  // cuma gagal mastiin ("not_found"), data lama dipertahanin.
  let keyPerson = pic || (picStatus === "left" ? "" : (gl.key_person || ""));
  let keyPersonTitle = pic ? clean(obj.key_person_title) : (picStatus === "left" ? "" : (gl.key_person_title || ""));
  // Jaring pengaman: PIC yang jabatannya ketulis "mantan/former/ex" jelas
  // udah gak di situ - buang, walau AI-nya kelolosan ngisi.
  if (FORMER_RE.test(keyPersonTitle)) { keyPerson = ""; keyPersonTitle = ""; }
  const phoneLabel = clean(obj.phone_type) === "pic" ? "telp PIC" : "telp kantor";
  const emailLabel = { pic: "email PIC", hr: "email HR", careers: "email karir", general: "email umum", sales: "email sales" }[clean(obj.email_type)] || "email";

  const update = {
    website: clean(obj.website) || gl.website || "",
    phone: clean(obj.phone) || gl.phone || "",
    email: isEmail(newEmail) ? newEmail : (gl.email || ""),
    key_person: keyPerson,
    key_person_title: keyPersonTitle,
    source_note: [
      gl.source_note,
      `Dilengkapi AI: ${clean(obj.sources) || "website resmi"}${obj.website_verified ? " (website terverifikasi)" : ""}${clean(obj.phone) ? `; ${phoneLabel}` : ""}${isEmail(newEmail) ? `; ${emailLabel}` : ""}`,
    ].filter(Boolean).join(" | ").slice(0, 600),
    enrich_status: "done",
  };
  const cq = Number(obj.score_contact_quality);
  if (Number.isFinite(cq)) update.score_contact_quality = Math.max(1, Math.min(100, Math.round(cq)));

  const { data: updated, error: upErr } = await admin.from("generated_leads").update(update).eq("id", gl.id).eq("org_id", gl.org_id).select("*").single();
  if (upErr) throw new Error("Gagal nyimpen hasil: " + upErr.message);
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // Cuma diisi SETELAH lolos auth - biar catch di bawah gak bisa nandain
  // "failed" lead milik org lain dari request yang gak berhak.
  let authorizedId = null;
  try {
    const { generated_lead_id: glId } = await req.json();
    if (!glId) return json({ error: "generated_lead_id wajib diisi" }, 400);

    const isInternal = !!CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;
    let gl;

    if (isInternal) {
      const { data } = await admin.from("generated_leads").select("*").eq("id", glId).maybeSingle();
      if (!data) return json({ error: "Lead hasil generate gak ketemu" }, 404);
      gl = data;
    } else {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      const userId = userData.user.id;
      const isAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;

      const { data: memberRow } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
      if (!memberRow) return json({ error: "Organisasi gak ketemu" }, 400);
      const { data: orgRow } = await supabase.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
      const { data: settingsRow } = await supabase.from("settings").select("plan").eq("user_id", userId).maybeSingle();
      const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
      const level = orgRow?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
      if (!isAdmin && level < 2) return json({ error: "Fitur ini khusus paket Professional ke atas." }, 403);

      // Lewat client user (RLS) - cuma bisa baca hasil generate org sendiri.
      const { data, error: glErr } = await supabase.from("generated_leads").select("*").eq("id", glId).maybeSingle();
      if (glErr || !data) return json({ error: "Lead hasil generate gak ketemu" }, 404);
      gl = data;

      if (!isAdmin) {
        const { data: ok, error: rlErr } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: "enrich-generated-lead", p_window_start: wibDayStartUTC().toISOString(), p_max_calls: DAILY_LIMIT });
        if (rlErr || !ok) return json({ error: `Kuota lengkapi kontak (${DAILY_LIMIT}x/hari) udah kepake. Coba lagi besok.` }, 429);
      }
    }

    authorizedId = gl.id;
    await admin.from("generated_leads").update({ enrich_status: "pending", enrich_started_at: new Date().toISOString() }).eq("id", gl.id);
    const updated = await enrich(admin, gl);
    return json({ ok: true, lead: updated });
  } catch (e) {
    console.log("[enrich-generated-lead] gagal", authorizedId, String(e));
    if (authorizedId) { try { await admin.from("generated_leads").update({ enrich_status: "failed" }).eq("id", authorizedId); } catch (_) {} }
    return json({ error: String(e) }, 500);
  }
});
