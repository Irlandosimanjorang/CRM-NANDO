// Supabase Edge Function: google-oauth-callback
// 13 Okt 2026: gateway Supabase menampilkan HTML sebagai teks mentah, jadi hasilnya sekarang diarahkan (302) ke nexto.site.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REDIRECT_URI = "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/google-oauth-callback";
const APP_URL = "https://nexto.site/?gcal=";

function page(status) {
  return new Response(null, { status: 302, headers: { Location: APP_URL + status } });
}

async function getExistingRefreshToken(admin, userId) {
  const { data } = await admin.from("google_calendar_links").select("refresh_token").eq("user_id", userId).maybeSingle();
  return data?.refresh_token || null;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return page("dibatalkan");
    if (!code || !state) return page("tidak_valid");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: stateRow } = await admin.from("google_oauth_states").select("*").eq("state", state).maybeSingle();
    if (!stateRow || new Date(stateRow.expires_at) < new Date()) return page("kedaluwarsa");
    const userId = stateRow.user_id;

    // Google Calendar itu fitur Professional ke atas. Dicek di sini juga, bukan hanya di UI.
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
      await admin.from("google_oauth_states").delete().eq("state", state);
      return page("bukan_professional");
    }

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tok = await tokenResp.json();
    if (!tokenResp.ok) return page("gagal");

    let email = "";
    try {
      const uiResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
      const ui = await uiResp.json();
      email = ui.email || "";
    } catch (_) {}

    const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
    const refreshToken = tok.refresh_token || (await getExistingRefreshToken(admin, userId));

    await admin.from("google_calendar_links").upsert({
      user_id: userId, email, access_token: tok.access_token,
      refresh_token: refreshToken, expires_at: expiresAt, connected_at: new Date().toISOString(),
    });
    await admin.from("google_oauth_states").delete().eq("state", state);

    return page("ok");
  } catch (e) {
    console.log("[google-oauth-callback]", String(e));
    return page("gagal");
  }
});
