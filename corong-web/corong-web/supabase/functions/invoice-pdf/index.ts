// Supabase Edge Function: invoice-pdf (7 Okt 2026)
// Unduhan PDF invoice langganan Nexto lewat tautan langsung:
//   GET /functions/v1/invoice-pdf?t=<public_token>
// Tanpa login; akses hanya dengan public_token (UUID acak per invoice, sama
// dengan halaman nexto.site/invoice). Dibuat untuk menggantikan "Unduh PDF"
// berbasis dialog cetak browser yang sering tidak berfungsi di HP dan
// browser dalam aplikasi (Gmail, WhatsApp). Responsnya berkas PDF dengan
// Content-Disposition: attachment, jadi langsung terunduh.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildInvoicePdf, pdfFileName } from "./invoice_pdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};
const err = (msg, status) => new Response(msg, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    let token = new URL(req.url).searchParams.get("t") || "";
    if (!token && req.method === "POST") token = String((await req.json().catch(() => ({}))).token || "");
    if (!UUID_RE.test(token)) return err("Link invoice tidak valid.", 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: inv, error } = await admin.from("admin_invoices")
      .select("number, company, invoice_date, due_date, total, status, paid_at, data")
      .eq("public_token", token).maybeSingle();
    if (error) throw error;
    if (!inv) return err("Invoice tidak ditemukan. Periksa kembali link dari email Anda.", 404);
    // Catatan internal aktivasi tidak ikut tercetak.
    const { activation: _a, ...doc } = inv.data || {};
    const bytes = await buildInvoicePdf({ ...inv, data: doc });
    return new Response(bytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName(inv.number)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[invoice-pdf]", String(e));
    return err("Invoice tidak dapat dibuat. Silakan coba lagi.", 500);
  }
});
