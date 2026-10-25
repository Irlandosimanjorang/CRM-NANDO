// Supabase Edge Function: weekly-garbage-sweep
// Dipicu cron 1x/minggu (Senin dini hari). Dua tugas beda level resiko,
// SENGAJA dipisah biar gak ada AI yang "nebak" terus ngehapus data bisnis
// tanpa sepengetahuan siapa pun:
//
// 1. AUTO-HAPUS - CUMA baris operasional/log yang emang udah gak ada
//    gunanya lagi (expired/dedup lama) ATAU organisasi yang BENERAN 0%
//    kosong (0 anggota DAN 0 data sama sekali). Nol resiko kehilangan data
//    bisnis nyata - tabel leads/deal_transactions/dst yang punya isi TIDAK
//    PERNAH disentuh di bagian ini.
// 2. LAPORAN DOANG - organisasi yang 0 anggota TAPI masih ada leads/deal/
//    visit/kompetitor di dalemnya (kejadian nyata: org "NANDO BAN", 10 Sep
//    2026 - orphan gara-gara redeem_invite_code mindahin org lama tanpa
//    ngehapus kalau masih ada data). Ini CUMA dilaporin ke Telegram, gak
//    ada yang dihapus otomatis - keputusan tetep di tangan manusia (Nando),
//    sama kayak filosofi approval-gate di app-nya sendiri.
//
// HISTORI (10 Sep 2026) - hasil tiap run disimpen ke garbage_sweep_runs
// biar keliatan juga di Command Center (AdminDashboard), gak cuma lewat
// Telegram doang.
//
// BUG FIX (11 Sep 2026, ketauan pas audit) - org 0-anggota-0-data langsung
// di-wipe SEGERA berapa pun umurnya. ensure_my_org() bikin baris organizations
// dulu, BARU insert organization_members sesudahnya (2 statement terpisah,
// bukan 1 transaksi atomik dari sudut pandang query count di sini) - kalau
// sweep ini kebetulan jalan PAS di antara dua insert itu (race jarang tapi
// mungkin, org baru + 0 data + 0 member sesaat), org yang baru aja dibikin
// pas onboarding bisa ke-wipe permanen. Sekarang WAJIB umurnya >=24 jam
// dulu baru boleh di-auto-wipe.
//
// === DATA HYGIENE FIX (16 Sep 2026, ketauan pas audit - sama kayak yang
// dibenerin di delete-my-account) ===
// wipeOrgCompletely dulu gak ngecek error tiap delete DAN gak nyentuh
// mcp_api_keys/org_memory/ai_drafts/pipeline_reviews/notifications. Resiko
// PII di sini jauh lebih kecil dari delete-my-account (fungsi ini CUMA
// jalan buat org yang udah dikonfirmasi 0 lead/deal/visit/kompetitor, jadi
// org_memory/pipeline_reviews kemungkinan besar emang kosong), tapi tetep
// dibenerin biar konsisten & gak ninggalin baris yatim piatu sama sekali.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_TELEGRAM_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const MIN_ORG_AGE_MS = 24 * 60 * 60 * 1000;

async function tgSend(text) {
  if (!ADMIN_TELEGRAM_CHAT_ID) { console.log("[weekly-garbage-sweep] ADMIN_TELEGRAM_CHAT_ID belum di-set, skip kirim alert."); return; }
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
  });
  if (!resp.ok) {
    const retryResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_CHAT_ID, text }),
    });
    if (!retryResp.ok) console.log("[weekly-garbage-sweep] gagal kirim telegram, retry juga gagal:", retryResp.status);
  }
}

async function del(admin, orgId, table) {
  const { error } = await admin.from(table).delete().eq(table === "organizations" ? "id" : "org_id", orgId);
  if (error) console.log(`[weekly-garbage-sweep] GAGAL hapus ${table} buat org ${orgId}:`, String(error));
}

