// Supabase Edge Function: document-reminders (7 Okt 2026)
// Dipanggil pg_cron setiap hari 08.00 WIB (header x-cron-secret). Mengirim
// pengingat ke customer untuk invoice client yang BELUM LUNAS:
//   due_minus3 (3 hari sebelum jatuh tempo), due_today, overdue_3, overdue_7.
// Tiap jenis hanya sekali per invoice (dicatat di email_log). Dilewati bila:
// pengingat dimatikan, tidak ada email tujuan, atau paket organisasi tidak
// lagi Professional/Enterprise. Penerbit mendapat salinan (bcc).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { renderDocumentEmail, documentSubject, sendEmail } from "./document_email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const wibDate = (offsetDays = 0) => new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const result = { sent: [] as string[], skipped: 0, errors: [] as unknown[] };
  try {
    const kindByDue: Record<string, string> = { [wibDate(3)]: "due_minus3", [wibDate(0)]: "due_today", [wibDate(-3)]: "overdue_3", [wibDate(-7)]: "overdue_7" };
    const { data: rows, error } = await admin.from("documents").select("*")
      .eq("kind", "invoice").in("status", ["unpaid", "partial"]).eq("reminders_enabled", true)
      .in("due_date", Object.keys(kindByDue));
    if (error) throw error;

    const planCache = new Map<string, boolean>();
    const planOk = async (orgId: string, userId: string) => {
      const key = `${orgId}:${userId}`;
      if (planCache.has(key)) return planCache.get(key) as boolean;
      const [{ data: org }, { data: st }] = await Promise.all([
        admin.from("organizations").select("plan").eq("id", orgId).maybeSingle(),
        admin.from("settings").select("plan").eq("user_id", userId).maybeSingle(),
      ]);
      const ok = org?.plan === "enterprise" || st?.plan === "premium";
      planCache.set(key, ok);
      return ok;
    };

    for (const doc of rows || []) {
      const kind = kindByDue[doc.due_date];
      const log = Array.isArray(doc.email_log) ? doc.email_log : [];
      const lastSent = [...log].reverse().find((e) => e.type === "invoice");
      const to = String(lastSent?.to || doc.customer?.email || "").trim().toLowerCase();
      if (!kind || !EMAIL_RE.test(to) || log.some((e) => e.type === kind)) { result.skipped++; continue; }
      if (!(await planOk(doc.org_id, doc.user_id))) { result.skipped++; continue; }
      const seller = doc.snapshot?.seller || {};
      try {
        await sendEmail({
          apiKey: RESEND_API_KEY, to,
          subject: documentSubject(kind, doc, seller),
          html: renderDocumentEmail(kind, doc, seller, doc.snapshot?.accent),
          replyTo: seller.email, bcc: seller.email, fromName: seller.name,
        });
        await admin.from("documents").update({ email_log: [...log, { type: kind, to, at: new Date().toISOString() }] }).eq("id", doc.id);
        result.sent.push(`${doc.number}:${kind}`);
      } catch (e) {
        result.errors.push({ number: doc.number, error: String((e as Error)?.message || e) });
      }
    }
    console.log("[document-reminders]", JSON.stringify(result));
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[document-reminders] FATAL", String(e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500 });
  }
});
