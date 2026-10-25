// Supabase Edge Function: google-sheets (25 Okt 2026)
// Ekspor laporan ke Google Sheet baru, satu worksheet per tab laporan. Khusus paket Enterprise, semua peran.
// Data tab dikirim dari layar laporan (sudah dibatasi RLS: sales hanya lead miliknya).
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
const MAX_TABS = 5;
const MAX_ROWS = 5000;
const MAX_COLS = 30;

const CORS = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Cek login dan paket Enterprise. Mengembalikan user dan org.
async function requireEnterpriseUser(admin: any, authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: u } = await createClient(SUPABASE_URL!, ANON_KEY!).auth.getUser(token);
  if (!u?.user) return { error: json({ error: "Unauthorized" }, 401) };
  const { data: m } = await admin.from("organization_members").select("org_id, role").eq("user_id", u.user.id).limit(1).maybeSingle();
  if (!m) return { error: json({ error: "Organisasi tidak ditemukan." }, 403) };
  const { data: org } = await admin.from("organizations").select("plan").eq("id", m.org_id).maybeSingle();
  if (org?.plan !== "enterprise") return { error: json({ error: "Ekspor Google Sheet khusus paket Enterprise." }, 403) };
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

// Rapikan tab dari klien: judul dibatasi, baris dan kolom dipotong, nilai selain angka dan teks dibuang.
function cleanTabs(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_TABS).map((t: any, i: number) => ({
    title: String(t?.title || `Tab ${i + 1}`).slice(0, 100),
    rows: (Array.isArray(t?.rows) ? t.rows.slice(0, MAX_ROWS) : []).map((row: unknown) =>
      (Array.isArray(row) ? row.slice(0, MAX_COLS) : []).map((v) =>
        typeof v === "number" ? (Number.isFinite(v) ? v : "") : String(v ?? "").slice(0, 5000)
      )
    ),
  }));
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
    const auth = await requireEnterpriseUser(admin, authHeader);
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

    // Ekspor: buat Google Sheet baru dengan satu worksheet per tab laporan.
    if (body.action === "export") {
      const accessToken = await accessTokenFor(admin, auth.userId);
      if (!accessToken) return json({ needs_connect: true });

      const tabs = cleanTabs(body.tabs);
      if (tabs.length === 0) return json({ error: "Tidak ada data untuk diekspor." }, 400);

      const createResp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          properties: { title: `Nexto - Laporan ${new Date().toISOString().slice(0, 10)}` },
          sheets: tabs.map((t, i) => ({ properties: { title: t.title, index: i } })),
        }),
      });
      if (!createResp.ok) {
        const raw = await createResp.text();
        // Google biasanya membalas JSON berisi error.message. Jika bukan JSON (mis. halaman HTML), kirim status HTTP saja.
        let reason = `HTTP ${createResp.status}`;
        try { reason += `: ${JSON.parse(raw).error?.message ?? raw}`; } catch {
          // Halaman HTML: ambil judul dan teks saja supaya penyebabnya tetap terbaca.
          const text = raw.startsWith("<") ? raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : raw;
          reason += `: ${text.slice(0, 200)}`;
        }
        console.log("[google-sheets] create failed", reason);
        return json({ error: `Gagal membuat Google Sheet (${reason.slice(0, 300)})` }, 502);
      }
      const sheet = await createResp.json();

      // RAW: teks dari data lead ditulis apa adanya, tidak dibaca sebagai formula (mis. "=...").
      const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values:batchUpdate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: tabs.map((t) => ({ range: `'${t.title.replace(/'/g, "''")}'!A1`, values: t.rows })),
        }),
      });
      if (!valuesResp.ok) return json({ error: "Gagal mengisi Google Sheet." }, 502);

      return json({ url: sheet.spreadsheetUrl, tabs: tabs.length });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.log("[google-sheets] EXCEPTION", String(e));
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
