// Supabase Edge Function: embed-progress-note
// Dipanggil OTOMATIS oleh trigger database (trigger_embed_progress_note) tiap ada progress note baru / teks progress
// note diedit - dari web app maupun NEX Pro, satu tempat ini yang urus semua.
//
// Biayanya KECIL BANGET - model text-embedding-3-small OpenAI ~$0.02 per 1 juta token, satu progress note biasanya
// cuma puluhan token. Embedding bikin panggilan Claude berikutnya lebih hemat & relevan (kirim catatan yang PALING
// NYAMBUNG, bukan asal yang terakhir).
//
// Keamanan: endpoint dikunci header x-webhook-secret yang dibandingkan dengan secret di Supabase Vault
// (embed_webhook_secret, lewat RPC get_webhook_secret). Fail-closed: kalau secret gak bisa diambil, semua request ditolak.
//
// === GATE PAKET DIPERBAIKI (10 Okt 2026, permintaan Nando) ===
// Gate "embedding cuma untuk Standard ke atas" ada sejak 6 Sep 2026 tapi TIDAK PERNAH aktif: payload trigger cuma membawa
// id + text (tanpa user_id), jadi cek paket dilewati dan catatan pengguna Free ikut di-embed (biaya OpenAI kecil tapi
// bocor). Sekarang kalau payload tanpa user_id, user_id dibaca dari baris progress_notes-nya sendiri.
//
// === PENCATATAN BIAYA (10 Okt 2026) ===
// Setiap embedding yang berhasil dicatat ke ai_usage (feature "embed-progress-note") atas nama pemilik catatan.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function getEmbedding(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 4000) }),
  });
  if (!resp.ok) throw new Error(`OpenAI embedding gagal: status ${resp.status}`);
  const dat = await resp.json();
  return { embedding: dat.data?.[0]?.embedding || null, tokens: dat.usage?.total_tokens || 0, model: dat.model || "text-embedding-3-small" };
}

// Catat pemakaian ke ai_usage. Gagal mencatat TIDAK boleh menggagalkan embedding.
async function logEmbeddingUsage(admin, userId, orgId, tokens, model) {
  try {
    const { error } = await admin.from("ai_usage").insert({
      feature: "embed-progress-note", user_id: userId || null, org_id: orgId || null, provider: "openai", model,
      input_tokens: tokens, cost_usd: (tokens * 0.02) / 1e6,
    });
    if (error) console.log("[ai-usage] simpan gagal:", error.message);
  } catch (e) {
    console.log("[ai-usage] exception:", String(e));
  }
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---- Verifikasi request beneran dari trigger DB kita, bukan orang iseng.
    const { data: expectedSecret, error: secretErr } = await admin.rpc("get_webhook_secret", { p_name: "embed_webhook_secret" });
    if (secretErr || !expectedSecret) {
      console.log("[embed-progress-note] secret embed_webhook_secret gak bisa diambil dari Vault - menolak SEMUA request (fail-closed):", secretErr ? String(secretErr.message || secretErr) : "kosong");
      return new Response(JSON.stringify({ ok: false, msg: "Server misconfigured" }), { status: 500 });
    }
    const incomingSecret = req.headers.get("x-webhook-secret");
    if (!safeEqual(incomingSecret, expectedSecret)) {
      console.log("[embed-progress-note] Ditolak: secret gak cocok/gak ada.");
      return new Response(JSON.stringify({ ok: false, msg: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    // Format payload: { record: { id, text, (user_id opsional) } }
    const record = body.record;
    if (!record || !record.id || !record.text) {
      return new Response(JSON.stringify({ ok: false, msg: "Payload gak lengkap, skip." }), { status: 200 });
    }

    // ---- TIER GATE - embedding cuma berguna buat fitur Standard ke atas (Daily Digest, AI Draft Follow-up).
    // user_id dari payload, atau (kalau trigger gak mengirimnya) dari baris progress_notes itu sendiri.
    let userId = record.user_id || null;
    let orgId = record.org_id || null;
    if (!userId) {
      const { data: noteRow } = await admin.from("progress_notes").select("user_id, org_id").eq("id", record.id).maybeSingle();
      userId = noteRow?.user_id || null;
      orgId = orgId || noteRow?.org_id || null;
    }
    if (userId) {
      const [{ data: settingsRow }, { data: memberRow }] = await Promise.all([
        admin.from("settings").select("plan").eq("user_id", userId).maybeSingle(),
        admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle(),
      ]);
      let orgPlan = null;
      if (memberRow) {
        const { data: org } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
        orgPlan = org?.plan;
      }
      const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
      const myPlanLevel = orgPlan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
      if (myPlanLevel < 1) {
        console.log("[embed-progress-note] skip, plan Free:", userId);
        return new Response(JSON.stringify({ ok: true, skipped: "plan Free" }), { headers: { "Content-Type": "application/json" } });
      }
      orgId = orgId || memberRow?.org_id || null;
    }

    const { embedding, tokens, model } = await getEmbedding(record.text);
    if (!embedding) return new Response(JSON.stringify({ ok: false, msg: "Gagal generate embedding" }), { status: 200 });
    await logEmbeddingUsage(admin, userId, orgId, tokens, model);

    const { error } = await admin.from("progress_notes").update({ embedding }).eq("id", record.id);
    if (error) return new Response(JSON.stringify({ ok: false, msg: error.message }), { status: 200 });

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // Sengaja balikin 200 walau error - biar pemanggil gak nge-retry terus-terusan buat error yang gak bakal ke-fix sendiri.
    console.log("[embed-progress-note] error:", String(e));
    return new Response(JSON.stringify({ ok: false, msg: String(e) }), { status: 200 });
  }
});
