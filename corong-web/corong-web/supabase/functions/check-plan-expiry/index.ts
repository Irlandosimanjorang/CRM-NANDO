// Supabase Edge Function: check-plan-expiry
// Dipanggil oleh Cron Job Supabase tiap hari (bukan oleh user login).
//
// Sebelumnya Nexto GAK PUNYA cara buat tau kapan periode bayar seseorang
// berakhir - murni pasrah nunggu Mayar kirim webhook memberExpired di waktu
// yang tepat (lihat mayar-webhook.ts). Sekarang plan_expires_at dihitung &
// disimpen pas pembayaran masuk (settings.plan_expires_at buat Standard/
// Professional, organizations.plan_expires_at buat Enterprise). Function ini:
//   1. Kirim email reminder H-3 sebelum plan_expires_at (sekali per siklus).
//   2. Auto-downgrade ke Free kalau plan_expires_at + masa tenggang udah
//      lewat DAN webhook Mayar belum juga nurunin plan-nya - safety net
//      independen, jaga-jaga kalau webhook memberExpired dari Mayar telat/gak
//      pernah nyampe.
//
// === GRACE PERIOD DIUBAH JADI 0 HARI (16 Sep 2026, permintaan Nando) ===
// Sebelumnya disamain sama "Masa Tenggang" 3 hari di dashboard Mayar - biar
// auto-downgrade kita selaras sama kapan Mayar sendiri nonaktifin member.
// Nando eksplisit minta toleransi 0 hari - begitu lewat tanggal jatuh tempo
// (H+0), langsung downgrade ke Free, gak nunggu masa tenggang Mayar lagi.
// Konsekuensinya: kalau Mayar dashboard masih di-set toleransi 3 hari,
// safety-net Nexto ini bakal downgrade LEBIH DULU/lebih ketat daripada Mayar
// sendiri - user yang bayar telat 1-2 hari (tapi masih dalam toleransi
// Mayar) bisa sempet ke-lock Free duluan di Nexto sebelum pembayarannya
// diproses. Data (leads dkk) TETEP AMAN kalau ini kejadian - trigger
// check_lead_row_limit di DB cuma ngeblok NAMBAH lead baru pas over kuota,
// gak pernah ngehapus/nyembunyiin lead yang udah ada.
//
// Audit Enterprise (30 Sep 2026): teks email pengingat pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAYAR_GRACE_PERIOD_DAYS = 0;
const REMINDER_DAYS_BEFORE = 3;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth(), day = wibNow.getUTCDate();
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WIB_OFFSET_MS);
}
// Selisih hari kalender WIB antara plan_expires_at dan sekarang - dihitung
// dari batas hari (bukan selisih jam mentah), biar "3 hari lagi" konsisten
// sepanjang hari itu, gak geser gara-gara jam berapa cron kebetulan jalan.
function wibDaysUntil(expiresAtISO, now = new Date()) {
  const expiresDayStart = wibDayStartUTC(new Date(expiresAtISO));
  const todayDayStart = wibDayStartUTC(now);
  return Math.round((expiresDayStart.getTime() - todayDayStart.getTime()) / 86400000);
}

const TIER_LABEL = { standard: "Standard", premium: "Professional", enterprise: "Enterprise" };

