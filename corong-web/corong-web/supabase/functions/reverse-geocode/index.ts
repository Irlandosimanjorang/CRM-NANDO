// Supabase Edge Function: reverse-geocode
// Ubah lat/lng jadi alamat lengkap pake Google Maps Geocoding API - jauh
// lebih detail (sampe nama jalan) dibanding Nominatim/OSM gratis yang
// dipake sebelumnya, yang di banyak area pinggiran Indonesia cuma punya
// data sampe level kelurahan/kota. API key disimpen di sini (server-side)
// biar gak pernah ke-expose ke browser - client cuma manggil fungsi ini.
//
// BUG FIX (11 Sep 2026, ketauan pas audit) - sebelumnya gak ada rate limit
// SAMA SEKALI - user mana pun yang login bisa panggil ini berkali-kali
// dgn koordinat sembarang, numpang jatah billing Google Maps API tanpa
// batas. Ditambahin cap harian per user (dipake buat GPS check-in, wajar
// dipanggil beberapa kali/hari per rep - 100x/hari udah jauh lebih dari
// cukup buat pemakaian normal).
//
// === PLAN GATE FIX (17 Sep 2026, ketauan pas audit) ===
// GPS Check-in (fitur yang manggil endpoint ini) itu Enterprise-only di
// frontend (VisitFollowup.jsx: GpsCheckinLocked) - tapi endpoint ini sendiri
// CUMA ngecek "udah login apa belum", gak pernah ngecek plan org-nya. Kunci
// di UI itu kosmetik doang - siapapun yang login (Free/Standard/Professional)
// bisa manggil endpoint ini LANGSUNG (lewat DevTools/fetch manual) dan tetep
// dapet reverse-geocode Google Maps gratis, padahal harusnya Enterprise-only.
// Sekarang dicek beneran server-side sebelum ngerjain apapun.
//
// === RACE FIX (17 Sep 2026, ketauan pas audit) ===
// Sebelumnya SELECT count() dulu baru INSERT kalau masih di bawah limit -
// 2 langkah TERPISAH, jadi 2 request bersamaan bisa dua-duanya lolos
// hitungan sebelum salah satu sempet insert. Sekarang lewat RPC
// reserve_edge_function_call (check+insert 1 transaksi, advisory lock per
// user+function) - beneran atomic.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = { "Access-Control-Allow-Origin": "https://nexto.site", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAX_CALLS_PER_DAY = 100;

async function isEnterpriseUser(admin, userId) {
  const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!memberRow?.org_id) return false;
  const { data: orgRow } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
  return orgRow?.plan === "enterprise";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Belum login" }), { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---- PLAN GATE - GPS Check-in (fitur yang manggil endpoint ini) itu
    // Enterprise-only, samain di sini biar gak bisa dilewatin manggil
    // langsung dari luar UI.
    if (!(await isEnterpriseUser(admin, userId))) {
      return new Response(JSON.stringify({ error: "Reverse-geocode buat GPS check-in ini fitur khusus paket Enterprise." }), { status: 403, headers: cors });
    }

    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: reserved, error: rlErr } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: "reverse-geocode", p_window_start: dayStart, p_max_calls: MAX_CALLS_PER_DAY });
    if (rlErr) {
      console.error("[reverse-geocode] reserve_edge_function_call gagal:", rlErr);
      return new Response(JSON.stringify({ error: "Gagal cek kuota, coba lagi bentar" }), { status: 500, headers: cors });
    }
    if (!reserved) {
      return new Response(JSON.stringify({ error: "Kuota reverse-geocode harian abis, coba lagi besok." }), { status: 429, headers: cors });
    }

    const { lat, lng } = await req.json();
    if (lat == null || lng == null) return new Response(JSON.stringify({ error: "lat/lng wajib diisi" }), { status: 400, headers: cors });

    if (!GOOGLE_MAPS_API_KEY) {
      // Belum dikonfigurasi - balikin null biar caller fallback ke Nominatim
      return new Response(JSON.stringify({ address: null }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=id&key=${GOOGLE_MAPS_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const address = data.status === "OK" && data.results?.length ? data.results[0].formatted_address : null;

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.log("[reverse-geocode] Google API status:", data.status, data.error_message || "");
    }

    return new Response(JSON.stringify({ address }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
