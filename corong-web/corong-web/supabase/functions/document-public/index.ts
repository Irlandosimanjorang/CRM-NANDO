// Supabase Edge Function: document-public (7 Okt 2026)
// Halaman publik Quotation/Invoice client (nexto.site/dokumen?t=<token>) -
// tanpa login. Akses hanya dengan public_token (UUID acak per dokumen) dan
// hanya untuk dokumen yang sudah terbit. Yang dikembalikan hanya isi dokumen:
// tanpa log email, pembuat, atau data internal lain.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    if (!UUID_RE.test(token)) return json({ error: "Link dokumen tidak valid." }, 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: d, error } = await admin.from("documents")
      .select("kind, number, status, issue_date, due_date, customer, items, discount_type, discount_value, tax_on, tax_rate, tax_label, notes, terms, amount_paid, snapshot")
      .eq("public_token", token).not("issued_at", "is", null).maybeSingle();
    if (error) throw error;
    if (!d) return json({ error: "Dokumen tidak ditemukan. Periksa kembali link dari email Anda." }, 404);
    return json({ document: d });
  } catch (e) {
    console.error("[document-public]", String(e));
    return json({ error: "Dokumen tidak dapat dimuat. Silakan coba lagi." }, 500);
  }
});
