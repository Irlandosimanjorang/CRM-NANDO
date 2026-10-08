// Supabase Edge Function: weekly-team-report
// Laporan mingguan tab Team (30 Sep 2026, permintaan Nando) - dikirim tiap
// Senin 08:00 WIB (cron nexto-weekly-team-report) ke owner & manager tiap org
// Enterprise. Isinya: aktivitas tiap sales minggu lalu (Senin-Minggu WIB),
// deal & uang masuk, target bulan ini, termin telat & jatuh tempo 7 hari ke
// depan, dan sales yang gak aktif. Gak manggil AI - biaya cuma email.
//
// ?dry=true  -> gak ngirim email, balikin HTML & data (buat ngecek).
// ?org_id=.. -> cuma 1 org (buat tes).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const INACTIVE_DAYS = 3;

// Senin minggu lalu 00:00 WIB s/d Senin minggu ini 00:00 WIB.
function lastWeekRange(now = new Date()) {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const dow = (wib.getUTCDay() + 6) % 7; // 0 = Senin
  const thisMonday = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - dow) - WIB_OFFSET_MS;
  return { from: new Date(thisMonday - 7 * 86400000), to: new Date(thisMonday) };
}

const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const day = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderHtml(orgName, range, r) {
  const period = `${range.from.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} - ${new Date(range.to.getTime() - 1).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}`;
  const members = r.members || [];
  const totalDeal = members.reduce((s, m) => s + Number(m.deal_value || 0), 0);
  const inactive = members.filter((m) => m.role === "sales_rep" && (!m.last_activity_at || (Date.now() - new Date(m.last_activity_at).getTime()) / 86400000 >= INACTIVE_DAYS));
  const targetBy = Object.fromEntries((r.targets || []).map((t) => [t.user_id, t]));
  const th = 'style="text-align:right;padding:6px 8px;font-size:11px;color:#94a3b8;font-weight:600;"';
  const td = 'style="text-align:right;padding:8px;font-size:13px;color:#0f172a;border-top:1px solid #f1f5f9;"';

  const rows = members.map((m) => {
    const t = targetBy[m.user_id];
    const tgt = t && Number(t.target) > 0 ? `${Math.round((Number(t.achieved) / Number(t.target)) * 100)}%` : "-";
    return `<tr>
      <td style="padding:8px;font-size:13px;color:#0f172a;border-top:1px solid #f1f5f9;"><b>${esc(m.name)}</b><br><span style="font-size:11px;color:#94a3b8;">${m.role === "sales_rep" ? "Sales" : m.role === "manager" ? "Manager" : "Owner"}</span></td>
      <td ${td}>${m.visits}</td><td ${td}>${m.notes}</td><td ${td}>${m.new_leads}</td><td ${td}>${m.stage_moves}</td>
      <td ${td}>${Number(m.deal_value) > 0 ? rp(m.deal_value) : "-"}</td><td ${td}>${tgt}</td></tr>`;
  }).join("");

  const termList = (items, color) => items.map((t) => `<li style="margin:0 0 4px;font-size:13px;color:#334155;"><b>${esc(t.lead_name)}</b> - ${esc(t.label || "Termin")} ${rp(t.amount)} <span style="color:${color};">(${day(t.due_date)})</span></li>`).join("");

  const tile = (label, value, color) => `<td style="padding:10px 12px;background:#f8fafc;border-radius:10px;"><div style="font-size:17px;font-weight:800;color:${color};">${value}</div><div style="font-size:11px;color:#64748b;">${label}</div></td>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="font-weight:800;font-size:16px;color:#0f172a;">Laporan Mingguan Team - ${esc(orgName)}</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">${period}</div>
    <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 16px;"><tr>
      ${tile("Deal masuk", rp(totalDeal), "#0f172a")}
      ${tile("Uang masuk (Cash In)", rp(r.cash_in), "#047857")}
      ${tile("Termin telat", String((r.overdue || []).length), (r.overdue || []).length ? "#e11d48" : "#94a3b8")}
    </tr></table>
    ${inactive.length ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:13px;color:#92400e;margin-bottom:16px;"><b>Perlu dicek:</b> ${inactive.map((m) => esc(m.name)).join(", ")} - tidak ada aktivitas ${INACTIVE_DAYS}+ hari.</div>` : ""}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px;">Aktivitas tiap anggota</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th style="text-align:left;padding:6px 8px;font-size:11px;color:#94a3b8;font-weight:600;">Anggota</th><th ${th}>Kunjungan</th><th ${th}>Notulen</th><th ${th}>Lead baru</th><th ${th}>Pindah tahap</th><th ${th}>Deal</th><th ${th}>Target bln ini</th></tr>
        ${rows}
      </table>
    </div>
    ${(r.overdue || []).length ? `<div style="background:#fff;border:1px solid #fecdd3;border-radius:14px;padding:14px;margin-bottom:16px;"><div style="font-weight:700;font-size:14px;color:#be123c;margin-bottom:6px;">Termin telat dibayar</div><ul style="margin:0;padding-left:18px;">${termList(r.overdue, "#e11d48")}</ul></div>` : ""}
    ${(r.due_soon || []).length ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:16px;"><div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px;">Jatuh tempo 7 hari ke depan</div><ul style="margin:0;padding-left:18px;">${termList(r.due_soon, "#d97706")}</ul></div>` : ""}
    <a href="https://nexto.site" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:10px;">Buka tab Team di Nexto</a>
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;">Laporan otomatis tiap Senin pagi buat owner & manager paket Enterprise.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "true";
  const onlyOrg = url.searchParams.get("org_id");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const range = lastWeekRange();

  try {
    let q = admin.from("organizations").select("id, name, features").eq("plan", "enterprise");
    if (onlyOrg) q = q.eq("id", onlyOrg);
    const { data: orgs, error } = await q;
    if (error) throw error;

    const results = [];
    // Saklar features.weekly_report_off = true: organisasi tidak menerima laporan mingguan (mis. saat masih berisi data dummy).
    for (const org of (orgs || []).filter((o) => o.features?.weekly_report_off !== true)) {
      const { data: report, error: rErr } = await admin.rpc("team_weekly_report", { p_org: org.id, p_from: range.from.toISOString(), p_to: range.to.toISOString() });
      if (rErr) { results.push({ org: org.id, error: rErr.message }); continue; }

      const { data: mgrs } = await admin.from("organization_members").select("user_id").eq("org_id", org.id).in("role", ["owner", "manager"]);
      const emails = [];
      for (const m of mgrs || []) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        if (u?.user?.email) emails.push(u.user.email);
      }
      const html = renderHtml(org.name || "Organisasi", range, report);
      if (dry) { results.push({ org: org.id, recipients: emails.length, report, html }); continue; }
      if (emails.length === 0) { results.push({ org: org.id, skipped: "no recipients" }); continue; }

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Nexto <noreply@nexto.site>", to: emails, subject: "Nexto · Laporan mingguan team", html }),
      });
      results.push({ org: org.id, recipients: emails.length, status: resp.status });
    }
    console.log("[weekly-team-report] done", JSON.stringify(results.map(({ html, report, ...r }) => r)));
    return new Response(JSON.stringify({ ok: true, range: { from: range.from, to: range.to }, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[weekly-team-report] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
