// Supabase Edge Function: invoice-reminders (2 Okt 2026)
// Dipanggil pg_cron setiap hari 08.00 WIB (header x-cron-secret). Mengirim
// pengingat ke klien untuk invoice yang BELUM DIBAYAR:
//   due_minus3 : 3 hari sebelum jatuh tempo
//   due_today  : pada hari jatuh tempo
//   overdue_3  : 3 hari setelah lewat jatuh tempo
//   overdue_7  : 7 hari setelah lewat jatuh tempo
// Tiap jenis hanya terkirim sekali per invoice (dicatat di email_log). Invoice
// Lunas/Dibatalkan, tanpa email klien, atau pengingatnya dimatikan admin
// (reminders_enabled = false) dilewati. Penagih mendapat salinan (bcc).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { renderInvoiceEmail, invoiceSubject, sendEmail, invoicePdfAttachment } from "./invoice_email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const wibDate = (offsetDays = 0) => new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const result = { sent: [], skipped: 0, errors: [] };
  try {
    // Jenis pengingat per tanggal jatuh tempo, dihitung dari "hari ini" WIB.
    const kindByDue = { [wibDate(3)]: "due_minus3", [wibDate(0)]: "due_today", [wibDate(-3)]: "overdue_3", [wibDate(-7)]: "overdue_7" };
    const { data: rows, error } = await admin.from("admin_invoices")
      .select("id, number, company, invoice_date, due_date, total, status, data, public_token, email_log, reminders_enabled")
      .eq("status", "unpaid").eq("reminders_enabled", true)
      .in("due_date", Object.keys(kindByDue));
    if (error) throw error;

    for (const inv of rows || []) {
      const kind = kindByDue[inv.due_date];
      const log = inv.email_log || [];
      // Tujuan: email terakhir yang dipakai saat "Kirim invoice", atau email klien di invoice.
      const lastSent = [...log].reverse().find((e) => e.type === "invoice");
      const to = String(lastSent?.to || inv.data?.email || "").trim().toLowerCase();
      if (!kind || !EMAIL_RE.test(to) || log.some((e) => e.type === kind)) { result.skipped++; continue; }
      const seller = inv.data?.seller || {};
      try {
        let attachments;
        try {
          attachments = [await invoicePdfAttachment(inv)];
        } catch (e) {
          console.error("[invoice-reminders] lampiran PDF gagal:", String(e));
        }
        await sendEmail({
          apiKey: RESEND_API_KEY, to, attachments,
          subject: invoiceSubject(kind, inv, seller),
          html: renderInvoiceEmail(kind, inv, seller, "", !!attachments),
          replyTo: seller.email || ADMIN_EMAIL, bcc: seller.email || ADMIN_EMAIL,
        });
        const email_log = [...log, { type: kind, to, at: new Date().toISOString() }];
        await admin.from("admin_invoices").update({ email_log }).eq("id", inv.id);
        result.sent.push(`${inv.number}:${kind}`);
      } catch (e) {
        result.errors.push({ number: inv.number, error: String(e?.message || e) });
      }
    }
    console.log("[invoice-reminders]", JSON.stringify(result));
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[invoice-reminders] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});
