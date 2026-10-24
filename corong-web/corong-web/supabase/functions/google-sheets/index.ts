// Supabase Edge Function: google-sheets (25 Okt 2026)
// Ekspor lead milik sales ke Google Sheet baru. Khusus paket Enterprise dan peran sales_rep.
// Scope: drive.file (aplikasi hanya bisa mengakses file yang dibuatnya sendiri).
// Alur: POST action=connect -> URL consent -> GET callback (tukar code, simpan refresh token) -> POST action=export.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const FN_URL = `${SUPABASE_URL}/functions/v1/google-sheets`;
const APP_URL = "https://nexto.site";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

const CORS = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Cek login, paket Enterprise, dan peran sales_rep. Mengembalikan user dan org.
async function requireSalesEnterprise(admin: any, authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: u } = await createClient(SUPABASE_URL!, ANON_KEY!).auth.getUser(token);
  if (!u?.user) return { error: json({ error: "Unauthorized" }, 401) };
  const { data: m } = await admin.from("organization_members").select("org_id, role").eq("user_id", u.user.id).limit(1).maybeSingle();
  if (!m) return { error: json({ error: "Organisasi tidak ditemukan." }, 403) };
  const { data: org } = await admin.from("organizations").select("plan").eq("id", m.org_id).maybeSingle();
  if (org?.plan !== "enterprise") return { error: json({ error: "Ekspor Google Sheet khusus paket Enterprise." }, 403) };
  if (m.role !== "sales_rep") return { error: json({ error: "Ekspor Google Sheet hanya untuk sales." }, 403) };
  return { userId: u.user.id, orgId: m.org_id };
}

async function accessTokenFor(admin: any, userId: string): Promise<string | null> {
  const { data: link } = await admin.from("google_sheets_links").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!link) return null;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: link.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) return null;
  const tok = await resp.json();
  return tok.access_token || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  const url = new URL(req.url);

  try {
    // Callback dari Google setelah user memberi izin.
    if (req.method === "GET" && url.searchParams.get("action") === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return json({ error: "Parameter tidak lengkap." }, 400);
      const { data: st } = await admin.from("google_sheets_oauth_states").select("user_id, created_at").eq("state", state).maybeSingle();
      await admin.from("google_sheets_oauth_states").delete().eq("state", state);
      if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60000) {
        return new Response("Sesi koneksi kedaluwarsa. Coba hubungkan lagi dari Nexto.", { status: 400 });
      }
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${FN_URL}?action=callback`, grant_type: "authorization_code",
        }),
      });
      const tok = await resp.json();
      if (!resp.ok || !tok.refresh_token) return new Response("Google tidak mengembalikan izin akses. Coba lagi.", { status: 400 });
      await admin.from("google_sheets_links").upsert({ user_id: st.user_id, refresh_token: tok.refresh_token, updated_at: new Date().toISOString() });
      return Response.redirect(`${APP_URL}/?sheets=ok`, 302);
    }

    if (req.method !== "POST") return json({ error: "Method tidak didukung" }, 405);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const auth = await requireSalesEnterprise(admin, authHeader);
    if ("error" in auth) return auth.error;

    // Mulai koneksi: kembalikan URL consent Google untuk scope drive.file.
    if (body.action === "connect") {
      const state = crypto.randomUUID();
      await admin.from("google_sheets_oauth_states").insert({ state, user_id: auth.userId });
      const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      consent.searchParams.set("client_id", GOOGLE_CLIENT_ID!);
      consent.searchParams.set("redirect_uri", `${FN_URL}?action=callback`);
      consent.searchParams.set("response_type", "code");
      consent.searchParams.set("scope", SHEETS_SCOPE);
      consent.searchParams.set("access_type", "offline");
      consent.searchParams.set("prompt", "consent");
      consent.searchParams.set("state", state);
      return json({ url: consent.toString() });
    }

    // Ekspor: buat Google Sheet baru berisi lead milik user ini.
    if (body.action === "export") {
      const accessToken = await accessTokenFor(admin, auth.userId);
      if (!accessToken) return json({ needs_connect: true });

      const { data: stages } = await admin.from("stages").select("key, label").eq("org_id", auth.orgId);
      const labelOf = Object.fromEntries((stages || []).map((s: any) => [s.key, s.label]));
      const { data: leads } = await admin
        .from("leads")
        .select("name, city, product, stage_key, deal_value, deal_date, visit_date, last_contact, next_action")
        .eq("org_id", auth.orgId).eq("assigned_to", auth.userId).is("deleted_at", null)
        .order("last_contact", { ascending: false, nullsFirst: false });

      const header = ["Nama", "Kota", "Produk", "Tahap", "Nilai deal", "Tanggal deal", "Tanggal visit", "Kontak terakhir", "Next action"];
      const rows = (leads || []).map((l: any) => [
        l.name || "", l.city || "", l.product || "", labelOf[l.stage_key] || l.stage_key || "",
        Number(l.deal_value) || 0, l.deal_date || "", l.visit_date || "", l.last_contact || "", l.next_action || "",
      ]);

      const createResp = await fetch("https://sheets.googleapis.com/v1/spreadsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ properties: { title: `Nexto - Lead saya ${new Date().toISOString().slice(0, 10)}` } }),
      });
      if (!createResp.ok) return json({ error: "Gagal membuat Google Sheet: " + (await createResp.text()).slice(0, 200) }, 502);
      const sheet = await createResp.json();

      const valuesResp = await fetch(
        `https://sheets.googleapis.com/v1/spreadsheets/${sheet.spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ values: [header, ...rows] }),
        },
      );
      if (!valuesResp.ok) return json({ error: "Gagal mengisi Google Sheet." }, 502);

      return json({ url: sheet.spreadsheetUrl, rows: rows.length });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.log("[google-sheets] EXCEPTION", String(e));
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
