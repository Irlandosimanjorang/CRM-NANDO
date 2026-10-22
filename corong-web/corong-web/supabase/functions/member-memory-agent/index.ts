// Supabase Edge Function: member-memory-agent (23 Okt 2026)
// Lapisan berpikir untuk memori per user. Fakta pipeline dihitung SQL (member_facts), lalu Claude Haiku
// menulis ringkasan, risiko, langkah berikutnya, dan skor AI (uji berdampingan dengan skor rumus).
// Hasil disimpan di member_agent_context dan dibaca build_memory_context(). Dipanggil cron harian
// lewat header x-cron-secret. Skor rumus (member_memory_health) TIDAK diubah oleh fungsi ini.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const MODEL = "claude-haiku-5-5";
const PRICE_IN = 1; // USD per juta token input (Haiku)
const PRICE_OUT = 5; // USD per juta token output (Haiku)
const MIN_LEADS = 5;
const MAX_USERS_PER_RUN = 60;
const CLAUDE_TIMEOUT_MS = 45000;

const SYSTEM = `Kamu asisten sales di CRM Nexto. Tugasmu membaca fakta pipeline satu sales lalu menilai kualitas pengelolaan pipeline-nya dan menulis penjelasan singkat dalam Bahasa Indonesia baku dan sopan.

Rubrik skor (0-100), pilih rentang yang paling sesuai dengan fakta:
- 80-100: catatan rutin hampir tiap hari, mayoritas lead punya catatan segar dan next action jelas.
- 60-79: cukup. Ada catatan rutin, tapi beberapa lead terbengkalai atau next action kosong.
- 40-59: banyak lead tanpa catatan atau lama tidak disentuh.
- 0-39: hampir tidak ada aktivitas tercatat.

Aturan:
- Hanya pakai data yang diberikan. Jangan mengarang nama lead, angka, atau kejadian.
- Setiap skor harus bisa dijelaskan dengan bukti: sebut minimal satu nama lead atau angka dari data.
- Kalau data tidak cukup, tulis "data belum cukup" di alasan dan beri skor yang paling hati-hati.

Balas HANYA dengan JSON persis format ini, tanpa markdown:
{"skor": 0-100, "alasan": "maksimal 2 kalimat dengan bukti", "ringkasan": "maksimal 3 kalimat", "risiko": ["maksimal 3 poin"], "langkah": ["maksimal 3 langkah konkret"]}`;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function askClaude(facts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLAUDE_TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: "FAKTA PIPELINE SALES:\n" + JSON.stringify(facts) }],
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error("Claude API " + resp.status + ": " + errText.slice(0, 160));
    }
    const d = await resp.json();
    const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const a = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (a === -1 || e === -1) {
      throw new Error("respons AI tidak berbentuk JSON: " + (text || JSON.stringify(d.content || d.stop_reason || {})).slice(0, 200));
    }
    return { parsed: JSON.parse(text.slice(a, e + 1)), usage: d.usage || {} };
  } finally {
    clearTimeout(timer);
  }
}

function toSummary(p) {
  const ringkasan = String(p.ringkasan || "").trim();
  const risiko = (Array.isArray(p.risiko) ? p.risiko : []).map(String).slice(0, 3);
  const langkah = (Array.isArray(p.langkah) ? p.langkah : []).map(String).slice(0, 3);
  return [
    ringkasan,
    risiko.length ? "Risiko: " + risiko.join("; ") + "." : "",
    langkah.length ? "Langkah berikutnya: " + langkah.join("; ") + "." : "",
  ].filter(Boolean).join(" ");
}

function toScore(p) {
  const n = Math.round(Number(p.skor));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

async function logUsage(admin, orgId, userId, usage) {
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cost = (input * PRICE_IN + output * PRICE_OUT) / 1e6;
  const { error } = await admin.from("ai_usage").insert({
    feature: "member-memory-agent", user_id: userId, org_id: orgId, provider: "anthropic",
    model: MODEL, input_tokens: input, output_tokens: output, cost_usd: cost,
  });
  if (error) console.log("[member-memory-agent] catat ai_usage gagal:", error.message);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const result = { diproses: 0, dilewati: 0, gagal: 0, contoh_error: [] };
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || MAX_USERS_PER_RUN, MAX_USERS_PER_RUN);
  try {
    const { data: members, error } = await admin
      .from("member_memory_health").select("org_id, user_id, n").gte("n", MIN_LEADS).limit(limit);
    if (error) throw error;
    for (const m of members || []) {
      try {
        const { data: facts, error: factsErr } = await admin.rpc("member_facts", { p_org: m.org_id, p_user: m.user_id });
        if (factsErr) throw factsErr;
        const hash = await sha256Hex(JSON.stringify(facts));
        const { data: prev } = await admin.from("member_agent_context")
          .select("facts_hash").eq("org_id", m.org_id).eq("user_id", m.user_id).maybeSingle();
        if (prev?.facts_hash === hash) { result.dilewati++; continue; }
        const { parsed, usage } = await askClaude(facts);
        const { error: upErr } = await admin.from("member_agent_context").upsert({
          org_id: m.org_id, user_id: m.user_id, summary: toSummary(parsed), facts_hash: hash,
          ai_score: toScore(parsed), ai_reason: String(parsed.alasan || "").slice(0, 400),
          model: MODEL, updated_at: new Date().toISOString(),
        }, { onConflict: "org_id,user_id" });
        if (upErr) throw upErr;
        await logUsage(admin, m.org_id, m.user_id, usage);
        result.diproses++;
      } catch (e) {
        console.log("[member-memory-agent] gagal untuk", m.user_id, String(e));
        result.gagal++;
        if (result.contoh_error.length < 3) result.contoh_error.push(String(e?.message || e).slice(0, 300));
      }
    }
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.log("[member-memory-agent] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
