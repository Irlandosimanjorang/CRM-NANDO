// Supabase Edge Function: backfill-embeddings
// Proses catatan lama yang belum punya embedding. Dilindungi query parameter ?key=CRON_SECRET (bukan header) - lebih
// simpel dipakai lewat browser. CORS dibatasi ke nexto.site (28 Agt 2026).
//
// TIER GATE (17 Sep 2026): hanya catatan milik pengguna paid (Standard+ individu, atau anggota org Enterprise) yang
// diproses, sama dengan embed-progress-note.
//
// PENCATATAN BIAYA (10 Okt 2026): biaya embedding dijumlah per pengguna lalu dicatat ke ai_usage
// (feature "backfill-embeddings") di akhir proses.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getEmbedding(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 4000) }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI status ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const dat = await resp.json();
  return { embedding: dat.data?.[0]?.embedding || null, tokens: dat.usage?.total_tokens || 0 };
}

// Kumpulin user_id yang plan-nya Standard ke atas (individu) ATAU anggota organisasi Enterprise - SAMA PERSIS logika
// tier gate di embed-progress-note, dihitung sekali di depan (bukan per-baris).
async function getPaidUserIds(admin) {
  const [{ data: paidSettings }, { data: allMembers }, { data: enterpriseOrgs }] = await Promise.all([
    admin.from("settings").select("user_id").in("plan", ["standard", "premium"]),
    admin.from("organization_members").select("user_id, org_id"),
    admin.from("organizations").select("id").eq("plan", "enterprise"),
  ]);
  const enterpriseOrgIds = new Set((enterpriseOrgs || []).map((o) => o.id));
  const enterpriseUserIds = (allMembers || []).filter((m) => enterpriseOrgIds.has(m.org_id)).map((m) => m.user_id);
  return new Set([...(paidSettings || []).map((s) => s.user_id), ...enterpriseUserIds]);
}

// Catat total token per pengguna ke ai_usage. Gagal mencatat TIDAK boleh menggagalkan proses.
async function logUsage(admin, tokensByUser) {
  const rows = Object.entries(tokensByUser).filter(([, t]) => t > 0).map(([userId, tokens]) => ({
    feature: "backfill-embeddings", user_id: userId, provider: "openai", model: "text-embedding-3-small",
    input_tokens: tokens, cost_usd: (tokens * 0.02) / 1e6,
  }));
  if (!rows.length) return;
  try {
    const { error } = await admin.from("ai_usage").insert(rows);
    if (error) console.log("[ai-usage] simpan gagal:", error.message);
  } catch (e) {
    console.log("[ai-usage] exception:", String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: "CRON_SECRET belum di-set di server" }), { status: 500, headers: CORS });
  }
  if (key !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized - tambahin ?key=CRON_SECRET_LU di URL" }), { status: 401, headers: CORS });
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY belum di-set di Secrets" }), { status: 500, headers: CORS });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const paidUserIds = await getPaidUserIds(admin);
    if (paidUserIds.size === 0) {
      return new Response(JSON.stringify({ ok: true, processed_this_run: 0, failed: 0, remaining: 0, note: "Gak ada user paid (Standard ke atas) - gak ada yang perlu di-backfill." }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: rows, error } = await admin
      .from("progress_notes")
      .select("id, text, user_id")
      .is("embedding", null)
      .not("text", "is", null)
      .in("user_id", [...paidUserIds])
      .limit(200);
    if (error) throw error;

    let done = 0, failed = 0;
    const firstError = { msg: null };
    const tokensByUser = {};
    for (const row of rows || []) {
      try {
        const { embedding, tokens } = await getEmbedding(row.text);
        tokensByUser[row.user_id] = (tokensByUser[row.user_id] || 0) + tokens;
        if (embedding) {
          await admin.from("progress_notes").update({ embedding }).eq("id", row.id);
          done++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        if (!firstError.msg) firstError.msg = String(err).slice(0, 200);
      }
    }
    await logUsage(admin, tokensByUser);

    const { count: remaining } = await admin
      .from("progress_notes")
      .select("id", { count: "exact", head: true })
      .is("embedding", null)
      .not("text", "is", null)
      .in("user_id", [...paidUserIds]);

    return new Response(JSON.stringify({
      ok: true, processed_this_run: done, failed, remaining: remaining ?? 0,
      first_error: firstError.msg,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
