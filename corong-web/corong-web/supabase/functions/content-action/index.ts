// Supabase Edge Function: content-action
// Tombol Approve/Reject buat draft konten NOVA di Command Center. Dipanggil
// LANGSUNG dari browser admin (pake token sesi user, bukan CRON_SECRET) -
// pola sama kayak admin-status/admin-trigger: verifikasi identitas dulu
// (harus ADMIN_EMAIL), baru eksekusi.
//
// "Approve" = 1 langkah manusia yang DIWAJIBKAN sebelum apapun tayang ke
// publik (lihat catatan di content-drafter.ts) - begitu di-approve, function
// ini LANGSUNG coba publish ke Instagram (2 langkah resmi Graph API: bikin
// media container, baru publish). Kalau IG_ACCESS_TOKEN/IG_BUSINESS_ACCOUNT_ID
// belum di-set, draft tetep ke-mark "approved" tapi kasih tau kredensialnya
// belum ada - begitu Nando nambahin secret-nya, tinggal approve lagi
// (idempotent) buat beneran nge-post.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const IG_ACCESS_TOKEN = Deno.env.get("IG_ACCESS_TOKEN");
const IG_BUSINESS_ACCOUNT_ID = Deno.env.get("IG_BUSINESS_ACCOUNT_ID");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function publishToInstagram(imageUrl, caption) {
  if (!IG_ACCESS_TOKEN || !IG_BUSINESS_ACCOUNT_ID) {
    return { posted: false, error: "IG_ACCESS_TOKEN / IG_BUSINESS_ACCOUNT_ID belum di-set di Edge Functions -> Secrets. Draft udah di-approve, tinggal approve lagi begitu kredensial Instagram-nya ada." };
  }
  const base = `https://graph.facebook.com/v19.0/${IG_BUSINESS_ACCOUNT_ID}`;
  const createResp = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: IG_ACCESS_TOKEN }),
  });
  const createDat = await createResp.json();
  if (!createResp.ok || !createDat.id) {
    return { posted: false, error: `Bikin media container gagal: ${createDat?.error?.message || createResp.status}` };
  }
  const publishResp = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createDat.id, access_token: IG_ACCESS_TOKEN }),
  });
  const publishDat = await publishResp.json();
  if (!publishResp.ok || !publishDat.id) {
    return { posted: false, error: `Publish gagal: ${publishDat?.error?.message || publishResp.status}` };
  }
  return { posted: true, mediaId: publishDat.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { draftId, action } = await req.json();
    if (!draftId || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "draftId/action gak valid" }), { status: 400, headers: CORS });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Cuma admin platform yang boleh manggil ini" }), { status: 403, headers: CORS });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: draftRow, error: fetchErr } = await admin.from("content_drafts").select("*").eq("id", draftId).maybeSingle();
    if (fetchErr || !draftRow) return new Response(JSON.stringify({ error: "Draft gak ketemu" }), { status: 404, headers: CORS });

    if (action === "reject") {
      await admin.from("content_drafts").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", draftId);
      return new Response(JSON.stringify({ ok: true, status: "rejected" }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // action === "approve"
    const result = await publishToInstagram(draftRow.image_url, draftRow.caption);
    const update = result.posted
      ? { status: "posted", reviewed_at: new Date().toISOString(), posted_at: new Date().toISOString(), ig_media_id: result.mediaId, error: null }
      : { status: "approved", reviewed_at: new Date().toISOString(), error: result.error };
    await admin.from("content_drafts").update(update).eq("id", draftId);

    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
