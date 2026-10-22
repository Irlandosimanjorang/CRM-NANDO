// Supabase Edge Function: sync-calendar-bulk
//
// === FIX auto-sync (8 Sep 2026) ===
// Dulu HARUS diklik manual (tombol "Sync" di Pengaturan) - user gampang lupa,
// dan itu yang bikin RAKA (health-check) sempet salah nuduh "sinkronisasi
// gagal diam-diam" padahal emang belum pernah di-sync manual sama sekali.
// Sekarang db.js (upsertLead) manggil ini otomatis fire-and-forget tiap ada
// lead yang disimpen dengan visit_date/next_action - function ini sendiri
// gak berubah alurnya, cuma sekarang dipanggil lebih sering (otomatis, bukan
// cuma pas diklik manual).
//
// === FIX BUG assigned_to vs user_id (8 Sep 2026) ===
// Query lead buat disync sebelumnya filter pake `user_id` (siapa yang BIKIN
// lead-nya) - padahal kepemilikan buat keperluan tim itu `assigned_to` (bisa
// beda kalau lead dibikin/di-reassign sama orang lain, misal manager assign
// ke sales rep). Buat akun solo gak kerasa bedanya (user_id == assigned_to),
// tapi buat tim Enterprise >1 orang, jadwal yang assigned_to-nya BUKAN si
// pemilik Google Calendar yang lagi sync bisa ke-skip diem-diem. Sekarang
// filter pake assigned_to, konsisten sama checkGcalSyncGaps di health-check.
//
// === CORS FIX (17 Sep 2026, ketauan pas audit) ===
// Access-Control-Allow-Origin sebelumnya "*" (wildcard) padahal function ini
// dipanggil dari app yang login (auth JWT) dan nulis data sensitif (event
// Google Calendar, token OAuth) - beda dari mcp-server yang emang SENGAJA
// wildcard karena dipanggil non-browser client eksternal. Gak ada celah
// konkret (endpoint ini udah punya JWT+plan check sendiri, independen dari
// CORS), tapi disamain ke pola SEMUA function berbayar/sensitif lain di
// codebase ini (dikunci ke https://nexto.site) buat konsistensi & defense-
// in-depth, bukan ngandelin CORS doang.
//
// === PENGINGAT VISIT (dibuat 23 Okt 2026, permintaan Nando) ===
// Visit dibuat sebagai acara seharian (start: { date }), yang mulai 00:00
// di kalender user. Pengingat popup 600 menit sebelumnya = 14:00 sehari
// sebelum tanggal visit. Event yang sudah ada ikut diperbarui waktu sync
// berikutnya (PATCH), jadi pengingatnya ikut berubah tanpa perlu dibuat ulang.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Acara seharian mulai 00:00; 600 menit sebelumnya = 14:00 H-1.
const VISIT_REMINDER_MINUTES = 600;

async function getValidAccessToken(admin, userId) {
  const { data: link } = await admin.from("google_calendar_links").select("*").eq("user_id", userId).maybeSingle();
  if (!link) return null;
  if (new Date(link.expires_at) > new Date(Date.now() + 60000)) return link.access_token;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: link.refresh_token, grant_type: "refresh_token",
    }),
  });
  const tok = await resp.json();
  if (!resp.ok) return null;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await admin.from("google_calendar_links").update({ access_token: tok.access_token, expires_at: expiresAt }).eq("user_id", userId);
  return tok.access_token;
}

async function upsertCalendarEvent(accessToken, existingEventId, summary, description, dateISO) {
  const eventBody = {
    summary, description, start: { date: dateISO }, end: { date: dateISO },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: VISIT_REMINDER_MINUTES }] },
  };
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  if (existingEventId) {
    const resp = await fetch(`${base}/${existingEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(eventBody),
    });
    if (resp.ok) { const d = await resp.json(); return d.id; }
  }
  const resp2 = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(eventBody),
  });
  if (!resp2.ok) return null;
  const d2 = await resp2.json();
  return d2.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anonClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // BUG FIX (6 Sep 2026): Google Calendar itu fitur Professional ke atas,
    // tapi function ini gak pernah ngecek plan sama sekali - siapa aja yang
    // (entah gimana caranya) punya row di google_calendar_links bisa mancing
    // sync jalan terus. Dicek di sini juga buat defense-in-depth.
    const [{ data: settingsRow }, { data: memberRow }] = await Promise.all([
      admin.from("settings").select("plan").eq("user_id", userId).maybeSingle(),
      admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle(),
    ]);
    let orgPlan = null;
    if (memberRow?.org_id) {
      const { data: orgRow } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
      orgPlan = orgRow?.plan || null;
    }
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const myPlanLevel = orgPlan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (myPlanLevel < 2) {
      return new Response(JSON.stringify({ error: "Google Calendar itu fitur Professional ke atas." }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const accessToken = await getValidAccessToken(admin, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google Calendar belum terhubung." }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const { data: leads } = await admin
      .from("leads")
      .select("id, name, visit_date, visit_agenda, next_action, gcal_visit_event_id, gcal_followup_event_id")
      .eq("assigned_to", userId)
      .is("deleted_at", null)
      .or("visit_date.not.is.null,next_action.not.is.null");

    let visitSynced = 0;
    let followupSynced = 0;

    for (const lead of leads || []) {
      if (lead.visit_date) {
        const eventId = await upsertCalendarEvent(
          accessToken, lead.gcal_visit_event_id,
          `Visit: ${lead.name}`, lead.visit_agenda || "Kunjungan sales - Nexto", lead.visit_date
        );
        if (eventId) {
          await admin.from("leads").update({ gcal_visit_event_id: eventId }).eq("id", lead.id);
          visitSynced++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, visitSynced, followupSynced, total: leads?.length || 0 }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
