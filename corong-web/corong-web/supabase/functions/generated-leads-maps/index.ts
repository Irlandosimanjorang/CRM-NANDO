// Link Google Maps resmi untuk lead hasil Generate Leads (15 Okt 2026), lewat Google Places API (Text Search).
// Hanya lead yang bisa dibaca user (RLS) yang diproses. Hasil disimpan di generated_leads.maps_url.
// Secret: GOOGLE_PLACES_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PLACES_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    if (!PLACES_KEY) return json({ error: "Google Places API key belum diisi di server." }, 500);

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string").slice(0, 50) : [];
    if (ids.length === 0) return json({ error: "Tidak ada lead yang dipilih." }, 400);

    const { data: rows, error } = await user.from("generated_leads").select("id, name, city, maps_url").in("id", ids);
    if (error) return json({ error: error.message }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const results = [];
    for (const r of rows || []) {
      if (r.maps_url) { results.push({ id: r.id, maps_url: r.maps_url, cached: true }); continue; }
      const q = [r.name, r.city].filter(Boolean).join(" ");
      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": PLACES_KEY, "X-Goog-FieldMask": "places.displayName,places.googleMapsUri" },
        body: JSON.stringify({ textQuery: q, languageCode: "id", regionCode: "ID", maxResultCount: 1 }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) { results.push({ id: r.id, maps_url: null, cached: false, error: d?.error?.message || `Places ${resp.status}` }); continue; }
      const uri = d.places?.[0]?.googleMapsUri || null;
      await admin.from("generated_leads").update({ maps_url: uri, maps_checked_at: new Date().toISOString() }).eq("id", r.id);
      results.push({ id: r.id, maps_url: uri, cached: false });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
