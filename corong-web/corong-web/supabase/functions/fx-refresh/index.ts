// Supabase Edge Function: fx-refresh (26 Okt 2026)
// Dipanggil cron tiap 6 jam (x-cron-secret). Mengambil kurs USD/IDR terbaru dan menyimpannya di
// admin_settings (fx_usd_idr). Dibaca oleh admin_ai_usage_report() dan Cash Flow, jadi estimasi biaya
// AI dan HPP selalu memakai kurs terbaru tanpa perlu ada yang membuka halaman.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const SOURCES: [string, string, (j: any) => unknown][] = [
  ["open.er-api.com", "https://open.er-api.com/v6/latest/USD", (j) => j?.rates?.IDR],
  ["frankfurter.dev", "https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", (j) => j?.rates?.IDR],
];

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  for (const [source, url, pick] of SOURCES) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const rate = Number(pick(await r.json()));
      if (rate > 1000 && rate < 100000) {
        const v = { rate: Math.round(rate), source, fetched_at: new Date().toISOString() };
        const { error } = await admin.from("admin_settings").upsert({ key: "fx_usd_idr", value: v, updated_at: v.fetched_at });
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true, ...v }), { headers: { "Content-Type": "application/json" } });
      }
    } catch (_) {
      // coba sumber berikutnya
    }
  }
  return new Response(JSON.stringify({ ok: false, error: "semua sumber kurs gagal" }), { status: 502, headers: { "Content-Type": "application/json" } });
});
