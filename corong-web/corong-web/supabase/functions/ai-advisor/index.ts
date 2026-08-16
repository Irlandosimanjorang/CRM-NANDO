// Supabase Edge Function: ai-advisor
// Deploy: supabase functions deploy ai-advisor
// Set secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Menerima leads (dari client, yang sudah auth), memanggil Claude API
// dengan API key yang aman di server (bukan di browser), balikin rekomendasi.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

function potential(c, stages) {
  const prioScore = { high: 3, medium: 2, low: 1, "": 0 };
  const idx = stages.findIndex((s) => s.key === c.stage_key);
  const stagePts = idx < 0 ? 0 : idx;
  const progressCount = c.progress_notes?.length || 0;
  return (prioScore[c.priority] || 0) * 4 + stagePts * 2 + Math.min(progressCount, 5) + (c.deal_value ? 1 : 0);
}

function daysSince(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

function parseArr(t) {
  let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("["); if (a !== -1) x = x.slice(a);
  const end = x.lastIndexOf("]");
  if (end !== -1) { try { return JSON.parse(x.slice(0, end + 1)); } catch (_) {} }
  const lastObj = x.lastIndexOf("}");
  if (lastObj !== -1) { try { return JSON.parse(x.slice(0, lastObj + 1) + "]"); } catch (_) {} }
  return [];
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const [{ data: stages }, { data: leads }] = await Promise.all([
      supabase.from("stages").select("*").order("position"),
      supabase.from("leads").select("*, progress_notes(id, note_date, text)"),
    ]);

    const wonKeys = (stages || []).filter((s) => s.type === "won").map((s) => s.key);
    const lostKeys = (stages || []).filter((s) => s.type === "lost").map((s) => s.key);
    const active = (leads || []).filter((c) => !wonKeys.includes(c.stage_key) && !lostKeys.includes(c.stage_key));
    const queue = [...active]
      .sort((a, b) => potential(b, stages) - potential(a, stages))
      .slice(0, 12);

    if (queue.length === 0) return new Response(JSON.stringify({ recs: [] }), { headers: { ...cors, "Content-Type": "application/json" } });

    const stageLabel = (key) => (stages || []).find((s) => s.key === key)?.label || key;
    const today = new Date().toISOString().slice(0, 10);
    const all = [];

    for (let i = 0; i < queue.length; i += 4) {
      const grp = queue.slice(i, i + 4);
      const payload = grp.map((c) => ({
        name: c.name, stage: stageLabel(c.stage_key), priority: c.priority || "—",
        days_since_contact: daysSince(c.last_contact) ?? "belum pernah",
        product: (c.product || "").slice(0, 60), current_next_action: (c.next_action || "").slice(0, 80),
        recent_progress: (c.progress_notes || []).slice(0, 3).map((p) => `${p.note_date}: ${(p.text || "").slice(0, 140)}`),
      }));
      const prompt = `Kamu adalah sales coach B2B yang tajam untuk sales industri PVC di Indonesia. Hari ini ${today}. Untuk SETIAP lead, baca tahap, prioritas, dan catatan progress-nya, lalu beri arahan praktis - spesifik ke lead itu, tanpa basa-basi umum.
Balas HANYA berupa JSON array, tanpa markdown. Tiap item persis:
{"name":"<nama persis>","assessment":"<2 kalimat: posisi lead ini sekarang & alasannya>","action":"<langkah paling penting berikutnya, 1 kalimat jelas>","steps":["<2-3 langkah konkret pendukung, tiap poin di bawah 12 kata>"],"urgency":"high|medium|low"}.
Ini lead-lead paling potensial (prioritas tinggi / tahap maju) - fokus ke cara mendorong mereka lebih dekat ke closing. Tulis dalam Bahasa Indonesia yang santai tapi profesional.
Leads:
${JSON.stringify(payload)}`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok) continue;
      const dat = await resp.json();
      const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const arr = parseArr(t);
      for (const r of arr) {
        const lead = grp.find((c) => c.name.toLowerCase() === String(r.name || "").toLowerCase())
          || grp.find((c) => c.name.toLowerCase().includes(String(r.name || "").toLowerCase()));
        if (lead) all.push({ id: lead.id, name: lead.name, assessment: r.assessment, action: r.action, steps: Array.isArray(r.steps) ? r.steps : [], urgency: r.urgency });
      }
    }

    const uRank = { high: 0, medium: 1, low: 2 };
    all.sort((a, b) => (uRank[a.urgency] ?? 3) - (uRank[b.urgency] ?? 3));
    const ranAt = new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    await supabase.from("advisor_runs").upsert({ user_id: userData.user.id, ran_at: ranAt, recs: all, updated_at: new Date().toISOString() });

    return new Response(JSON.stringify({ ranAt, recs: all }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
