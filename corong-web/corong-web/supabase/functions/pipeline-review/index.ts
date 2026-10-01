// Supabase Edge Function: pipeline-review
// "Pipeline Review (AI)" - OTOMATIS jalan 2x/bulan lewat cron (tanggal 1 &
// 16), BUKAN tombol on-demand (beda dari fitur AI lain di Nexto yang
// kebanyakan manual-trigger). Ngasih ringkasan kesehatan SELURUH pipeline
// (bukan per-lead kayak AI Advisor harian) - lead stuck, yang kelupaan
// next_action, tren lead baru/menang/kalah 14 hari terakhir, dan 2-3 lead
// yang paling perlu difokusin minggu ini.
//
// Khusus Professional ke atas. Dipanggil via x-cron-secret (sama kayak
// daily-digest), dukung ?force=true & ?user_id=<uuid> buat testing manual.
//
// === ORG MEMORY (11 Sep 2026) ===
// Bareng jadwal yang sama (2x/bulan), function ini SEKALIAN nyintesis
// "Org Memory" - satu ringkasan pengetahuan per organisasi (ideal customer
// profile, objection yang sering muncul + cara ngatasinnya, playbook yang
// kebukti berhasil) dari SEMUA histori deal menang/kalah org itu. Beda dari
// pipeline review (yang isinya kondisi SAAT INI), org_memory ini yang
// dibaca BARENG-BARENG sama fitur AI lain (Poin Diskusi, AI Advisor, dst)
// biar mereka "belajar" dari pola yang sama, bukan ngitung ulang sendiri-
// sendiri tiap dipanggil. Data buat ini ORG-WIDE (gak difilter per-role
// kayak stats pipeline) karena ini aset pengetahuan bersama org, dan cuma
// dihitung SEKALI per org per run (pake Set, independen dari cache
// pipeline review yang di-key per role).
//
// === MODEL (29 Sep 2026) === Sonnet 4.6 -> Sonnet 5.5 (lebih murah), tanpa
// "mikir di awal" (between_tools), effort medium.
//
// === BAHASA BAKU (1 Okt 2026) === Ringkasan dulu diminta "santai-
// profesional" -> sekarang bahasa Indonesia baku. Org memory (yang tampil di
// app & dipakai fitur AI lain) juga diminta bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const PERIOD_DAYS = 14;
const MIN_CLOSED_FOR_MEMORY = 5;
const MAX_CLOSED_IN_PROMPT = 25;

function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }
function lastProgressDate(c) {
  const notes = c.progress_notes || [];
  if (notes.length === 0) return null;
  return notes.reduce((latest, p) => (!latest || p.note_date > latest ? p.note_date : latest), null);
}

async function getAllUsers(admin) {
  let allUsers = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) { console.log("[pipeline-review] listUsers GAGAL", page, String(error)); break; }
    const batch = data?.users || [];
    allUsers = allUsers.concat(batch);
    if (batch.length < perPage) break;
    page++;
    if (page > 20) break;
  }
  return allUsers;
}

// ---- Statistik pipeline - rule-based, GRATIS (gak kena biaya AI) ----
function computeStats(active, allLeads, stagesArr) {
  const periodCutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const stuck = active
    .map((c) => {
      const dContact = daysSince(c.last_contact);
      const noteDate = lastProgressDate(c);
      const dNote = noteDate ? daysSince(noteDate) : null;
      const known = [dContact, dNote].filter((d) => d !== null);
      const daysStuck = known.length ? Math.min(...known) : null;
      return { ...c, _daysStuck: daysStuck };
    })
    .filter((c) => c._daysStuck === null || c._daysStuck > PERIOD_DAYS)
    .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0));

  const missingNextAction = active.filter((c) => !c.next_action || !c.next_action.trim()).length;
  const newLeads = allLeads.filter((c) => c.created_at >= periodCutoff).length;

  const wonKeys = stagesArr.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stagesArr.filter((s) => s.type === "lost").map((s) => s.key);
  const wonRecent = allLeads.filter((c) => wonKeys.includes(c.stage_key) && (c.deal_date || c.updated_at) >= periodCutoff).length;
  const lostRecent = allLeads.filter((c) => lostKeys.includes(c.stage_key) && c.updated_at >= periodCutoff).length;

  return {
    total_active: active.length,
    stuck_count: stuck.length,
    missing_next_action: missingNextAction,
    new_leads: newLeads,
    won_recent: wonRecent,
    lost_recent: lostRecent,
    stuck_list: stuck,
  };
}

