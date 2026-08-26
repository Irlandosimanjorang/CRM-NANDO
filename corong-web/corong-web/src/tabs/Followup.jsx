// Supabase Edge Function: draft-followup
// Dipanggil ON-DEMAND dari LeadModal (tombol "Draft WhatsApp" / "Draft Email").
// Beda dari daily-digest (jalan cron buat SEMUA lead), ini baca histori SATU
// lead spesifik & bikin draft pesan personal - biaya cuma kejadi pas user
// beneran klik tombolnya, bukan otomatis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

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
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.pvc_chemical;
const industryNoun = (key) => (key === "automotive" || key === "property" || key === "insurance" ? "customer" : "perusahaan");

function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { lead_id, channel } = await req.json();
    if (!lead_id || !["whatsapp", "email"].includes(channel)) {
      return new Response(JSON.stringify({ error: "lead_id dan channel (whatsapp/email) wajib diisi" }), { status: 400, headers: cors });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    // RLS otomatis nge-filter, cuma bisa akses lead punya org sendiri.
    const { data: lead, error: leadErr } = await supabase.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", lead_id).single();
    if (leadErr || !lead) return new Response(JSON.stringify({ error: "Lead gak ketemu" }), { status: 404, headers: cors });

    let industryKey = "pvc_chemical";
    const { data: memberRow } = await supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    if (memberRow) {
      const { data: org } = await supabase.from("organizations").select("industry").eq("id", memberRow.org_id).maybeSingle();
      industryKey = org?.industry || "pvc_chemical";
    }

    // ---- OUTCOME MEMORY - baca pola menang/kalah dari SEMUA lead org ini yang
    // udah closed (bukan cuma histori lead ini doang), biar draft pesan-nya
    // ngambil pelajaran dari pengalaman kolektif, bukan generik/template.
    // PENGAMAN: minimal 3 sample per kategori sebelum "pola" ini disuapin ke AI.
    let outcomeMemory = "";
    if (memberRow) {
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
      ? `Tulis pesan WhatsApp - singkat, casual tapi sopan, maksimal 4-5 kalimat, TANPA subjek/kop surat, siap kirim langsung apa adanya.
ATURAN FORMAT (penting):
- JANGAN pakai emoji atau simbol dekoratif apapun (kadang muncul jadi karakter rusak/kotak aneh pas dikirim ke WhatsApp beneran) - pake tanda baca standar aja: titik, koma, tanda tanya (?), tanda seru (!), titik koma (;).
- Titik koma (;) boleh dipake buat nggabungin 2 klausa yang berkaitan erat, KALAU emang pas secara gramatikal - jangan dipaksain kalau gak perlu.
- Kalau pesannya lumayan panjang (lebih dari ~2 kalimat, atau ngebahas lebih dari 1 topik/poin), PECAH jadi beberapa baris pendek dipisah baris kosong (kayak orang WhatsApp beneran ngetik per-poin, bukan satu paragraf gede numpuk semua).`
      : `Tulis email follow-up - agak lebih formal dari WhatsApp, ada salam pembuka & penutup singkat, kasih subjek email yang relevan juga. JANGAN pakai emoji atau simbol dekoratif. Titik koma (;) boleh dipake buat gabungin klausa yang berkaitan erat kalau pas secara gramatikal.`;

    const prompt = `Kamu asisten sales yang bantu bikin draft pesan follow-up ke ${noun} di bisnis ${industryContext(industryKey)}.

Data ${noun} ini: ${JSON.stringify(context)}
${outcomeMemory ? `\nKONTEKS HISTORI ORG INI (Outcome Memory - dari lead-lead lain yang udah closed sebelumnya): ${outcomeMemory} MANFAATIN ini buat bikin pendekatan yang lebih strategis - misal kalau histori org sering kalah karena harga, pertimbangkan singgung value/kualitas duluan sebelum masuk harga; kalau ada contoh alasan menang yang relevan, ambil pendekatan serupa. TAPI tetep personal ke situasi ${lead.name} spesifik, jangan asal tempel pola generik.\n` : ""}
${channelInstruction}

Personalisasi berdasarkan histori progress di atas - kalau ada pertanyaan/objection yang keliatan belum kejawab, singgung itu secara halus. Kalau belum ada histori progress sama sekali (belum pernah dikontak), buat pesan follow-up perkenalan yang natural, bukan template kaku. JANGAN mengarang detail yang gak ada di data (harga, tanggal spesifik, dst).

Balas HANYA dengan JSON object, tanpa markdown, persis:
${channel === "whatsapp" ? '{"message":"..."}' : '{"subject":"...","body":"..."}'}
Tulis dalam Bahasa Indonesia yang natural.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) return new Response(JSON.stringify({ error: "AI gagal generate draft" }), { status: 500, headers: cors });
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }

    if (channel === "whatsapp" && !obj.message) return new Response(JSON.stringify({ error: "AI gagal bikin draft, coba lagi" }), { status: 500, headers: cors });
    if (channel === "email" && (!obj.subject || !obj.body)) return new Response(JSON.stringify({ error: "AI gagal bikin draft, coba lagi" }), { status: 500, headers: cors });

    // Jaring pengaman - bersihin karakter "kotak rusak" (replacement character,
    // U+FFFD) kalau-kalau AI kelolosan nyisipin emoji yang encoding-nya berantakan.
    const cleanText = (s) => (s || "").replace(/\uFFFD/g, "").replace(/ {2,}/g, " ");
    if (obj.message) obj.message = cleanText(obj.message);
    if (obj.subject) obj.subject = cleanText(obj.subject);
    if (obj.body) obj.body = cleanText(obj.body);

    return new Response(JSON.stringify(obj), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
