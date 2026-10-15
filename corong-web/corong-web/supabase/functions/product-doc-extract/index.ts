// Supabase Edge Function: product-doc-extract (16 Okt 2026)
// Owner mengupload dokumen katalog produk (PDF atau Word .docx) dari kartu "Produk & Layanan Perusahaan".
// Function ini:
//   POST   -> mengekstrak teks dokumen, menyimpan file ke bucket privat "product-docs", dan menyimpan teksnya di
//             org_product_catalog.doc_text. Teks itu dibaca AI (draft-followup, summarize-lead-needs, generate-leads,
//             daily-digest) saat dibutuhkan.
//   DELETE -> menghapus dokumen dan teksnya.
// Profil perusahaan dan daftar produk tidak diubah di sini.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 20000;
const BUCKET = "product-docs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Pengguna dari JWT (bukan dari body), lalu cek role owner di organisasinya.
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return json({ error: "Sesi tidak valid. Silakan login ulang." }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: mem } = await admin.from("organization_members").select("org_id, role").eq("user_id", who.user.id).limit(1).maybeSingle();
    if (!mem || mem.role !== "owner") return json({ error: "Hanya owner yang dapat mengubah dokumen katalog produk." }, 403);
    const orgId = mem.org_id;

    const { data: cur } = await admin.from("org_product_catalog").select("org_id, doc_path").eq("org_id", orgId).maybeSingle();

    // Simpan kolom dokumen saja. Kalau baris katalog belum ada, dibuat dengan profil dan produk kosong.
    const saveDoc = async (fields) => {
      const row = { ...fields, updated_by: who.user.id, updated_at: new Date().toISOString() };
      if (cur) {
        const { error } = await admin.from("org_product_catalog").update(row).eq("org_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await admin.from("org_product_catalog").insert({ org_id: orgId, company_profile: "", products: [], ...row });
        if (error) throw error;
      }
    };

    if (req.method === "DELETE") {
      if (cur?.doc_path) await admin.storage.from(BUCKET).remove([cur.doc_path]);
      await saveDoc({ doc_name: "", doc_path: "", doc_text: "" });
      return json({ ok: true });
    }
    if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "File belum dipilih." }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Ukuran file maksimal 5 MB." }, 400);

    const name = file.name || "dokumen";
    const lower = name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = lower.endsWith(".pdf") && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    const isDocx = lower.endsWith(".docx") && bytes[0] === 0x50 && bytes[1] === 0x4b; // ZIP (PK)
    if (!isPdf && !isDocx) return json({ error: "Format harus PDF atau Word (.docx)." }, 400);

    let text = "";
    try {
      if (isPdf) {
        const pdf = await getDocumentProxy(bytes);
        const result = await extractText(pdf, { mergePages: true });
        text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text || "");
      } else {
        const zip = await JSZip.loadAsync(bytes);
        const xml = await zip.file("word/document.xml")?.async("string");
        if (!xml) throw new Error("word/document.xml tidak ada");
        text = xml
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab\/>/g, "\t")
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      }
    } catch (_) {
      return json({ error: "Gagal membaca isi dokumen. Pastikan file tidak rusak." }, 422);
    }
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return json({ error: "Dokumen tidak punya teks yang bisa dibaca (kemungkinan hasil scan gambar)." }, 422);

    const safe = name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${orgId}/${Date.now()}-${safe}`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
    if (up.error) return json({ error: "Gagal menyimpan file: " + up.error.message }, 500);

    try {
      await saveDoc({ doc_name: name, doc_path: path, doc_text: text.slice(0, MAX_TEXT) });
    } catch (e) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: "Gagal menyimpan katalog: " + (e?.message || e) }, 500);
    }
    // File lama dihapus setelah yang baru tersimpan.
    if (cur?.doc_path) await admin.storage.from(BUCKET).remove([cur.doc_path]);
    return json({ ok: true, doc_name: name, chars: Math.min(text.length, MAX_TEXT) });
  } catch (e) {
    return json({ error: "Terjadi kesalahan: " + (e?.message || e) }, 500);
  }
});
