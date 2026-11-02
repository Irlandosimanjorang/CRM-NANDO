// Supabase Edge Function: customer-form (2 Nov 2026)
// Form data customer dari QR proyek deal. Diakses tanpa login lewat nexto.site/isi?t=<token>.
// Token acak dibuat saat marketing menekan "Buat QR" dan hanya hash SHA-256-nya yang disimpan.
// Action:
//   get     -> info form dan daftar isian (tanpa data pribadi lain)
//   upload  -> simpan foto KTP (multipart: token, file) ke bucket privat customer-documents
//   submit  -> simpan jawaban, tandai form terisi (wajib ada KTP dan persetujuan)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = "customer-documents";
const CONSENT_VERSION = "2026-11";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const TOKEN_RE = /^[A-Za-z0-9_-]{32,96}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Isian ini harus sama dengan FORM_FIELDS di src/lib/customerForm.js.
const TEXT_LIMITS: Record<string, number> = {
  nama_lengkap: 120,
  nik: 16,
  alamat: 300,
  no_hp: 20,
  email: 120,
  nama_perusahaan: 120,
  catatan: 500,
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const isMultipart = (req.headers.get("content-type") || "").startsWith("multipart/form-data");
    const body: Record<string, unknown> = isMultipart ? {} : await req.json().catch(() => ({}));
    const form = isMultipart ? await req.formData() : null;
    const action = String(form ? form.get("action") : body.action || "");
    const token = String(form ? form.get("token") : body.token || "");
    if (!TOKEN_RE.test(token)) return json({ error: "Link tidak valid. Minta QR baru ke tim Anda." }, 400);

    const { data: row, error: rowErr } = await admin
      .from("customer_forms")
      .select("id, org_id, status, expires_at")
      .eq("token_hash", await sha256Hex(token))
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return json({ error: "Link tidak ditemukan. Minta QR baru ke tim Anda." }, 404);
    if (row.status === "dibatalkan") return json({ error: "Link ini sudah dibatalkan. Minta QR baru ke tim Anda." }, 410);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Link ini sudah kedaluwarsa. Minta QR baru ke tim Anda." }, 410);

    if (action === "get") {
      const { data: org } = await admin.from("organizations").select("name").eq("id", row.org_id).maybeSingle();
      return json({
        org_name: org?.name || "",
        status: row.status,
        fields: Object.keys(TEXT_LIMITS),
        consent_version: CONSENT_VERSION,
      });
    }

    if (row.status === "terisi") return json({ error: "Data untuk link ini sudah terkirim. Terima kasih." }, 409);

    if (action === "upload") {
      const file = form?.get("file");
      if (!(file instanceof File)) return json({ error: "Pilih foto KTP terlebih dahulu." }, 400);
      if (file.size > MAX_FILE_BYTES) return json({ error: "Ukuran file maksimal 5 MB." }, 400);
      const ext = FILE_TYPES[file.type];
      if (!ext) return json({ error: "Format file harus JPG, PNG, WEBP, atau PDF." }, 400);

      // Satu KTP per form: unggahan baru menggantikan yang lama.
      const { data: old } = await admin.from("customer_form_files").select("id, storage_path").eq("form_id", row.id).eq("kind", "ktp");
      const path = `${row.org_id}/${row.id}/ktp-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      if (old?.length) {
        await admin.storage.from(BUCKET).remove(old.map((o) => o.storage_path));
        await admin.from("customer_form_files").delete().in("id", old.map((o) => o.id));
      }
      const { error: insErr } = await admin.from("customer_form_files").insert({
        form_id: row.id, org_id: row.org_id, kind: "ktp", storage_path: path, mime: file.type, size_bytes: file.size,
      });
      if (insErr) throw insErr;
      return json({ ok: true, name: file.name });
    }

    if (action === "submit") {
      const fields: Record<string, string> = {};
      for (const [key, max] of Object.entries(TEXT_LIMITS)) fields[key] = cleanText(body[key], max);
      if (!fields.nama_lengkap) return json({ error: "Nama lengkap wajib diisi." }, 400);
      if (!/^\d{16}$/.test(fields.nik)) return json({ error: "NIK harus 16 digit angka." }, 400);
      if (fields.no_hp && !/^\+?[0-9 ()-]{8,20}$/.test(fields.no_hp)) return json({ error: "Nomor HP tidak valid." }, 400);
      if (fields.email && !EMAIL_RE.test(fields.email)) return json({ error: "Format email tidak valid." }, 400);
      if (body.consent !== true) return json({ error: "Centang persetujuan pemrosesan data untuk melanjutkan." }, 400);

      const { data: ktp } = await admin.from("customer_form_files").select("id").eq("form_id", row.id).eq("kind", "ktp").limit(1);
      if (!ktp?.length) return json({ error: "Unggah foto KTP terlebih dahulu." }, 400);

      const now = new Date().toISOString();
      const { error: ansErr } = await admin.from("customer_form_answers").insert({
        form_id: row.id, org_id: row.org_id, ...fields,
        consent_at: now, consent_version: CONSENT_VERSION,
      });
      if (ansErr) throw ansErr;
      // Penanda terisi hanya berlaku sekali; cek status lagi agar dua submit bersamaan tidak lolos.
      const { error: stErr } = await admin.from("customer_forms")
        .update({ status: "terisi", submitted_at: now })
        .eq("id", row.id).eq("status", "menunggu");
      if (stErr) throw stErr;
      return json({ ok: true });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[customer-form]", String(e));
    return json({ error: "Terjadi kendala. Silakan coba lagi." }, 500);
  }
});
