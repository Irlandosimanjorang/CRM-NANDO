// Supabase Edge Function: warranty-card (3 Nov 2026)
// Kartu garansi QR per proyek. Dua jenis token:
//   t  = token publik (dicetak pada QR)  -> hanya baca info dan riwayat
//   s  = token servis (link teknisi)     -> baca, unggah foto, tambah riwayat
// Action (publik): get
// Action (teknisi, pakai s): tech_get, tech_upload, tech_add
// Riwayat hanya ditambah, tidak pernah diubah atau dihapus lewat fungsi ini.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PHOTO_BUCKET = "warranty-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_ENTRY = 5;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TOKEN_RE = /^[A-Za-z0-9_-]{32,96}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Info yang boleh tampil publik: tanpa nama customer, NIK, alamat, atau KTP.
async function buildView(admin: ReturnType<typeof createClient>, card: any) {
  const { data: org } = await admin.from("organizations").select("name").eq("id", card.org_id).maybeSingle();
  const { data: logs, error } = await admin.from("warranty_service_logs")
    .select("id, service_date, problem, action, technician_name, photo_paths")
    .eq("card_id", card.id)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const withUrls = await Promise.all((logs || []).map(async (l) => {
    const urls = await Promise.all((l.photo_paths || []).map(async (p: string) => {
      const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(p, 3600);
      return data?.signedUrl || null;
    }));
    return { id: l.id, service_date: l.service_date, problem: l.problem, action: l.action, technician_name: l.technician_name, photos: urls.filter(Boolean) };
  }));
  const expiresAt = addMonths(card.installed_at, card.warranty_months);
  const today = new Date().toISOString().slice(0, 10);
  return {
    org_name: org?.name || "",
    product: card.product || "",
    installed_at: card.installed_at,
    warranty_months: card.warranty_months,
    warranty_until: expiresAt,
    warranty_active: today <= expiresAt,
    contact_wa: card.contact_wa,
    logs: withUrls,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const isMultipart = (req.headers.get("content-type") || "").startsWith("multipart/form-data");
    const body: Record<string, any> = isMultipart ? {} : await req.json().catch(() => ({}));
    const form = isMultipart ? await req.formData() : null;
    const field = (k: string) => (form ? form.get(k) : body[k]);
    const action = String(field("action") || "");

    // Token publik untuk "get", token servis untuk aksi teknisi.
    const publicToken = action === "get" ? String(field("t") || "") : "";
    const serviceToken = action.startsWith("tech_") ? String(field("s") || "") : "";
    if (action === "get" && !TOKEN_RE.test(publicToken)) return json({ error: "Kartu garansi tidak ditemukan." }, 404);
    if (action.startsWith("tech_") && !TOKEN_RE.test(serviceToken)) return json({ error: "Link teknisi tidak valid." }, 400);

    let card: any = null;
    if (action === "get") {
      const { data, error } = await admin.from("warranty_cards").select("*").eq("public_token", publicToken).maybeSingle();
      if (error) throw error;
      card = data;
    } else if (action.startsWith("tech_")) {
      const { data, error } = await admin.from("warranty_cards").select("*").eq("service_token_hash", await sha256Hex(serviceToken)).maybeSingle();
      if (error) throw error;
      card = data;
    } else {
      return json({ error: "Aksi tidak dikenal." }, 400);
    }
    if (!card) return json({ error: "Kartu garansi tidak ditemukan. Hubungi tim Anda." }, 404);

    if (action === "get" || action === "tech_get") {
      return json(await buildView(admin, card));
    }

    if (action === "tech_upload") {
      const file = form?.get("file");
      if (!(file instanceof File)) return json({ error: "Pilih foto terlebih dahulu." }, 400);
      if (file.size > MAX_PHOTO_BYTES) return json({ error: "Ukuran foto maksimal 5 MB." }, 400);
      const ext = PHOTO_TYPES[file.type];
      if (!ext) return json({ error: "Format foto harus JPG, PNG, atau WEBP." }, 400);
      const path = `${card.org_id}/${card.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage.from(PHOTO_BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      return json({ ok: true, path });
    }

    if (action === "tech_add") {
      const serviceDate = String(body.service_date || "");
      const problem = String(body.problem || "").trim().slice(0, 1000);
      const act = String(body.action_taken || "").trim().slice(0, 1000);
      const technician = String(body.technician_name || "").trim().slice(0, 120);
      const photos: string[] = Array.isArray(body.photo_paths) ? body.photo_paths.map(String) : [];
      if (!DATE_RE.test(serviceDate)) return json({ error: "Tanggal servis wajib diisi." }, 400);
      if (!problem) return json({ error: "Tulis kerusakan yang ditemukan." }, 400);
      if (!act) return json({ error: "Tulis tindakan perbaikan yang dilakukan." }, 400);
      if (!technician) return json({ error: "Tulis nama teknisi." }, 400);
      if (photos.length > MAX_PHOTOS_PER_ENTRY) return json({ error: `Maksimal ${MAX_PHOTOS_PER_ENTRY} foto per entri.` }, 400);
      // Foto hanya boleh dari folder kartu ini (hasil tech_upload), supaya tidak bisa menyambung file orang lain.
      const prefix = `${card.org_id}/${card.id}/`;
      if (photos.some((p) => !p.startsWith(prefix) || p.includes(".."))) return json({ error: "Foto tidak valid. Unggah ulang." }, 400);

      const { error: insErr } = await admin.from("warranty_service_logs").insert({
        card_id: card.id, org_id: card.org_id, service_date: serviceDate, problem, action: act,
        technician_name: technician, photo_paths: photos,
      });
      if (insErr) throw insErr;
      return json({ ok: true });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[warranty-card]", String(e));
    return json({ error: "Terjadi kendala. Silakan coba lagi." }, 500);
  }
});
