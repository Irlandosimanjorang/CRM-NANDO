// Supabase Edge Function: draft-followup
// Dipanggil ON-DEMAND dari LeadModal/Leads/Dashboard (tombol "Draft WhatsApp" /
// "Draft Email"). Beda dari daily-digest (jalan cron buat SEMUA lead), ini baca
// histori SATU lead spesifik & bikin draft pesan personal - biaya cuma kejadi
// pas user beneran klik tombolnya, bukan otomatis.
//
// (Riwayat fix lama: draft disimpen ke ai_drafts SEBELUM return + dipake ulang
// kalau masih <24 jam, tier gate Professional+, rate limit 5x generate baru
// per hari WIB lewat RPC atomic, org_memory, max_tokens 900 biar gak
// kepotong - detail lengkap ada di versi sebelumnya.)
//
// === MODEL (29 Sep 2026) === Sonnet 4.6 -> Sonnet 5.5 (lebih murah $2/$10
// vs $3/$15), tanpa "mikir di awal" (between_tools). Sekalian nambah konteks
// industri corporate_consultant yang sebelumnya belum ada di sini.
//
// === KATALOG PRODUK (30 Sep 2026, Enterprise) === Kalau org Enterprise udah
// ngisi katalog produk/layanan (org_product_catalog) di Pengaturan, draft
// nyebut produk yang relevan secara natural - diprioritasin yang udah
// direkomendasiin Ringkasan Kebutuhan (AI) buat lead ini.
//
// === PROFESIONAL (1 Okt 2026, permintaan Nando) ===
// - Gaya draft WhatsApp dulu "casual tapi sopan" - padahal pesan ini dikirim
//   ke customer/klien korporat. Sekarang ringkas, sopan, profesional.
// - Pesan error ke user pakai bahasa baku.
// - Kuota dikembalikan kalau AI gagal (dulu tetap kepotong).
// - Org tanpa industri jatuh ke konteks B2B umum, bukan PVC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DRAFT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // draft yang masih fresh (<24 jam) dipake ulang, gak generate baru
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Awal hari kalender WIB (jam 00:00 WIB) - dikonversi balik ke instant UTC
// buat dipake sebagai batas query `called_at >=`.
function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth(), day = wibNow.getUTCDate();
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WIB_OFFSET_MS);
}

// Rate limit PER USER, dipatok ke awal hari kalender WIB (bukan rolling 24 jam).
// Lewat RPC reserve_edge_function_call biar check+insert atomic. Balikin id
// reservasi (buat dikembalikan kalau AI gagal) atau null kalau kuota habis.
async function reserveDaily(admin, userId, functionName, maxCalls) {
  const windowStart = wibDayStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[draft-followup] reserve_edge_function_call gagal:", error); return null; }
  return data || null;
}

// ---- VECTOR MEMORY - sama kayak di daily-digest: narik catatan progress
// paling relevan (bukan cuma yang terakhir), gabungan recency + kemiripan. ----
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