async function callClaude(prompt, maxTokens, label) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: maxTokens, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) { console.log(`[pipeline-review] ${label} AI gagal`, resp.status); return null; }
  const dat = await resp.json();
  console.log(`[pipeline-review] ${label} USAGE`, JSON.stringify(dat.usage));
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let obj = {};
  const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); const e = x.lastIndexOf("}");
  if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }
  return obj;
}

async function generateReview(orgLabel, stats, focusCandidates) {
  const stuckSample = stats.stuck_list.slice(0, 8).map((c) => `${c.name}${c.deal_value ? ` (Rp${Number(c.deal_value).toLocaleString("id-ID")})` : ""} - ${c._daysStuck === null ? "belum pernah ada aktivitas" : `${c._daysStuck} hari gak ada progress`}`);
  const focusText = focusCandidates.map((c) => {
    const notes = (c.progress_notes || []).slice(-3).map((p) => `${p.note_date}: ${(p.text || "").slice(0, 150)}`);
    return `- ${c.name} (id: ${c.id}, deal_value: ${c.deal_value || 0}, tahap: ${c.stage_key})\n  Progress terakhir: ${notes.length ? notes.join(" | ") : "belum ada catatan"}`;
  }).join("\n");

  const prompt = `Kamu sales manager berpengalaman yang lagi bikin laporan kesehatan pipeline 2 mingguan buat timnya.

Statistik pipeline (${PERIOD_DAYS} hari terakhir):
- Total lead aktif: ${stats.total_active}
- Lead "stuck" (gak ada progress/kontak > ${PERIOD_DAYS} hari): ${stats.stuck_count}
- Lead aktif yang belum punya next_action tercatat: ${stats.missing_next_action}
- Lead baru masuk: ${stats.new_leads}
- Deal closing (menang): ${stats.won_recent}
- Deal gagal (kalah): ${stats.lost_recent}

Contoh lead yang stuck (urut deal_value tertinggi):
${stuckSample.join("\n") || "(gak ada)"}

Kandidat lead buat difokusin minggu ini (deal_value tertinggi yang masih aktif):
${focusText || "(gak ada)"}

Tugas kamu:
1. Tulis ringkasan (summary) 2-4 kalimat dalam Bahasa Indonesia baku yang profesional - kasih penilaian jujur ("sehat"/"perlu perhatian"/dst) berdasar angka di atas, bukan generik.
2. Dari daftar "kandidat difokusin", pilih maks 3 yang PALING penting buat ditindaklanjuti minggu ini, kasih alasan 1 kalimat SPESIFIK per lead berdasar progress terakhirnya (bukan cuma "deal value tinggi"), juga dalam bahasa baku.

JANGAN pakai bahasa gaul (misal "gak", "udah", "aja", "banget").

Balas HANYA JSON, tanpa markdown: {"summary":"...","focus":[{"lead_id":"...","reason":"..."}]}`;

  const obj = await callClaude(prompt, 1000, "review");
  if (!obj) return null;
  return {
    summary: obj.summary || "",
    focus: Array.isArray(obj.focus) ? obj.focus.filter((f) => f && f.lead_id).slice(0, 3) : [],
  };
}

