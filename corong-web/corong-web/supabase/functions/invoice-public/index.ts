// Supabase Edge Function: invoice-public (2 Okt 2026)
// Halaman invoice untuk klien (nexto.site/invoice?t=<token>) - tanpa login.
// Akses hanya dengan public_token (UUID acak per invoice, dikirim lewat
// email "Kirim invoice"). Yang dikembalikan hanya isi dokumen invoice, tanpa
// catatan internal (aktivasi paket, riwayat email, dsb).
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
    if (!UUID_RE.test(token)) return json({ error: "Link invoice tidak valid." }, 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: inv, error } = await admin.from("admin_invoices")
      .select("number, company, status, paid_at, data")
      .eq("public_token", token).maybeSingle();
    if (error) throw error;
    if (!inv) return json({ error: "Invoice tidak ditemukan. Periksa kembali link dari email Anda." }, 404);
    const { activation: _a, activatePlan: _p, ...doc } = inv.data || {};
    return json({ invoice: { number: inv.number, company: inv.company, status: inv.status, paid_at: inv.paid_at, data: doc } });
  } catch (e) {
    console.error("[invoice-public]", String(e));
    return json({ error: "Invoice tidak dapat dimuat. Silakan coba lagi." }, 500);
  }
});
