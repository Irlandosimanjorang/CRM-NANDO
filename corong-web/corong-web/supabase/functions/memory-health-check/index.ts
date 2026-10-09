// Supabase Edge Function: memory-health-check
// Dipanggil oleh Cron Job Supabase SENDIRI (terpisah dari daily-digest). Menilai "kualitas memori" (riwayat progress notes)
// tiap organisasi pakai AI (Claude), lalu menyimpan skornya di org_memory_health untuk kartu "Kedalaman Riwayat Lead".
// Jalan 1x per ORG, panggilan Claude-nya kecil (max_tokens 300, input cuma ringkasan angka).
// Model: Sonnet 5.5, thinking between_tools (tanpa "mikir di awal").
//
// PENCATATAN BIAYA (10 Okt 2026, permintaan Nando): tiap panggilan Claude sekarang dicatat ke ai_usage
// (feature "memory-health-check", org_id = organisasi yang dinilai) supaya masuk hitungan Cash Flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayOfWeek(d = new Date()) {
  return new Date(d.getTime() + WIB_OFFSET_MS).getUTCDay();
}

function daysSince(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

// Harga per 1 juta token Sonnet 5.5: [input, output, tulis cache, baca cache]. Gagal mencatat TIDAK boleh mengganggu proses.
const SONNET_PRICE = [2, 10, 2.5, 0.2];
async function logUsage(admin, orgId, model, u) {
  try {
    const row = {
      feature: "memory-health-check", user_id: null, org_id: orgId || null, provider: "anthropic", model: model || "claude-sonnet-5-5",
      input_tokens: u?.input_tokens || 0, output_tokens: u?.output_tokens || 0,
      cache_write_tokens: u?.cache_creation_input_tokens || 0, cache_read_tokens: u?.cache_read_input_tokens || 0,
    };
    row.cost_usd = (row.input_tokens * SONNET_PRICE[0] + row.output_tokens * SONNET_PRICE[1] + row.cache_write_tokens * SONNET_PRICE[2] + row.cache_read_tokens * SONNET_PRICE[3]) / 1e6;
    const { error } = await admin.from("ai_usage").insert(row);
    if (error) console.log("[ai-usage] simpan gagal:", error.message);
  } catch (e) {
    console.log("[ai-usage] exception:", String(e));
  }
}

// AI self-assessment - Claude yang beneran nilai, bukan rata-rata rumus.
async function assessMemoryHealth(active, admin, orgId) {
  if (!ANTHROPIC_API_KEY || active.length === 0) return null;
  const noteCount = (c) => (c.progress_notes || []).length;
  const isStale = (c) => {
    if (!c.last_contact) return true;
    return (daysSince(c.last_contact) ?? 999) >= 14;
  };
  const n = active.length;
  const totalNotes = active.reduce((sum, c) => sum + noteCount(c), 0);
  const emptyCount = active.filter((c) => noteCount(c) === 0).length;
  const richCount = active.filter((c) => noteCount(c) >= 3).length;
  const staleCount = active.filter(isStale).length;

  const prompt = `Kamu asisten CRM yang menilai kualitas "memori" (riwayat progress notes) yang dimiliki satu tim sales di CRM Nexto.

Ringkasan lead AKTIF di CRM ini hari ini:
- Total lead aktif: ${n}
- Total progress notes tercatat: ${totalNotes} (rata-rata ${(totalNotes / n).toFixed(1)}/lead)
- Lead aktif TANPA progress notes sama sekali: ${emptyCount} (${Math.round((emptyCount / n) * 100)}%)
- Lead aktif dengan riwayat kaya (3+ notes): ${richCount} (${Math.round((richCount / n) * 100)}%)
- Lead aktif yang belum di-update 14+ hari: ${staleCount} (${Math.round((staleCount / n) * 100)}%)

Nilai seberapa SEHAT kualitas memori/riwayat CRM ini secara keseluruhan (0-100). Pertimbangkan cakupan, kedalaman, DAN kesegaran sekaligus sebagai satu penilaian menyeluruh - bukan cuma rata-rata matematis angka di atas, tapi pertimbangan kamu sebagai asisten yang paham konteks CRM sales (misal: tim kecil yang baru mulai boleh dapet skor cukup meski cakupan belum penuh, tapi banyak lead yang lama nganggur tanpa update pantas dapet skor rendah).

Balas HANYA JSON, tanpa markdown: {"score": <angka 0-100>, "label": "<1-3 kata status, misal 'Sehat', 'Perlu Perhatian', 'Kritis'>"}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 300, thinking: { type: "between_tools" }, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) { console.log("[memory-health] api error", resp.status, (await resp.text()).slice(0, 300)); return null; }
    const dat = await resp.json();
    console.log("[memory-health] USAGE", JSON.stringify(dat.usage));
    await logUsage(admin, orgId, dat.model, dat.usage);
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a === -1 || e === -1) return null;
    const obj = JSON.parse(x.slice(a, e + 1));
    const score = Math.max(0, Math.min(100, Math.round(Number(obj.score))));
    if (isNaN(score)) return null;
    return { score, label: String(obj.label || "").slice(0, 30) };
  } catch (err) {
    console.log("[memory-health] EXCEPTION", String(err));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const reqUrl = new URL(req.url);
  const forceRun = reqUrl.searchParams.get("force") === "true";
  const onlyOrgId = reqUrl.searchParams.get("org_id") || null;

  // Weekday-only, sama pola kayak fitur AI otomatis lain (aktivitas sales weekend minim) - bisa dilewatin pas testing.
  if (!forceRun) {
    const dow = wibDayOfWeek();
    if (dow === 0 || dow === 6) {
      return new Response(JSON.stringify({ ok: true, skipped: "weekend" }), { headers: { "Content-Type": "application/json" } });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = [];

  try {
    let orgsQuery = admin.from("organizations").select("id, plan, owner_user_id");
    if (onlyOrgId) orgsQuery = orgsQuery.eq("id", onlyOrgId);
    const { data: orgs, error: orgsErr } = await orgsQuery;
    if (orgsErr) throw orgsErr;

    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };

    for (const org of orgs || []) {
      try {
        // Fitur berbayar (sama kayak Daily Digest/AI Advisor lain) - Free skip.
        let planLevel = 0;
        if (org.plan === "enterprise") planLevel = 2;
        else if (org.owner_user_id) {
          const { data: ownerSettings } = await admin.from("settings").select("plan").eq("user_id", org.owner_user_id).maybeSingle();
          planLevel = PLAN_LEVEL[ownerSettings?.plan] ?? 0;
        }
        if (planLevel < 1) { continue; }

        const { data: stages } = await admin.from("stages").select("key, type").eq("org_id", org.id);
        const wonKeys = (stages || []).filter((s) => s.type === "won").map((s) => s.key);
        const lostKeys = (stages || []).filter((s) => s.type === "lost").map((s) => s.key);

        const { data: leadsArr, error: leadsErr } = await admin
          .from("leads")
          .select("stage_key, last_contact, progress_notes(id)")
          .eq("org_id", org.id)
          .is("deleted_at", null);
        if (leadsErr) throw leadsErr;

        const active = (leadsArr || []).filter((l) => !wonKeys.includes(l.stage_key) && !lostKeys.includes(l.stage_key));
        if (active.length === 0) { continue; }

        const result = await assessMemoryHealth(active, admin, org.id);
        if (!result) { results.push({ org: org.id, error: "assess failed" }); continue; }

        await admin.from("org_memory_health").upsert(
          { org_id: org.id, score: result.score, label: result.label, computed_at: new Date().toISOString() },
          { onConflict: "org_id" }
        );
        results.push({ org: org.id, score: result.score, label: result.label });
      } catch (orgErr) {
        console.log("[memory-health] EXCEPTION for org", org.id, String(orgErr));
        results.push({ org: org.id, error: String(orgErr) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[memory-health] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