async function runReviewForOrg(admin, orgId, userId, role) {
  const [{ data: stages }, leadsRes] = await Promise.all([
    admin.from("stages").select("*").eq("org_id", orgId).order("position"),
    (() => {
      let q = admin.from("leads").select("*, progress_notes(id, note_date, text)").eq("org_id", orgId).is("deleted_at", null);
      if (role === "sales_rep") q = q.eq("assigned_to", userId);
      return q;
    })(),
  ]);
  const stagesArr = stages || [];
  const leadsArr = leadsRes.data || [];
  const wonKeys = stagesArr.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stagesArr.filter((s) => s.type === "lost").map((s) => s.key);
  const active = leadsArr.filter((c) => !wonKeys.includes(c.stage_key) && !lostKeys.includes(c.stage_key));

  const stats = computeStats(active, leadsArr, stagesArr);
  if (active.length === 0) return null; // gak ada lead sama sekali, gak perlu review

  const focusCandidates = [...active].sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0)).slice(0, 5);
  const review = await generateReview(orgId, stats, focusCandidates);
  if (!review) return null;

  const { stuck_list, ...statsToStore } = stats; // stuck_list bisa gede, gak perlu disimpen full
  return {
    summary: review.summary,
    stats: { ...statsToStore, stuck_sample: stuck_list.slice(0, 8).map((c) => ({ id: c.id, name: c.name, days_stuck: c._daysStuck, deal_value: c.deal_value || 0 })) },
    focus_leads: review.focus.map((f) => {
      const lead = focusCandidates.find((c) => c.id === f.lead_id);
      return { lead_id: f.lead_id, name: lead?.name || "", reason: f.reason };
    }),
  };
}

// ---- ORG MEMORY - sintesis pengetahuan dari SELURUH histori deal org
// (org-wide, gak difilter role), dipake bareng-bareng sama fitur AI lain.
async function callOrgMemoryAi(closedSample) {
  const text = closedSample.map((c) => {
    const notes = (c.progress_notes || []).slice(-4).map((p) => `${p.note_date}: ${(p.text || "").slice(0, 180)}`);
    return `[${c.outcome_result.toUpperCase()}] ${c.name} (${c.category || "-"}, produk: ${c.product || "-"})${c.outcome?.reason_category ? `, alasan tercatat: ${c.outcome.reason_category}` : ""}\nProgress: ${notes.length ? notes.join(" | ") : "(gak ada catatan)"}`;
  }).join("\n\n");

  const prompt = `Kamu sales coach senior yang lagi nyusun "buku pegangan" (playbook) buat tim sales, berdasar histori ${closedSample.length} deal yang UDAH CLOSE (menang maupun kalah) di bisnis ini.

Histori deal:
${text}

Tugas kamu, sintesis pola dari SEMUA data di atas (bukan cuma 1-2 contoh):
1. summary: 1-2 kalimat overview pola utama yang kamu liat (kenapa biasanya menang, kenapa biasanya kalah).
2. ideal_customer_profile: 2-3 kalimat ciri-ciri customer yang PALING SERING closing/menang di sini (skala usaha, kebutuhan, sinyal yang muncul di awal) - biar tim bisa kenalin calon customer yang mirip lebih cepat.
3. common_objections: array MAKS 4 objection/keberatan yang PALING SERING muncul di histori (baik yang berujung menang maupun kalah), tiap item {"objection":"...", "how_to_handle":"cara ngatasin yang KEBUKTI berhasil dari histori menang, atau saran kalau belum ada contoh sukses"}.
4. winning_playbook: array MAKS 5 taktik/kalimat konkret yang KEBUKTI muncul di deal-deal yang MENANG (bukan generic sales tips) - tiap item 1 kalimat pendek actionable.

JANGAN NGARANG pola yang gak didukung data di atas - kalau sampelnya kesikit buat suatu kesimpulan, boleh lebih hati-hati/general di poin itu aja.
Semua teks ditampilkan ke tim sales - tulis dalam Bahasa Indonesia baku yang profesional (tanpa bahasa gaul).

Balas HANYA JSON, tanpa markdown: {"summary":"...","ideal_customer_profile":"...","common_objections":[{"objection":"...","how_to_handle":"..."}],"winning_playbook":["..."]}`;

  const obj = await callClaude(prompt, 1500, "org-memory");
  if (!obj) return null;
  return {
    summary: obj.summary || "",
    ideal_customer_profile: obj.ideal_customer_profile || "",
    common_objections: Array.isArray(obj.common_objections) ? obj.common_objections.slice(0, 4) : [],
    winning_playbook: Array.isArray(obj.winning_playbook) ? obj.winning_playbook.slice(0, 5) : [],
  };
}

