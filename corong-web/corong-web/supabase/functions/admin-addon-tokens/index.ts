// Supabase Edge Function: admin-addon-tokens (8 Okt 2026)
// Kelola token tambahan (add-on) Generate Leads dari Command Center (kartu TOKEN ADD-ON).
// Hanya ADMIN_EMAIL - pola sama dengan admin-invoices. Tabel addon_token_lots hanya bisa
// diubah lewat function ini (service role); klien cuma boleh membaca lot miliknya.
//
// Body: { action: "list" }                                      -> semua lot (terbaru dulu)
//       { action: "lookup", email }                              -> cek akun penerima (paket, organisasi)
//       { action: "grant", email, tokens, expires_at?, note? }   -> beri token (1 token = 1 pencarian)
//       { action: "revoke", lot_id }                             -> cabut sisa token sebuah lot
//
// Token dipakai SETELAH kuota bulanan habis (lihat reserve_lead_gen_slot). Generate Leads sendiri
// tetap hanya untuk paket Professional ke atas; token tidak melewati batas paket itu.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKENS = 1000;

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

// Paket efektif pengguna (untuk peringatan): Enterprise ada di organisasi, Standard/Professional di settings.
async function planOf(admin, userId) {
  const { data: m } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  const { data: org } = m ? await admin.from("organizations").select("name, plan, plan_expires_at").eq("id", m.org_id).maybeSingle() : { data: null };
  const { data: st } = await admin.from("settings").select("plan, plan_expires_at").eq("user_id", userId).maybeSingle();
  const live = (iso) => !iso || new Date(iso).getTime() > Date.now();
  let plan = null;
  if (org?.plan === "enterprise" && live(org.plan_expires_at)) plan = "enterprise";
  else if (st?.plan === "premium" && live(st.plan_expires_at)) plan = "professional";
  else if (st?.plan === "standard" && live(st.plan_expires_at)) plan = "standard";
  return { plan, org_name: org?.name || null, can_generate: plan === "enterprise" || plan === "professional" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat mengelola token." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data: lots, error } = await admin.from("addon_token_lots")
        .select("id, user_id, feature, tokens_total, tokens_left, expires_at, note, granted_by, created_at")
        .order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const ids = [...new Set((lots || []).map((l) => l.user_id))];
      const emails = new Map();
      for (let i = 0; i < ids.length; i += 20) {
        await Promise.all(ids.slice(i, i + 20).map(async (id) => {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        }));
      }
      return json({ lots: (lots || []).map((l) => ({ ...l, email: emails.get(l.user_id) || null })) });
    }

    if (body.action === "lookup") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ found: false, invalid: true });
      const user = await findUserByEmail(admin, email);
      if (!user) return json({ found: false });
      return json({ found: true, ...(await planOf(admin, user.id)) });
    }

    if (body.action === "grant") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ error: "Email tidak valid." }, 400);
      const tokens = Math.floor(Number(body.tokens));
      if (!Number.isFinite(tokens) || tokens < 1 || tokens > MAX_TOKENS) return json({ error: `Jumlah token harus 1 sampai ${MAX_TOKENS}.` }, 400);
      let expiresAt = null;
      if (body.expires_at) {
        const d = new Date(`${String(body.expires_at).slice(0, 10)}T23:59:59+07:00`);
        if (Number.isNaN(d.getTime())) return json({ error: "Tanggal kedaluwarsa tidak valid." }, 400);
        if (d.getTime() <= Date.now()) return json({ error: "Tanggal kedaluwarsa harus di masa depan." }, 400);
        expiresAt = d.toISOString();
      }
      const user = await findUserByEmail(admin, email);
      if (!user) return json({ error: `Belum ada akun Nexto dengan email ${email}.` }, 404);
      const { data, error } = await admin.from("addon_token_lots").insert({
        user_id: user.id, feature: "generate-leads", tokens_total: tokens, tokens_left: tokens,
        expires_at: expiresAt, note: String(body.note || "").trim().slice(0, 300), granted_by: userData.user.email,
      }).select("id, user_id, feature, tokens_total, tokens_left, expires_at, note, granted_by, created_at").single();
      if (error) throw error;
      console.log(`[admin-addon-tokens] +${tokens} token generate-leads untuk ${email} oleh ${userData.user.email}`);
      return json({ lot: { ...data, email }, ...(await planOf(admin, user.id)) });
    }

    if (body.action === "revoke") {
      if (!UUID_RE.test(String(body.lot_id || ""))) return json({ error: "Lot tidak valid." }, 400);
      const { data: lot, error } = await admin.from("addon_token_lots").select("id, note, tokens_left").eq("id", body.lot_id).maybeSingle();
      if (error) throw error;
      if (!lot) return json({ error: "Lot tidak ditemukan." }, 404);
      const note = `${lot.note || ""}${lot.note ? " " : ""}(dicabut ${lot.tokens_left} token)`.slice(0, 300);
      const { data, error: upErr } = await admin.from("addon_token_lots").update({ tokens_left: 0, note }).eq("id", lot.id).select("id, tokens_left, note").single();
      if (upErr) throw upErr;
      console.log(`[admin-addon-tokens] cabut ${lot.tokens_left} token lot ${lot.id} oleh ${userData.user.email}`);
      return json({ lot: data });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[admin-addon-tokens]", String(e));
    return json({ error: String(e?.message || e) }, 500);
  }
});
