// Supabase Edge Function: track-visit
// Analitik sendiri buat nexto.site (17 Sep 2026, permintaan Nando) - jauh
// lebih simpel dari Google/Vercel Analytics, tapi datanya langsung nempel di
// Command Center (card TRAFFIC), gak perlu buka dashboard lain.
//
// Dipanggil fire-and-forget dari landing page (Auth.jsx) & halaman publik
// lain (GrokBotMcp.jsx, PublicDemo.jsx) tiap kali kebuka - CUMA nyimpen:
// halaman apa, referrer dari mana, device HP/Desktop, lokasi kasar
// (kota/negara), dan session_id (di-generate acak di browser, disimpen
// localStorage - BUKAN identitas orang, cuma buat itung unique/returning
// visitor per browser).
//
// === /demo DITAMBAHIN KE WHITELIST (18 Sep 2026) ===
// Halaman demo interaktif publik baru (nexto.site/demo, buat dilampirin ke
// proposal sales) - ditambahin ke ALLOWED_PAGES biar kunjungannya ikut
// kecatet di TRAFFIC, bukan di-reject/dianggap "/".
//
// === LOKASI (18 Sep 2026, permintaan Nando) ===
// Lookup kota/negara dari IP pake ip-api.com (gratis, gak perlu API key,
// batas 45 req/menit - cukup buat skala sekarang). Lookup dilakuin SEBELUM
// IP-nya di-hash - abis dapet kota/negaranya, IP mentahnya LANGSUNG dibuang
// (gak pernah disimpen ke database, cuma hash-nya doang buat rate limit).
// Fail-open: kalau lookup gagal/timeout, country/city null, visit-nya tetep
// kesimpen - analitik gak boleh gagal gara-gara layanan pihak ketiga down.
//
// KEAMANAN & PRIVASI:
// - IP address di-HASH (SHA-256) sebelum disimpen - gak pernah nyimpen IP
//   mentah, cuma buat rate-limit & itung visitor unik kasar, konsisten sama
//   prinsip minimalisasi data di Privacy Policy Nexto.
// - Payload divalidasi ketat (page_path harus dari whitelist, panjang
//   referrer/device dibatesin) - bukan free-text sembarangan.
// - Rate limit per IP (dihash) - maks 30 catetan/menit, lebih dari cukup
//   buat visitor asli, nutup jalur spam paling gampang.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PAGES = ["/", "/grok-bot", "/app", "/demo"];

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Timeout pendek (2 detik) - jangan sampe visitor nunggu lama gara-gara
// layanan geolocation lambat, lebih baik country/city kosong daripada bikin
// tracking call ini nge-lag.
async function lookupLocation(ip) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return { country: null, city: null };
    const dat = await resp.json();
    if (dat.status !== "success") return { country: null, city: null };
    return { country: dat.country || null, city: dat.city || null };
  } catch (_) {
    return { country: null, city: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
    const ipHash = clientIp !== "unknown" ? await sha256Hex(clientIp) : null;

    if (ipHash) {
      const oneMinAgo = new Date(Date.now() - 60000).toISOString();
      const { count } = await admin.from("page_visits").select("id", { count: "exact", head: true }).eq("client_ip_hash", ipHash).gte("created_at", oneMinAgo);
      if ((count ?? 0) >= 30) {
        return new Response(JSON.stringify({ ok: false }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    const body = await req.json().catch(() => ({}));
    const pagePath = ALLOWED_PAGES.includes(body.page_path) ? body.page_path : "/";
    const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "unknown";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 200) : null;
    const device = body.device === "mobile" ? "mobile" : "desktop";

    const { country, city } = clientIp !== "unknown" ? await lookupLocation(clientIp) : { country: null, city: null };

    await admin.from("page_visits").insert({ session_id: sessionId, page_path: pagePath, referrer, device, client_ip_hash: ipHash, country, city });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