async function getRelevantNotes(supabase, lead) {
  const allNotes = lead.progress_notes || [];
  if (allNotes.length === 0) return [];
  const sorted = [...allNotes].sort((a, b) => (a.note_date < b.note_date ? 1 : -1));
  if (allNotes.length <= 4) return sorted.slice(0, 4).reverse();

  const recent = sorted.slice(0, 2);
  try {
    const queryText = `${lead.name} ${lead.product || ""} status pelanggan, objection, sinyal beli, langkah selanjutnya`;
    const queryEmbedding = await getEmbedding(queryText);
    if (!queryEmbedding) return sorted.slice(0, 4).reverse();

    const { data: matches } = await supabase.rpc("match_progress_notes", {
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
    return sorted.slice(0, 4).reverse();
  }
}

// Duplikat ringan dari src/lib/industryTemplates.js (Edge Function jalan di
// Deno, beda runtime, gak bisa import langsung dari kode React).
const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri. Istilah relevan: tonase, resin, kompon",
  automotive: "dealer kendaraan (mobil/motor). Istilah relevan: test drive, unit, DP, cicilan, trade-in",
  property: "agen/developer properti. Istilah relevan: viewing, booking fee, KPR, luas tanah/bangunan",
  b2b_general: "distributor/trading B2B umum. Istilah relevan: quotation, PO, sample, reorder",
  insurance: "agen asuransi/financial services. Istilah relevan: premi, polis, nilai pertanggungan",
  retail_fmcg: "distribusi retail/FMCG. Istilah relevan: outlet, karton, distributor area, repeat order",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project buat perusahaan. Istilah relevan: SPK, scope of work, quotation, termin pembayaran, invoice, deliverable",
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.b2b_general;
const industryNoun = (key) => (key === "automotive" || key === "property" || key === "insurance" ? "customer" : "perusahaan");

function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let admin = null;
  let reservationId = null;
  const releaseQuota = async () => {
    if (!admin || !reservationId) return;
    try { await admin.rpc("release_edge_function_call", { p_id: reservationId }); } catch (_) { /* best effort */ }
    reservationId = null;
  };

  try {
    const { lead_id, channel } = await req.json();
    if (!lead_id || !["whatsapp", "email"].includes(channel)) {
      return new Response(JSON.stringify({ error: "lead_id dan channel (whatsapp/email) wajib diisi" }), { status: 400, headers: cors });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    // ---- TIER GATE - AI Draft Follow-up itu fitur PROFESSIONAL ke atas.
    // Dicek DULUAN, sebelum lead di-fetch atau cache di-cek, biar user yang
    // belum bayar gak numpang biaya AI sama sekali.
    const { data: gateMemberRow } = await supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    const gateOrgResult = gateMemberRow ? await supabase.from("organizations").select("plan").eq("id", gateMemberRow.org_id).maybeSingle() : { data: null };
    const { data: gateSettingsRow } = await supabase.from("settings").select("plan").eq("user_id", userData.user.id).maybeSingle();
    const GATE_PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const gateIsEnterprise = gateOrgResult.data?.plan === "enterprise";
    const gateMyPlanLevel = gateIsEnterprise ? 2 : (GATE_PLAN_LEVEL[gateSettingsRow?.plan] ?? 0);
    if (gateMyPlanLevel < 2) {
      return new Response(JSON.stringify({ error: "AI Draft Follow-up tersedia untuk paket Professional ke atas. Silakan upgrade di tab Pengaturan." }), { status: 403, headers: cors });
    }

    // RLS otomatis nge-filter, cuma bisa akses lead punya org sendiri.
    const { data: lead, error: leadErr } = await supabase.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", lead_id).single();
    if (leadErr || !lead) return new Response(JSON.stringify({ error: "Lead tidak ditemukan" }), { status: 404, headers: cors });

    // ---- CEK DRAFT TERSIMPAN DULU - kalau ada yang masih fresh (<24 jam) buat
    // lead+channel yang sama, PAKE ITU LANGSUNG, jangan generate baru. Ini
    // JUGA gak numpang kuota harian - cuma generate BARU yang dihitung. ----
    const { data: cached } = await supabase.from("ai_drafts").select("*").eq("lead_id", lead_id).eq("channel", channel).maybeSingle();
    if (cached && Date.now() - new Date(cached.created_at).getTime() < DRAFT_CACHE_TTL_MS) {
      const cachedResult = channel === "whatsapp" ? { message: cached.message } : { subject: cached.subject, body: cached.body };
      return new Response(JSON.stringify({ ...cachedResult, cached: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---- RATE LIMIT - 5x GENERATE BARU per hari kalender WIB per user (cache
    // hit di atas gak kena hitungan ini).
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    reservationId = await reserveDaily(admin, userData.user.id, "draft-followup", 5);
    if (!reservationId) {
      return new Response(JSON.stringify({ error: "Kuota AI Draft Follow-up (5x/hari) sudah terpakai. Silakan coba lagi besok, atau tulis pesan secara manual." }), { status: 429, headers: cors });
    }

    let industryKey = "b2b_general";
    const memberRow = gateMemberRow;
    if (memberRow) {
      const { data: org } = await supabase.from("organizations").select("industry").eq("id", memberRow.org_id).maybeSingle();
      industryKey = org?.industry || "b2b_general";
    }

    // ---- ORG MEMORY (diutamakan) - pola menang/kalah dari SELURUH histori
    // deal org ini (disintesis pipeline-review). Fallback ke logic
    // top_win/top_loss lama kalau org_memory belum ada.
    let outcomeMemory = "";
    if (memberRow) {
      try {
        const { data: orgMem } = await admin.from("org_memory").select("ideal_customer_profile, common_objections, winning_playbook").eq("org_id", memberRow.org_id).maybeSingle();
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
        console.log("[draft-followup] gagal baca org_memory, fallback ke logic lama:", String(e));
      }

      if (!outcomeMemory) {
        const { data: closedLeads } = await supabase.from("leads").select("outcome").eq("org_id", memberRow.org_id).not("outcome", "is", null).limit(300);
        const all = closedLeads || [];
        const won = all.filter((c) => c.outcome?.result === "won");
        const lost = all.filter((c) => c.outcome?.result === "lost");
        const winReasons = {}; for (const c of won) { const cat = c.outcome?.reason_category; if (cat) winReasons[cat] = (winReasons[cat] || 0) + 1; }
        const lossReasons = {}; for (const c of lost) { const cat = c.outcome?.reason_category; if (cat) lossReasons[cat] = (lossReasons[cat] || 0) + 1; }
        const MIN_SAMPLE = 3;
        const winTotal = Object.values(winReasons).reduce((a, b) => a + b, 0);
        const lossTotal = Object.values(lossReasons).reduce((a, b) => a + b, 0);
        const topWin = winTotal >= MIN_SAMPLE ? Object.entries(winReasons).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
        const topLoss = lossTotal >= MIN_SAMPLE ? Object.entries(lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
        const wonExamples = won.filter((c) => c.outcome?.reason).slice(0, 2).map((c) => c.outcome.reason);

        if (topWin || topLoss) {
          const parts = [];
          if (topWin) parts.push(`biasanya MENANG karena "${topWin}"`);
          if (topLoss) parts.push(`biasanya KALAH karena "${topLoss}"`);
          outcomeMemory = `Dari histori org ini, ${parts.join(", ")}.`;
          if (wonExamples.length) outcomeMemory += ` Contoh alasan menang sebelumnya: ${wonExamples.map((r) => `"${r}"`).join("; ")}.`;
        }
      }
    }

    // ---- KATALOG PRODUK (Enterprise) + rekomendasi dari Ringkasan Kebutuhan.
    let catalogBlock = "";
    if (memberRow && gateIsEnterprise) {
      const [{ data: catalog }, { data: needs }] = await Promise.all([
        supabase.from("org_product_catalog").select("company_profile, products").eq("org_id", memberRow.org_id).maybeSingle(),
        supabase.from("lead_needs_summaries").select("summary, product_recommendations").eq("lead_id", lead_id).maybeSingle(),
      ]);
      const products = (Array.isArray(catalog?.products) ? catalog.products : []).filter((p) => p?.name).slice(0, 8);
      if (products.length) {
        const list = products.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}${p.fit_for ? ` (cocok untuk: ${p.fit_for})` : ""}${p.price ? ` [harga: ${p.price}]` : ""}`).join("\n");
        const recs = (Array.isArray(needs?.product_recommendations) ? needs.product_recommendations : []).filter((r) => r?.product);
        catalogBlock = `\nPERUSAHAAN KITA (pengirim pesan): ${catalog.company_profile || "-"}
Katalog produk/layanan kita:
${list}
${needs?.summary ? `Ringkasan kebutuhan ${lead.name} (hasil analisis notulen sebelumnya): ${needs.summary}\n` : ""}${recs.length ? `Produk yang udah direkomendasiin buat lead ini: ${recs.map((r) => `${r.product} (${r.reason})`).join("; ")}\n` : ""}
Kalau ada produk di katalog yang nyambung sama kebutuhan/histori ${lead.name}, sebut SECARA NATURAL maks 1-2 produk paling relevan${recs.length ? " (prioritasin yang udah direkomendasiin di atas)" : ""}. JANGAN sebut produk di luar katalog, JANGAN bikin pesannya kayak brosur/daftar produk. Harga cuma boleh disebut kalau ada di katalog DAN emang relevan sama obrolannya. Kalau gak ada yang nyambung, gak usah maksa nyebut produk.\n`;
      }
    }

    const noun = industryNoun(industryKey);
    const relevantNotes = await getRelevantNotes(supabase, lead);
    const recentProgress = relevantNotes.map((p) => `${p.note_date}: ${(p.text || "").slice(0, 200)}`);
    const context = {
      name: lead.name, product: lead.product || "", category: lead.category || "",
      days_since_contact: daysSince(lead.last_contact) ?? "belum pernah",
      key_person: lead.key_person || "", key_person_title: lead.key_person_title || "",
      current_next_action: lead.next_action || "",
      recent_progress: recentProgress,
    };

    const channelInstruction = channel === "whatsapp"
      ? `Tulis pesan WhatsApp - ringkas, sopan, dan profesional (bahasa Indonesia baku yang luwes, tidak kaku seperti surat resmi), maksimal 4-5 kalimat, TANPA subjek/kop surat, siap kirim langsung apa adanya. Sapa dengan "Bapak/Ibu" + nama jika key person diketahui. JANGAN pakai bahasa gaul (misal "gak", "udah", "aja", "kak", "bro").
ATURAN FORMAT (penting):
- JANGAN pakai emoji atau simbol dekoratif apapun (kadang muncul jadi karakter rusak/kotak aneh pas dikirim ke WhatsApp beneran) - pake tanda baca standar aja: titik, koma, tanda tanya (?), tanda seru (!), titik koma (;).
- Titik koma (;) boleh dipake buat nggabungin 2 klausa yang berkaitan erat, KALAU emang pas secara gramatikal - jangan dipaksain kalau gak perlu.
- Kalau pesannya lumayan panjang (lebih dari ~2 kalimat, atau ngebahas lebih dari 1 topik/poin), PECAH jadi beberapa baris pendek dipisah baris kosong (kayak orang WhatsApp beneran ngetik per-poin, bukan satu paragraf gede numpuk semua).`
      : `Tulis email follow-up yang profesional - ada salam pembuka & penutup singkat, kasih subjek email yang relevan juga. Bahasa Indonesia baku, sopan, tidak bertele-tele. JANGAN pakai emoji atau simbol dekoratif. Titik koma (;) boleh dipake buat gabungin klausa yang berkaitan erat kalau pas secara gramatikal.`;

    const prompt = `Kamu asisten sales yang bantu bikin draft pesan follow-up ke ${noun} di bisnis ${industryContext(industryKey)}.

Data ${noun} ini: ${JSON.stringify(context)}
${outcomeMemory ? `\nKONTEKS HISTORI ORG INI (dari lead-lead lain yang udah closed sebelumnya): ${outcomeMemory} MANFAATIN ini buat bikin pendekatan yang lebih strategis - misal kalau ada objection yang mirip sama yang sering muncul di org ini, pake cara ngatasin yang udah kebukti berhasil; kalau ada taktik yang kebukti bikin menang, pertimbangkan pendekatan serupa. TAPI tetep personal ke situasi ${lead.name} spesifik, jangan asal tempel pola generik.\n` : ""}${catalogBlock}
${channelInstruction}

Personalisasi berdasarkan histori progress di atas - kalau ada pertanyaan/objection yang keliatan belum kejawab, singgung itu secara halus. Kalau belum ada histori progress sama sekali (belum pernah dikontak), buat pesan follow-up perkenalan yang natural, bukan template kaku. JANGAN mengarang detail yang gak ada di data (harga, tanggal spesifik, dst).

Balas HANYA dengan JSON object, tanpa markdown, persis:
${channel === "whatsapp" ? '{"message":"..."}' : '{"subject":"...","body":"..."}'}
Tulis dalam Bahasa Indonesia baku yang profesional dan luwes.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 900, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) {
      await releaseQuota();
      return new Response(JSON.stringify({ error: "AI gagal membuat draft. Kuota Anda tidak terpakai, silakan coba lagi." }), { status: 500, headers: cors });
    }
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }

    if ((channel === "whatsapp" && !obj.message) || (channel === "email" && (!obj.subject || !obj.body))) {
      await releaseQuota();
      return new Response(JSON.stringify({ error: "AI gagal membuat draft. Kuota Anda tidak terpakai, silakan coba lagi." }), { status: 500, headers: cors });
    }

    // Jaring pengaman - bersihin karakter "kotak rusak" (replacement character,
    // U+FFFD) kalau-kalau AI kelolosan nyisipin emoji yang encoding-nya berantakan.
    const cleanText = (s) => (s || "").replace(/�/g, "").replace(/ {2,}/g, " ");
    if (obj.message) obj.message = cleanText(obj.message);
    if (obj.subject) obj.subject = cleanText(obj.subject);
    if (obj.body) obj.body = cleanText(obj.body);

    // ---- SIMPEN KE DATABASE SEBELUM RETURN - biar hasil generate TETEP
    // ke-simpen walau client udah disconnect pas response lagi otw. ----
    if (memberRow) {
      await supabase.from("ai_drafts").upsert(
        {
          lead_id, org_id: memberRow.org_id, channel,
          message: obj.message || null, subject: obj.subject || null, body: obj.body || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "lead_id,channel" }
      );
    }

    return new Response(JSON.stringify(obj), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    await releaseQuota();
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
