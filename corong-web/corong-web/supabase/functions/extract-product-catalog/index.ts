// Supabase Edge Function: extract-product-catalog
// Dipanggil dari kartu "Produk & Layanan Perusahaan" di Pengaturan (30 Sep
// 2026, permintaan Nando) - owner/manager upload company profile / brosur
// (PDF atau Word), AI ekstrak profil perusahaan + daftar produk/layanan-nya.
// Function ini TIDAK nulis ke DB - hasilnya balik ke form buat direview &
// diedit dulu, baru disimpan user lewat tombol "Simpan katalog".
//
// PDF dikirim langsung ke Claude (document block); Word diubah jadi teks
// polos di browser (mammoth) sebelum dikirim, karena Claude gak baca .docx.
// Khusus Enterprise, owner/manager, kuota 10x/bulan per user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHLY_LIMIT = 10;
const MAX_PDF_BASE64_CHARS = 6 * 1024 * 1024; // ~4.5MB file asli
const MAX_TEXT_CHARS = 60000;

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), 1, 0, 0, 0) - WIB_OFFSET_MS);
}

function parseObj(t) {
  const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); const e = x.lastIndexOf("}");
  if (a === -1 || e === -1) return null;
  try { return JSON.parse(x.slice(a, e + 1)); } catch (_) { return null; }
}

const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: memberRow } = await supabase.from("organization_members").select("org_id, role").eq("user_id", userData.user.id).limit(1).maybeSingle();
    const { data: orgRow } = memberRow ? await supabase.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle() : { data: null };
    if (orgRow?.plan !== "enterprise") return json({ error: "Katalog Produk & Layanan itu fitur khusus paket Enterprise." }, 403);
    if (!["owner", "manager"].includes(memberRow?.role)) return json({ error: "Cuma owner/manager yang bisa ngisi katalog." }, 403);

    const body = await req.json();
    const pdfBase64 = typeof body.pdf_base64 === "string" ? body.pdf_base64 : "";
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_CHARS) : "";
    if (!pdfBase64 && !text.trim()) return json({ error: "File kosong atau gak kebaca." }, 400);
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) return json({ error: "PDF kegedean (maks sekitar 4MB). Coba kompres dulu atau pakai versi yang lebih ringkas." }, 413);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: reserved, error: rlErr } = await admin.rpc("reserve_edge_function_call", {
      p_user_id: userData.user.id, p_function_name: "extract-product-catalog",
      p_window_start: wibMonthStartUTC().toISOString(), p_max_calls: MONTHLY_LIMIT,
    });
    if (rlErr) console.error("[extract-product-catalog] reserve gagal:", rlErr);
    if (!reserved) return json({ error: `Kuota baca dokumen (${MONTHLY_LIMIT}x/bulan) udah kepake. Isi manual dulu atau coba lagi bulan depan.` }, 429);

    const instructions = `Dokumen ini company profile / brosur / katalog dari perusahaan PENJUAL. Ekstrak:
1. Profil singkat perusahaan (1-2 kalimat: bidang usaha, target klien, wilayah kalau disebut).
2. Daftar produk/layanan yang mereka JUAL (maks 20, gabungin varian kecil jadi 1 item). Tiap item:
   - name: nama produk/layanan persis kayak di dokumen
   - description: deskripsi singkat maks 2 kalimat
   - fit_for: cocok untuk klien seperti apa / masalah apa yang diselesaikan (kalau tersirat jelas dari dokumen, kalau gak ada kosongin)
   - price: kisaran harga kalau DISEBUT di dokumen, kalau gak ada kosongin

JANGAN mengarang info yang gak ada di dokumen. Tulis dalam Bahasa Indonesia.
Balas HANYA JSON tanpa markdown: {"company_profile":"...","products":[{"name":"...","description":"...","fit_for":"...","price":"..."}]}`;

    const content = pdfBase64
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } }, { type: "text", text: instructions }]
      : [{ type: "text", text: `<dokumen>\n${text}\n</dokumen>\n\n${instructions}` }];

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 3000, messages: [{ role: "user", content }] }),
    });
    if (!resp.ok) {
      console.error("[extract-product-catalog] API", resp.status, (await resp.text()).slice(0, 300));
      return json({ error: "AI gagal baca dokumennya. Coba file lain atau isi manual." }, 500);
    }
    const dat = await resp.json();
    console.log("[extract-product-catalog] USAGE", JSON.stringify(dat.usage));
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const obj = parseObj(t);
    if (!obj) return json({ error: "AI gagal nyusun hasilnya. Coba lagi atau isi manual." }, 500);

    const products = (Array.isArray(obj.products) ? obj.products : [])
      .map((p) => ({ name: clip(p?.name, 80), description: clip(p?.description, 300), fit_for: clip(p?.fit_for, 200), price: clip(p?.price, 60) }))
      .filter((p) => p.name)
      .slice(0, 20);
    return json({ company_profile: clip(obj.company_profile, 1000), products });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
