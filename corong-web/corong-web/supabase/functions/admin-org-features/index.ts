// Supabase Edge Function: admin-org-features (8 Okt 2026)
// Kelola saklar fitur per organisasi (kolom organizations.features) dari
// Command Center (kartu FITUR KLIEN). Hanya ADMIN_EMAIL - pola sama dengan
// admin-invoices. Kolom features dijaga trigger sehingga owner organisasi tidak
// bisa mengubahnya sendiri; function ini memakai service role.
//
// Body: { action: "list" }                                  -> organisasi + saklarnya
//       { action: "set", org_id, key, enabled }             -> nyalakan/matikan satu fitur
//       { action: "apply_preset", org_id, preset }           -> ganti seluruh saklar dengan isi preset
//       { action: "copy_features", org_id, from_org_id }     -> salin saklar dari organisasi lain
//
// FEATURE_KEYS dan PRESETS harus sama dengan ORG_FEATURES dan ORG_PRESETS di
// src/lib/orgFeatures.js. Preset hanya mengatur saklar fitur, tidak menyentuh
// tahap pipeline atau field (itu milik tiap organisasi).
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEATURE_KEYS = ["marketing_report", "lead_webhook"];
const PRESETS = {
  standar: [],
  marketing: ["marketing_report", "lead_webhook"],
  webhook: ["lead_webhook"],
};
const asFlags = (keys) => Object.fromEntries(keys.map((k) => [k, true]));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat mengelola fitur klien." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data: orgs, error } = await admin.from("organizations")
        .select("id, name, plan, industry, owner_user_id, features, created_at")
        .order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      // Email owner (untuk membedakan organisasi yang namanya sama, mis. "Organisasi Saya").
      const ids = [...new Set((orgs || []).map((o) => o.owner_user_id).filter(Boolean))];
      const emails = new Map();
      for (let i = 0; i < ids.length; i += 20) {
        await Promise.all(ids.slice(i, i + 20).map(async (id) => {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        }));
      }
      return json({
        keys: FEATURE_KEYS,
        orgs: (orgs || []).map((o) => ({
          id: o.id, name: o.name, plan: o.plan, industry: o.industry, created_at: o.created_at,
          owner_email: emails.get(o.owner_user_id) || null, features: o.features || {},
        })),
      });
    }

    if (body.action === "set") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (!FEATURE_KEYS.includes(body.key)) return json({ error: "Fitur tidak dikenal." }, 400);
      const { data: org, error } = await admin.from("organizations").select("id, features").eq("id", body.org_id).maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      const next = { ...(org.features || {}) };
      if (body.enabled) next[body.key] = true; else delete next[body.key];
      const { error: upErr } = await admin.from("organizations").update({ features: next }).eq("id", org.id);
      if (upErr) throw upErr;
      console.log(`[admin-org-features] ${body.key}=${!!body.enabled} untuk org ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    if (body.action === "apply_preset") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (!Object.prototype.hasOwnProperty.call(PRESETS, body.preset)) return json({ error: "Preset tidak dikenal." }, 400);
      const next = asFlags(PRESETS[body.preset]);
      const { data: org, error } = await admin.from("organizations").update({ features: next }).eq("id", body.org_id).select("id").maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      console.log(`[admin-org-features] preset ${body.preset} untuk org ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    if (body.action === "copy_features") {
      if (!UUID_RE.test(String(body.org_id || "")) || !UUID_RE.test(String(body.from_org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (body.org_id === body.from_org_id) return json({ error: "Pilih organisasi sumber yang berbeda." }, 400);
      const { data: src, error } = await admin.from("organizations").select("features").eq("id", body.from_org_id).maybeSingle();
      if (error) throw error;
      if (!src) return json({ error: "Organisasi sumber tidak ditemukan." }, 404);
      // Hanya kunci yang dikenal dan bernilai true yang disalin.
      const next = asFlags(FEATURE_KEYS.filter((k) => src.features?.[k] === true));
      const { data: org, error: upErr } = await admin.from("organizations").update({ features: next }).eq("id", body.org_id).select("id").maybeSingle();
      if (upErr) throw upErr;
      if (!org) return json({ error: "Organisasi tujuan tidak ditemukan." }, 404);
      console.log(`[admin-org-features] salin saklar dari ${body.from_org_id} ke ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[admin-org-features]", String(e));
    return json({ error: String(e?.message || e) }, 500);
  }
});
