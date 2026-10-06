// Supabase Edge Function: send-lead-email
// Kirim email ke lead langsung dari CRM (manual, sales yang pilih kapan
// kirim). Abis kekirim, otomatis kecatet jadi progress note.
//
// Riwayat (detail di versi sebelumnya): tier gate Standard+, sender
// noreply@nexto.site, IDOR fix (lead wajib punya org pengirim & di-assign ke
// dia kalau bukan owner/manager), multi-email dipisah koma, limit 30
// kiriman/hari WIB per user lewat reserve_edge_function_call.
//
// === AUDIT (1 Okt 2026) ===
// - `.catch()` langsung di hasil admin.rpc(...) (builder PostgREST gak punya
//   .catch) bikin pengembalian kuota error sendiri pas Resend gagal - user
//   malah dapet error teknis & kuota tetep kepotong. Sekarang try/await.
// - Isi email di-escape (karakter < > & dari teks sales gak lagi dibaca
//   sebagai HTML).
// - Pesan ke user pakai bahasa baku.
//
// === BATAS BULANAN (6 Okt 2026, permintaan Nando) ===
// Dari 30x/hari menjadi 15x/bulan per pengguna (1 bulan sejak pemakaian
// pertama, lihat quota_periods). Semua email
// terkirim dari noreply@nexto.site - domain yang sama dengan invoice &
// pengingat jatuh tempo - jadi pengiriman massal dari banyak akun berisiko
// menurunkan reputasi domain (email invoice ikut masuk spam).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MONTHLY_LIMIT = 15;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), 1) - WIB_OFFSET_MS);
}
// Kuota berlaku 1 bulan sejak pemakaian pertama (6 Okt 2026, quota_periods).
async function quotaRefillText(admin, userId, feature) {
  try {
    const { data } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: feature });
    if (data?.reset_at) return `Kuota terisi kembali pada ${new Date(data.reset_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}.`;
  } catch (_) { /* pesan tanpa tanggal */ }
  return "Kuota terisi kembali 1 bulan setelah pemakaian pertama.";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let admin = null;
  let reservationId = null;
  const releaseQuota = async () => {
    if (!admin || !reservationId) return;
    try { await admin.rpc("release_edge_function_call", { p_id: reservationId }); } catch (_) { /* best effort */ }
    reservationId = null;
  };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sesi login berakhir. Silakan masuk kembali." }, 401);
    const userId = userData.user.id;

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---- TIER GATE - Kirim Email itu fitur Standard ke atas (bukan Free).
    const { data: gateMemberRow } = await admin.from("organization_members").select("org_id, role").eq("user_id", userId).limit(1).maybeSingle();
    const gateOrgResult = gateMemberRow ? await admin.from("organizations").select("plan").eq("id", gateMemberRow.org_id).maybeSingle() : { data: null };
    const { data: gateSettingsRow } = await admin.from("settings").select("plan").eq("user_id", userId).maybeSingle();
    const GATE_PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const gateIsEnterprise = gateOrgResult.data?.plan === "enterprise";
    const gateMyPlanLevel = gateIsEnterprise ? 2 : (GATE_PLAN_LEVEL[gateSettingsRow?.plan] ?? 0);
    if (gateMyPlanLevel < 1) {
      return json({ error: "Kirim Email tersedia untuk paket Standard ke atas. Silakan upgrade di tab Pengaturan." }, 403);
    }

    const { lead_id, to_email, to_name, subject, body: emailBody, sender_name } = await req.json();
    if (!to_email || !subject || !emailBody) return json({ error: "Email tujuan, subjek, dan isi wajib diisi." }, 400);
    const toEmails = String(to_email).split(",").map((s) => s.trim()).filter((s) => s !== "" && EMAIL_RE.test(s));
    if (toEmails.length === 0) return json({ error: "Format email tujuan tidak valid." }, 400);

    // ---- OWNERSHIP CHECK (IDOR fix) - ditolak SEBELUM kirim/nyatet apa pun.
    let leadOrgId = null;
    if (lead_id) {
      const { data: leadRow } = await admin.from("leads").select("id, org_id, assigned_to").eq("id", lead_id).maybeSingle();
      const isManager = gateMemberRow?.role === "owner" || gateMemberRow?.role === "manager";
      const owns = leadRow && gateMemberRow && leadRow.org_id === gateMemberRow.org_id && (isManager || leadRow.assigned_to === userId);
      if (!owns) return json({ error: "Lead tidak ditemukan atau bukan bagian dari akses Anda." }, 403);
      leadOrgId = leadRow.org_id;
    }

    // ---- LIMIT BULANAN - reservasi atomic, dilepas lagi kalau pengiriman gagal.
    const { data: reserved, error: rlErr } = await admin.rpc("reserve_edge_function_call", {
      p_user_id: userId, p_function_name: "send-lead-email",
      p_window_start: wibMonthStartUTC().toISOString(), p_max_calls: MONTHLY_LIMIT,
    });
    if (rlErr) console.error("[send-lead-email] reserve_edge_function_call gagal:", rlErr);
    if (!reserved) return json({ error: `Batas kirim email (${MONTHLY_LIMIT}x per bulan) sudah tercapai. ${await quotaRefillText(admin, userId, "send-lead-email")}` }, 429);
    reservationId = reserved;

    const htmlBody = emailBody.split("\n").map((line) => `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">${line ? escapeHtml(line) : "&nbsp;"}</p>`).join("");
    const fromLabel = sender_name ? `${sender_name} via Nexto` : "Nexto";

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${fromLabel} <noreply@nexto.site>`,
        to: toEmails,
        subject,
        html: `<div style="max-width:560px;margin:0 auto;font-family:ui-sans-serif,system-ui,sans-serif;">${htmlBody}</div>`,
      }),
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      console.error("[send-lead-email] Resend gagal:", emailResp.status, errText.slice(0, 300));
      await releaseQuota();
      return json({ error: "Email gagal dikirim. Kuota Anda tidak terpakai, silakan coba lagi beberapa saat lagi." }, 500);
    }
    reservationId = null; // email sudah terkirim - kuota tetap terpakai walau langkah berikutnya gagal

    // Kecatet otomatis jadi progress note, biar riwayat komunikasi lengkap.
    if (lead_id) {
      const today = new Date().toISOString().slice(0, 10);
      await admin.from("progress_notes").insert({
        user_id: userId, org_id: leadOrgId, lead_id, note_date: today,
        text: `📧 Email terkirim ke ${to_name || toEmails.join(", ")} — subjek: "${subject}"`,
      });
      await admin.from("leads").update({ last_contact: today }).eq("id", lead_id);
    }

    return json({ ok: true });
  } catch (e) {
    await releaseQuota();
    return json({ error: String(e) }, 500);
  }
});
