// Supabase Edge Function: daily-alerts (9 Okt 2026)
// Email alert harian untuk owner dan manager organisasi Enterprise yang menyalakan saklar features.daily_alerts:
// chat belum dibalas, lead high-value belum di-follow-up, lead stuck per marketing, target tercapai.
// Aturan murni (tanpa AI), batas di logic.ts (CONFIG). Tidak dikirim bila tidak ada alert.
//
// Dipanggil cron dengan header x-cron-secret. ?dry=true -> tidak mengirim, mengembalikan alert dan HTML.
// ?org_id=.. -> hanya satu organisasi (untuk tes). Penerima = email owner dan manager organisasi itu.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildAlerts, renderHtml } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const WIB = 7 * 3600 * 1000;

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "true";
  const onlyOrg = url.searchParams.get("org_id");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = Date.now();
  const wib = new Date(now + WIB);
  const monthStart = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const dateLabel = wib.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  try {
    let q = admin.from("organizations").select("id, name, features").eq("plan", "enterprise");
    if (onlyOrg) q = q.eq("id", onlyOrg);
    const { data: orgs, error } = await q;
    if (error) throw error;

    const results: unknown[] = [];
    for (const org of (orgs || []).filter((o) => o.features?.daily_alerts === true)) {
      const [{ data: leads }, { data: stages }, { data: notes }, { data: convs }, { data: members }, { data: targets }, { data: tx }] = await Promise.all([
        admin.from("leads").select("id, name, stage_key, deal_value, last_contact, created_at, assigned_to, user_id").eq("org_id", org.id).is("deleted_at", null).limit(5000),
        admin.from("stages").select("key, type").eq("org_id", org.id),
        admin.from("progress_notes").select("lead_id, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(20000),
        admin.from("lead_conversations").select("lead_id, platform, campaign, last_inbound_at, last_outbound_at").eq("org_id", org.id).not("lead_id", "is", null).limit(2000),
        admin.from("organization_members").select("user_id, role").eq("org_id", org.id),
        admin.from("sales_targets").select("user_id, amount").eq("org_id", org.id).eq("month", monthStart),
        admin.from("deal_transactions").select("user_id, deal_value").eq("org_id", org.id).gte("deal_date", monthStart),
      ]);

      const ids = (members || []).map((m) => m.user_id);
      const { data: sets } = await admin.from("settings").select("user_id, community_display_name").in("user_id", ids);
      const names = new Map<string, string>((sets || []).map((s) => [s.user_id, s.community_display_name || "Anggota"]));
      const lastNote = new Map<string, string>();
      for (const n of notes || []) if (!lastNote.has(n.lead_id)) lastNote.set(n.lead_id, n.created_at);
      const achieved = new Map<string, number>();
      for (const t of tx || []) achieved.set(t.user_id, (achieved.get(t.user_id) || 0) + (Number(t.deal_value) || 0));

      const alerts = buildAlerts({
        now,
        leads: leads || [],
        activeKeys: new Set((stages || []).filter((s) => s.type === "normal").map((s) => s.key)),
        lastNote,
        convs: convs || [],
        names,
        targets: (targets || []).map((t) => ({ user_id: t.user_id, amount: Number(t.amount) || 0 })),
        achieved,
      });
      if (alerts.length === 0) { results.push({ org: org.id, skipped: "tidak ada alert" }); continue; }

      const emails: string[] = [];
      for (const m of (members || []).filter((x) => x.role === "owner" || x.role === "manager")) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        if (u?.user?.email) emails.push(u.user.email);
      }
      const html = renderHtml(org.name || "Organisasi", dateLabel, alerts);
      if (dry) { results.push({ org: org.id, recipients: emails, alerts, html }); continue; }
      if (emails.length === 0) { results.push({ org: org.id, skipped: "tidak ada penerima" }); continue; }
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Nexto <noreply@nexto.site>", to: emails, subject: `Nexto · Perlu perhatian hari ini (${alerts.length})`, html }),
      });
      results.push({ org: org.id, recipients: emails.length, alerts: alerts.length, status: resp.status });
    }
    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
