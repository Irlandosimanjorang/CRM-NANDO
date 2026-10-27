// Supabase Edge Function: admin-trigger
// Jembatan aman buat tombol "Panggil Sekarang" di Dashboard Admin (dalem app).
// CRON_SECRET tetep di server, gak pernah dikirim ke browser - function ini
// yang verifikasi dulu identitas pemanggil (harus ADMIN_EMAIL), baru manggil
// function target-nya pake CRON_SECRET internal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL"); // email Nando - satu-satunya yang boleh manggil ini

// Daftar function yang BOLEH dipanggil lewat jembatan ini - whitelist eksplisit,
// biar gak ada yang bisa manggil sembarang Edge Function lain lewat sini.
// (9 Sep 2026: + content-drafter buat karyawan baru NOVA - Marketing & Content)
// (10 Sep 2026: + weekly-garbage-sweep buat karyawan baru SAPU - Kebersihan Database)
const ALLOWED_TARGETS = ["health-check", "daily-digest", "content-drafter", "weekly-garbage-sweep"];

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { target } = await req.json();
    if (!ALLOWED_TARGETS.includes(target)) {
      return new Response(JSON.stringify({ error: "Target gak diizinin" }), { status: 400, headers: CORS });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Cuma admin platform yang boleh manggil ini" }), { status: 403, headers: CORS });
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${target}`, {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const text = await resp.text();

    return new Response(JSON.stringify({ ok: resp.ok, target, status: resp.status, result: text }), {
      status: resp.ok ? 200 : 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