async function refreshOrgMemory(admin, orgId) {
  const [{ data: stages }, { data: leadsArr }] = await Promise.all([
    admin.from("stages").select("key, type").eq("org_id", orgId),
    admin.from("leads").select("name, category, product, stage_key, outcome, progress_notes(note_date, text)").eq("org_id", orgId).is("deleted_at", null),
  ]);
  const stagesArr = stages || [];
  const wonKeys = stagesArr.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stagesArr.filter((s) => s.type === "lost").map((s) => s.key);
  const closed = (leadsArr || [])
    .filter((c) => wonKeys.includes(c.stage_key) || lostKeys.includes(c.stage_key))
    .map((c) => ({ ...c, outcome_result: wonKeys.includes(c.stage_key) ? "won" : "lost" }));

  if (closed.length < MIN_CLOSED_FOR_MEMORY) {
    console.log(`[pipeline-review] org ${orgId} - cuma ${closed.length} deal closed, skip org memory (min ${MIN_CLOSED_FOR_MEMORY})`);
    return;
  }

  // Ambil sampel campur menang+kalah, prioritasin yang punya progress notes
  // (lebih berguna buat AI belajar) - dibatesin biar prompt gak bengkak.
  const sample = [...closed]
    .sort((a, b) => (b.progress_notes?.length || 0) - (a.progress_notes?.length || 0))
    .slice(0, MAX_CLOSED_IN_PROMPT);

  const memory = await callOrgMemoryAi(sample);
  if (!memory) return;

  await admin.from("org_memory").upsert({
    org_id: orgId, based_on_closed_leads: closed.length,
    summary: memory.summary, ideal_customer_profile: memory.ideal_customer_profile,
    common_objections: memory.common_objections, winning_playbook: memory.winning_playbook,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  console.log(`[pipeline-review] org ${orgId} - org_memory diperbarui (${closed.length} deal closed)`);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const reqUrl = new URL(req.url);
  const onlyUserId = reqUrl.searchParams.get("user_id") || null;

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let allUsers;
    if (onlyUserId) {
      const { data } = await admin.auth.admin.getUserById(onlyUserId);
      if (!data?.user) return new Response(JSON.stringify({ error: "user_id tidak ditemukan" }), { status: 404 });
      allUsers = [data.user];
    } else {
      allUsers = await getAllUsers(admin);
    }

    const orgWideCache = new Map();
    const memoryProcessedOrgs = new Set();
    const results = [];

    for (const u of allUsers) {
      try {
        const { data: memberRow } = await admin.from("organization_members").select("org_id, role").eq("user_id", u.id).limit(1).maybeSingle();
        if (!memberRow) continue;

        const [{ data: settingsRow }, { data: orgRow }] = await Promise.all([
          admin.from("settings").select("plan").eq("user_id", u.id).maybeSingle(),
          admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle(),
        ]);
        const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
        const myPlanLevel = orgRow?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
        if (myPlanLevel < 2) continue; // Professional+ doang

        // Org memory disegarkan SEKALI per org per run, independen dari role.
        if (!memoryProcessedOrgs.has(memberRow.org_id)) {
          memoryProcessedOrgs.add(memberRow.org_id);
          await refreshOrgMemory(admin, memberRow.org_id).catch((e) => console.log("[pipeline-review] refreshOrgMemory gagal untuk", memberRow.org_id, String(e)));
        }

        let result;
        const cacheKey = `${memberRow.org_id}:${memberRow.role}`;
        if (memberRow.role !== "sales_rep" && orgWideCache.has(cacheKey)) {
          result = orgWideCache.get(cacheKey);
        } else {
          result = await runReviewForOrg(admin, memberRow.org_id, u.id, memberRow.role);
          if (memberRow.role !== "sales_rep") orgWideCache.set(cacheKey, result);
        }
        if (!result) { console.log("[pipeline-review] skip, no result for", u.id); continue; }

        await admin.from("pipeline_reviews").insert({
          user_id: u.id, org_id: memberRow.org_id, period_days: PERIOD_DAYS,
          summary: result.summary, stats: result.stats, focus_leads: result.focus_leads,
        });

        await admin.from("notifications").insert({
          user_id: u.id, org_id: memberRow.org_id, type: "pipeline_review",
          title: "Pipeline Review 2 mingguan siap dilihat",
          body: result.summary.slice(0, 180),
          link_tab: "dashboard",
        });

        results.push({ user: u.email, ok: true });
      } catch (userErr) {
        console.log("[pipeline-review] EXCEPTION untuk", u.id, String(userErr));
        results.push({ user: u.email, error: String(userErr) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[pipeline-review] FATAL", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