async function wipeOrgCompletely(admin, orgId) {
  await del(admin, orgId, "progress_notes");
  await del(admin, orgId, "deal_transactions");
  await del(admin, orgId, "visit_checkins");
  await del(admin, orgId, "competitor_usages");
  await del(admin, orgId, "competitors");
  await del(admin, orgId, "leads");
  await del(admin, orgId, "stages");
  await del(admin, orgId, "lead_gen_runs");
  await del(admin, orgId, "generated_leads");
  await del(admin, orgId, "mcp_api_keys");
  await del(admin, orgId, "org_memory");
  await del(admin, orgId, "ai_drafts");
  await del(admin, orgId, "pipeline_reviews");
  await del(admin, orgId, "notifications");
  await del(admin, orgId, "organization_members");
  await del(admin, orgId, "organizations");
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const nowISO = new Date().toISOString();
    const days = (n) => new Date(Date.now() - n * 24 * 60 * 60000).toISOString();

    // ---- BAGIAN 1: AUTO-HAPUS - baris operasional/log kadaluarsa ----
    const counts = {};

    { const { count } = await admin.from("pending_actions").delete({ count: "exact" }).lt("expires_at", nowISO);
      counts.pending_actions = count || 0; }

    { const { count } = await admin.from("telegram_processed_updates").delete({ count: "exact" }).lt("processed_at", days(30));
      counts.telegram_processed_updates = count || 0; }

    { const { count } = await admin.from("link_attempts").delete({ count: "exact" }).lt("attempted_at", days(7));
      counts.link_attempts = count || 0; }

    { const { count } = await admin.from("link_codes").delete({ count: "exact" }).lt("expires_at", nowISO);
      counts.link_codes = count || 0; }

    // Approval yang UDAH DIPUTUSIN (bukan pending lagi) dan udah lewat 30
    // hari - histori lama, gak ada gunanya disimpen selamanya.
    { const { count } = await admin.from("approval_requests").delete({ count: "exact" }).neq("status", "pending").lt("requested_at", days(30));
      counts.approval_requests = count || 0; }

    // ---- BAGIAN 2: DETEKSI ORG ORPHAN (0 anggota) ----
    const [{ data: allOrgs }, { data: memberRows }] = await Promise.all([
      admin.from("organizations").select("id, name, owner_user_id, created_at"),
      admin.from("organization_members").select("org_id"),
    ]);
    const orgsWithMembers = new Set((memberRows || []).map((m) => m.org_id));
    const orphanOrgs = (allOrgs || []).filter((o) => !orgsWithMembers.has(o.id));

    let autoDeletedEmptyOrgs = 0;
    let skippedTooYoung = 0;
    const needsReview = [];

    for (const org of orphanOrgs) {
      const ageMs = Date.now() - new Date(org.created_at).getTime();
      if (ageMs < MIN_ORG_AGE_MS) {
        // Org ini masih terlalu baru buat dianggap "beneran orphan" - bisa aja
        // ini org yang lagi di tengah onboarding (organizations kebentuk
        // duluan, organization_members nyusul sepersekian detik kemudian).
        // Skip dulu, biarin sweep minggu depan yang mutusin kalau memang masih
        // orphan setelah 24 jam.
        skippedTooYoung++;
        continue;
      }

      const [leadsC, dealsC, visitsC, compsC] = await Promise.all([
        admin.from("leads").select("id", { count: "exact", head: true }).eq("org_id", org.id).is("deleted_at", null),
        admin.from("deal_transactions").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        admin.from("visit_checkins").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        admin.from("competitors").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      ]);
      const totalData = (leadsC.count || 0) + (dealsC.count || 0) + (visitsC.count || 0) + (compsC.count || 0);

      if (totalData === 0) {
        await wipeOrgCompletely(admin, org.id);
        autoDeletedEmptyOrgs++;
      } else {
        let ownerEmail = null;
        try {
          const { data } = await admin.auth.admin.getUserById(org.owner_user_id);
          ownerEmail = data?.user?.email || null;
        } catch (_) {}
        needsReview.push({ id: org.id, name: org.name, ownerEmail, leads: leadsC.count || 0, deals: dealsC.count || 0, visits: visitsC.count || 0, comps: compsC.count || 0 });
      }
    }

    // ---- SIMPEN HISTORI (buat Command Center) ----
    await admin.from("garbage_sweep_runs").insert({ counts, auto_deleted_empty_orgs: autoDeletedEmptyOrgs, needs_review: needsReview });

    // ---- LAPORAN TELEGRAM ----
    const autoLines = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `- ${k}: ${n}`);
    if (autoDeletedEmptyOrgs > 0) autoLines.push(`- organisasi kosong total (0 anggota, 0 data): ${autoDeletedEmptyOrgs}`);

    let msg = `🧹 *Weekly Garbage Sweep*\n\n`;
    msg += autoLines.length
      ? `*Otomatis dibersihin* (nol resiko data bisnis):\n${autoLines.join("\n")}\n\n`
      : `*Otomatis dibersihin:* gak ada sampah operasional minggu ini. \n\n`;

    if (skippedTooYoung > 0) {
      msg += `${skippedTooYoung} org orphan di-skip minggu ini (umurnya belum 24 jam, kemungkinan masih onboarding) - dicek ulang minggu depan.\n\n`;
    }

    if (needsReview.length) {
      msg += `⚠️ *Butuh dicek manual* - organisasi 0 anggota tapi MASIH ADA data (gak dihapus otomatis):\n`;
      for (const r of needsReview) {
        msg += `- *${r.name || "(tanpa nama)"}* (owner: ${r.ownerEmail || r.id}) - ${r.leads} lead, ${r.deals} deal, ${r.visits} visit, ${r.comps} kompetitor\n`;
      }
      msg += `\nCek manual sebelum diputusin dihapus apa enggak - bisa jadi data asli yang kesangkut.`;
    } else {
      msg += `Gak ada organisasi orphan yang butuh dicek manual minggu ini.`;
    }

    await tgSend(msg);

    return new Response(JSON.stringify({ ok: true, counts, autoDeletedEmptyOrgs, skippedTooYoung, needsReview: needsReview.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[weekly-garbage-sweep] fatal:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