function formatTanggalWIB(iso) {
  return new Date(iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function renderReminderEmail(tierLabel, tanggalExpire) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <div style="width:36px;height:36px;border-radius:12px;background:#f59e0b;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0f172a;">N</div>
      <div style="font-weight:800;color:#0f172a;">Nexto</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Paket ${tierLabel} Anda akan segera berakhir</h2>
      <p style="font-size:13px;color:#475569;line-height:1.6;">Paket <b>${tierLabel}</b> Anda akan berakhir pada <b>${tanggalExpire}</b>. Agar akses fitur berbayar (AI Advisor, otomatisasi, dan lainnya) tidak terputus, silakan perpanjang sebelum tanggal tersebut.</p>
      <a href="https://crmnexto.myr.id/m/nexto-crm-ai-sales-operating-system" target="_blank" style="display:inline-block;margin-top:12px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:10px;">Perpanjang Sekarang</a>
      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">Jika paket ini tidak diperpanjang, akun Anda otomatis kembali ke paket Free setelah tanggal di atas. Data Anda tetap tersimpan.</p>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;">Email otomatis dari Nexto.</p>
  </div></body></html>`;
}

async function sendReminderEmail(email, tierLabel, expiresAtISO) {
  if (!email) return false;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Nexto <noreply@nexto.site>",
        to: [email],
        subject: `Nexto · Paket ${tierLabel} Anda berakhir dalam 3 hari`,
        html: renderReminderEmail(tierLabel, formatTanggalWIB(expiresAtISO)),
      }),
    });
    console.log("[check-plan-expiry] reminder email status:", resp.status, "->", email);
    return resp.ok;
  } catch (err) {
    console.log("[check-plan-expiry] EXCEPTION kirim reminder ke", email, String(err));
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const now = new Date();
    const results = { reminded: [], downgraded: [], errors: [] };

    // ---- USER PERORANGAN (Standard/Professional) - settings.plan_expires_at ----
    const { data: settingsRows, error: settingsErr } = await admin
      .from("settings")
      .select("user_id, plan, plan_expires_at, plan_expiry_reminder_sent_at")
      .not("plan", "is", null)
      .not("plan_expires_at", "is", null);
    if (settingsErr) throw settingsErr;

    for (const row of settingsRows || []) {
      try {
        const daysLeft = wibDaysUntil(row.plan_expires_at, now);
        if (daysLeft <= -MAYAR_GRACE_PERIOD_DAYS) {
          const { error } = await admin.from("settings").update({ plan: null, plan_expires_at: null, plan_expiry_reminder_sent_at: null }).eq("user_id", row.user_id);
          if (error) throw error;
          console.log("[check-plan-expiry] SAFETY-NET downgrade (settings):", row.user_id, "expired", row.plan_expires_at, "(lewat masa tenggang)");
          results.downgraded.push(row.user_id);
        } else if (daysLeft <= REMINDER_DAYS_BEFORE && !row.plan_expiry_reminder_sent_at) {
          const { data: userRes } = await admin.auth.admin.getUserById(row.user_id);
          const email = userRes?.user?.email;
          const sent = await sendReminderEmail(email, TIER_LABEL[row.plan] || row.plan, row.plan_expires_at);
          if (sent) {
            await admin.from("settings").update({ plan_expiry_reminder_sent_at: now.toISOString() }).eq("user_id", row.user_id);
            results.reminded.push(row.user_id);
          }
        }
      } catch (rowErr) {
        console.log("[check-plan-expiry] EXCEPTION (settings row)", row.user_id, String(rowErr));
        results.errors.push({ user_id: row.user_id, error: String(rowErr) });
      }
    }

    // ---- ENTERPRISE (per organisasi) - organizations.plan_expires_at ----
    // Reminder & safety-net dikirim ke email OWNER organisasi (pemegang akun
    // yang paling relevan buat urusan perpanjangan paket tim).
    const { data: orgRows, error: orgErr } = await admin
      .from("organizations")
      .select("id, owner_user_id, plan, plan_expires_at, plan_expiry_reminder_sent_at")
      .eq("plan", "enterprise")
      .not("plan_expires_at", "is", null);
    if (orgErr) throw orgErr;

    for (const org of orgRows || []) {
      try {
        const daysLeft = wibDaysUntil(org.plan_expires_at, now);
        if (daysLeft <= -MAYAR_GRACE_PERIOD_DAYS) {
          const { error } = await admin.from("organizations").update({ plan: null, plan_expires_at: null, plan_expiry_reminder_sent_at: null, member_limit: 1 }).eq("id", org.id);
          if (error) throw error;
          console.log("[check-plan-expiry] SAFETY-NET downgrade (organizations):", org.id, "expired", org.plan_expires_at, "(lewat masa tenggang)");
          results.downgraded.push(`org:${org.id}`);
        } else if (daysLeft <= REMINDER_DAYS_BEFORE && !org.plan_expiry_reminder_sent_at && org.owner_user_id) {
          const { data: userRes } = await admin.auth.admin.getUserById(org.owner_user_id);
          const email = userRes?.user?.email;
          const sent = await sendReminderEmail(email, TIER_LABEL.enterprise, org.plan_expires_at);
          if (sent) {
            await admin.from("organizations").update({ plan_expiry_reminder_sent_at: now.toISOString() }).eq("id", org.id);
            results.reminded.push(`org:${org.id}`);
          }
        }
      } catch (orgRowErr) {
        console.log("[check-plan-expiry] EXCEPTION (org row)", org.id, String(orgRowErr));
        results.errors.push({ org_id: org.id, error: String(orgRowErr) });
      }
    }

    console.log("[check-plan-expiry] done", JSON.stringify(results));
    return new Response(JSON.stringify({ ok: true, ...results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[check-plan-expiry] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
