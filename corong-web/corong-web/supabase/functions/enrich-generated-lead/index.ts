// Supabase Edge Function: enrich-generated-lead
// Dipanggil ON-DEMAND dari kartu hasil Generate Leads (tombol "Lengkapi
// kontak (AI)"). Fokus ke SATU perusahaan: buka website resminya (halaman
// kontak/karir) lewat web_fetch buat dapet website terverifikasi, telepon
// kantor, email resmi (HR/karir/umum), dan PIC yang MASIH kerja di situ.
// Dipisah dari generate-leads karena buka banyak halaman per perusahaan gak
// muat di batas waktu 150 detik kalau dikerjain sekaligus buat 14 lead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DAILY_LIMIT = 20;
const MAX_CONTINUATIONS = 4;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()) - WIB_OFFSET_MS);
}

// Server tool (search/fetch) bisa berhenti di tengah dengan stop_reason
// "pause_turn" - kalau gak dilanjutin, jawaban JSON finalnya gak pernah ada.
async function callClaudeWithContinuation(body) {
  const messages = [...body.messages];
  let dat = null;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ ...body, messages }),
    });
    if (!resp.ok) throw new Error(`AI gagal: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    dat = await resp.json();
    if (dat.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: dat.content });
  }
  return (dat?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { generated_lead_id } = await req.json();
    if (!generated_lead_id) return json({ error: "generated_lead_id wajib diisi" }, 400);

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
    if (!isAdmin && level < 2) return json({ error: "Lengkapi kontak (AI) itu fitur khusus paket Professional ke atas." }, 403);

    // Lewat client user (RLS) - cuma bisa baca hasil generate org sendiri.
    const { data: gl, error: glErr } = await supabase.from("generated_leads").select("*").eq("id", generated_lead_id).maybeSingle();
    if (glErr || !gl) return json({ error: "Lead hasil generate gak ketemu" }, 404);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    if (!isAdmin) {
      const { data: ok, error: rlErr } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: "enrich-generated-lead", p_window_start: wibDayStartUTC().toISOString(), p_max_calls: DAILY_LIMIT });
      if (rlErr || !ok) return json({ error: `Kuota Lengkapi kontak (AI) (${DAILY_LIMIT}x/hari) udah kepake. Coba lagi besok.` }, 429);
    }

    const targetRole = gl.key_person_title || "HRD / HR Manager / Head of People / Purchasing (sesuai konteks produk)";
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
2. Buka (web_fetch) halaman website resmi yang relevan: halaman Kontak/Contact Us, Karir/Careers, atau About. Ambil telepon kantor dan email RESMI yang tercantum di situ (prioritas: email HR/karir/recruitment kalau jabatan targetnya HR, selain itu email umum/sales/info).
3. Cari PIC dengan jabatan target lewat web search (misal site:linkedin.com/in "${gl.name}" HR). Ambil HANYA kalau cuplikan menunjukkan orang itu MASIH kerja di perusahaan ini (bukan "ex-", "former", atau perusahaan lain). Kalau PIC yang tercatat ternyata udah pindah, kosongin.

ATURAN KERAS:
- JANGAN mengarang atau menebak pola email (misal nama.belakang@domain). Email cuma boleh diisi kalau TERTULIS PERSIS di halaman/cuplikan yang kamu lihat.
- JANGAN isi nomor HP pribadi orang. Telepon yang diisi = telepon kantor/perusahaan yang tercantum publik.
- Field yang gak ketemu dengan yakin = string kosong.

Balas HANYA JSON object tanpa markdown:
{"website":"","website_verified":false,"phone":"","email":"","email_type":"hr|careers|general|sales|","key_person":"","key_person_title":"","pic_status":"confirmed|left|not_found","sources":"1 kalimat: halaman/sumber yang dipakai","score_contact_quality":0}
pic_status: "confirmed" = PIC di key_person terbukti masih kerja di sini; "left" = PIC yang tercatat terbukti udah pindah dan gak nemu penggantinya; "not_found" = gak berhasil mastiin apa-apa.
score_contact_quality 1-100 = seberapa lengkap & terverifikasi kontak hasil akhirnya.`;

    const text = await callClaudeWithContinuation({
      model: "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        { type: "web_search_20260318", name: "web_search", max_uses: 5, response_inclusion: "excluded" },
        { type: "web_fetch_20260318", name: "web_fetch", max_uses: 4, max_content_tokens: 8000, response_inclusion: "excluded" },
      ],
    });

    let obj = null;
    const x = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"), e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }
    if (!obj) return json({ error: "AI gagal ngolah hasil pencarian, coba lagi." }, 500);

    const clean = (s) => String(s || "").trim();
    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    const newEmail = clean(obj.email);
    const pic = clean(obj.key_person);
    const picStatus = clean(obj.pic_status);
    // PIC lama cuma dihapus kalau TERBUKTI udah pindah ("left"); kalau AI
    // cuma gagal mastiin ("not_found"), data lama dipertahanin.
    const keyPerson = pic || (picStatus === "left" ? "" : (gl.key_person || ""));
    const keyPersonTitle = pic ? clean(obj.key_person_title) : (picStatus === "left" ? "" : (gl.key_person_title || ""));

    const update = {
      website: clean(obj.website) || gl.website || "",
      phone: clean(obj.phone) || gl.phone || "",
      email: isEmail(newEmail) ? newEmail : (gl.email || ""),
      key_person: keyPerson,
      key_person_title: keyPersonTitle,
      source_note: [gl.source_note, `Dilengkapi AI: ${clean(obj.sources) || "website resmi"}${obj.website_verified ? " (website terverifikasi)" : ""}`].filter(Boolean).join(" | ").slice(0, 500),
    };
    const cq = Number(obj.score_contact_quality);
    if (Number.isFinite(cq)) update.score_contact_quality = Math.max(1, Math.min(100, Math.round(cq)));

    const { data: updated, error: upErr } = await admin.from("generated_leads").update(update).eq("id", gl.id).eq("org_id", memberRow.org_id).select("*").single();
    if (upErr) return json({ error: "Gagal nyimpen hasil: " + upErr.message }, 500);

    return json({ ok: true, lead: updated, email_type: clean(obj.email_type), website_verified: !!obj.website_verified });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
