// Supabase Edge Function: health-check
// Jalan OTOMATIS via cron tiap beberapa jam. Ngecek beberapa sinyal kesehatan
// sistem, dan kalau nemu yang mencurigakan, AI nulis laporan jelas & kirim
// ke Telegram admin (Nando). PENTING: ini MURNI monitoring & notifikasi -
// GAK ADA satupun perbaikan yang dieksekusi otomatis. Manusia yang cek &
// benerin manual. Ini keputusan sengaja, bukan keterbatasan.
//
// (Riwayat perubahan lama dipangkas di komentar ini - liat versi sebelumnya
// buat detail lengkap.)
//
// === USAGE LOGGING (15 Sep 2026) ===
// Ditambahin console.log token usage dari respons Claude di summarizeIssues.
//
// === PANJANG PESAN (15 Sep 2026, permintaan Nando) ===
// Maks 15 baris DAN maks 3000 karakter, max_tokens 1100 buat headroom.
//
// === WIB DAY-CHECK FIX (17 Sep 2026, ketauan pas audit) ===
// checkDailyDigestRan() ngecek weekend pake wibDayOfWeek(), bukan hari UTC.
//
// === UJI SIMPAN DATA + ERROR DARI APP (28 Sep 2026) ===
//  - checkWritePathSelftest: manggil RPC run_write_path_selftest() (canary
//    yang jalanin jalur simpan kritis di transaksi yang SELALU di-rollback),
//    + baca hasil canary RLS (canary_results, diisi cron nexto-rls-canary).
//  - checkClientErrors: nge-baca client_error_log & ngabarin kalau berulang.
// Plus mode ?only=canary (cron nexto-write-canary tiap 2 jam).
//
// === RAKA DIRAPIIN (30 Sep 2026, hasil audit) ===
// - Chat bot Telegram (NEXA) udah pensiun, diganti NEX Pro. Pengecekan yang
//   cuma relevan buat bot chat dibuang. TELEGRAM_BOT_TOKEN TETEP dicek -
//   bot-nya masih dipake buat ngirim alert RAKA ini ke HP Nando.
// - Model laporan Sonnet 4.6 -> Sonnet 5.5, tanpa mikir di awal.
// - Cron mingguan nexto-weekly-team-report (laporan team tiap Senin) masuk
//   daftar batas per job (8 hari) biar gak alarm palsu.
//
// === PERINGATAN BIAYA & LIMIT AI (6 Okt 2026, permintaan Nando) ===
// Cek limit AI dulu pakai angka lama & bulan kalender (sudah gak sesuai).
// Sekarang computeAiUsageSnapshot() baca RPC admin_ai_usage_report() (sumber
// yang sama dengan kartu BIAYA AI di Command Center: limit paket terbaru &
// siklus langganan) dan ngabarin lewat Telegram bila:
//   - akun mencapai >= 85% dari total limit AI paketnya (sekali per siklus),
//   - pemakaian satu fitur MELEBIHI limit (harusnya mustahil = penjaga bocor),
//   - biaya satu akun >= $5 dalam 24 jam (sekali per hari),
//   - biaya seluruh platform >= $25 dalam 24 jam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_TELEGRAM_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function tgSend(text) {
  if (!ADMIN_TELEGRAM_CHAT_ID) { console.log("[health-check] ADMIN_TELEGRAM_CHAT_ID belum di-set, skip kirim alert."); return; }
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    console.log("[health-check] tgSend GAGAL (versi Markdown):", resp.status, errBody.slice(0, 300));
    const retryResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_CHAT_ID, text }),
    });
    if (!retryResp.ok) {
      const retryErrBody = await retryResp.text().catch(() => "");
      console.log("[health-check] tgSend GAGAL JUGA (versi polos tanpa format):", retryResp.status, retryErrBody.slice(0, 300));
    } else {
      console.log("[health-check] tgSend berhasil di percobaan ke-2 (tanpa format).");
    }
  }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

const HEALTHCHECK_WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayOfWeek(d = new Date()) {
  return new Date(d.getTime() + HEALTHCHECK_WIB_OFFSET_MS).getUTCDay();
}

async function checkDailyDigestRan(admin) {
  const day = wibDayOfWeek();
  if (day === 0 || day === 6) return null;
  const hourWIB = (new Date().getUTCHours() + 7) % 24;
  if (hourWIB < 9) return null;
  const { count, error } = await admin.from("advisor_runs").select("id", { count: "exact", head: true }).gte("updated_at", `${todayISO()}T00:00:00Z`);
  if (error) { console.log("[health-check] checkDailyDigestRan query GAGAL (bukan berarti digest beneran belum jalan):", String(error)); return null; }
  if ((count ?? 0) === 0) {
    return "Daily digest belum jalan hari ini padahal udah lewat jam 9 pagi WIB. Kemungkinan cron job daily-digest gagal atau belum ke-trigger.";
  }
  return null;
}

async function checkEmbeddingBacklog(admin) {
  const { data: count, error } = await admin.rpc("count_embedding_backlog", { hours_back: 24 });
  if (error) { console.log("[health-check] checkEmbeddingBacklog query gagal:", String(error)); return null; }
  if ((count ?? 0) >= 20) {
    return `Ada ${count} progress notes (user Standard ke atas) dari 24 jam terakhir yang belum punya embedding. Kemungkinan trigger otomatis embed-progress-note atau secret Vault-nya bermasalah.`;
  }
  return null;
}

async function checkDatabaseSize(admin) {
  const { data, error } = await admin.rpc("get_database_size_mb");
  if (error || data == null) return null;
  const usedMb = Number(data);
  const limitMb = 500;
  const pct = Math.round((usedMb / limitMb) * 100);
  if (pct >= 80) {
    return `Database udah kepake ${usedMb}MB dari limit 500MB (${pct}%) di plan Free Supabase. Mendekati batas - waktunya mikirin upgrade ke Pro ($25/bulan) sebelum kena masalah.`;
  }
  return null;
}

async function checkLeadsRowCount(admin) {
  const { data, error } = await admin.rpc("get_leads_row_stats");
  if (error) { console.log("[health-check] checkLeadsRowCount gagal:", String(error)); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  const totalLeads = Number(row?.total_leads ?? 0);
  const maxOrgLeads = Number(row?.max_org_leads ?? 0);
  const PLATFORM_WARN = 50000;
  const ORG_WARN = 2000;
  if (totalLeads >= PLATFORM_WARN) {
    return `Total lead se-platform (semua organisasi digabung) udah ${totalLeads} baris. Di skala ini, query yang gak lewat index yang pas bisa mulai berat - worth double-check index org_id di tabel leads/deal_transactions/progress_notes masih ada & kepake (lihat Database -> Indexes).`;
  }
  if (maxOrgLeads >= ORG_WARN) {
    return `Ada 1 organisasi yang lead-nya udah ${maxOrgLeads} baris. Tab Leads di web masih narik SEMUA lead organisasi itu sekaligus tiap dibuka (belum ada pagination per-halaman), jadi mulai dari sini bisa kerasa makin lambat buat mereka. Worth mulai rencanain pagination di UI Leads.`;
  }
  return null;
}

async function checkSlowQueries(admin) {
  const { data, error } = await admin.rpc("get_slow_queries", { threshold_ms: 300, min_calls: 5 });
  if (error) { console.log("[health-check] checkSlowQueries gagal:", String(error)); return null; }
  const rows = data || [];
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.query_snippet.replace(/\s+/g, " ").trim()}..." (${r.calls}x, rata-rata ${r.mean_exec_ms}ms, terlama ${r.max_exec_ms}ms)`).join("; ");
    return `Ada query ke database yang keliatan LAMBAT (rata-rata di atas 300ms, udah dipanggil berkali-kali bukan cuma kebetulan sekali lambat): ${list}. Kemungkinan butuh index tambahan atau query-nya perlu dioptimasi - cek Database -> Query Performance di Supabase Dashboard buat detail lengkapnya.`;
  }
  return null;
}

async function checkUnindexedForeignKeys(admin) {
  const { data, error } = await admin.rpc("check_unindexed_foreign_keys");
  if (error) { console.log("[health-check] checkUnindexedForeignKeys gagal:", String(error)); return null; }
  const rows = data || [];
  if (rows.length > 0) {
    const list = rows.map((r) => `${r.table_name}.${r.column_name}`).join(", ");
    return `Ada ${rows.length} kolom foreign key yang BELUM punya index: ${list}. Tanpa index, JOIN/delete cascade lewat kolom ini bakal sequential scan begitu tabelnya gede - worth tambahin index sekarang selagi datanya masih kecil (murah & aman, gak butuh downtime).`;
  }
  return null;
}

async function checkMissingSecrets() {
  const required = {
    ANTHROPIC_API_KEY, OPENAI_API_KEY, RESEND_API_KEY, TELEGRAM_BOT_TOKEN,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return `Secret berikut KOSONG di project: ${missing.join(", ")}. Fitur yang butuh ini bakal gagal total sampai secret-nya diisi lagi di Edge Functions -> Secrets.`;
  }
  return null;
}

async function checkTelegramBotToken() {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    if (!resp.ok) return "Bot Telegram gak bisa diverifikasi - TELEGRAM_BOT_TOKEN kemungkinan udah gak valid/ke-revoke. Alert RAKA ke HP admin bakal berhenti total kalau ini beneran kejadian.";
    const dat = await resp.json();
    if (!dat.ok) return "Bot Telegram merespons tapi statusnya gak OK - cek ulang TELEGRAM_BOT_TOKEN (dipake buat ngirim alert RAKA).";
    return null;
  } catch (_) {
    return "Gagal ngecek status bot Telegram (bisa jaringan sementara, atau token bermasalah - worth dicek lagi nanti).";
  }
}

async function checkGcalSyncGaps(admin) {
  const { data: connectedUsers, error: e1 } = await admin.from("google_calendar_links").select("user_id");
  if (e1) { console.log("[health-check] checkGcalSyncGaps query 1 gagal:", String(e1)); return null; }
  const userIds = (connectedUsers || []).map((u) => u.user_id);
  if (userIds.length === 0) return null;
  const today = todayISO();
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const { count, error } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .in("assigned_to", userIds)
    .is("gcal_visit_event_id", null)
    .not("visit_date", "is", null)
    .gte("visit_date", today)
    .lte("visit_date", in3Days);
  if (error) { console.log("[health-check] checkGcalSyncGaps query 2 gagal:", String(error)); return null; }
  if ((count ?? 0) >= 3) {
    return `Ada ${count} jadwal visit dalam 3 hari ke depan (dari user yang udah connect Google Calendar) yang belum ke-sync ke Calendar mereka. Kemungkinan sinkronisasi gagal diam-diam.`;
  }
  return null;
}

async function checkBrokenOrgSetup(admin) {
  const { data: orgs, error: e1 } = await admin.from("organizations").select("id, name");
  if (e1) { console.log("[health-check] checkBrokenOrgSetup query 1 gagal:", String(e1)); return null; }
  if (!orgs || orgs.length === 0) return null;
  const { data: stagesData, error: e2 } = await admin.from("stages").select("org_id");
  if (e2) { console.log("[health-check] checkBrokenOrgSetup query 2 gagal:", String(e2)); return null; }
  const orgsWithStages = new Set((stagesData || []).map((s) => s.org_id));
  const broken = orgs.filter((o) => !orgsWithStages.has(o.id));
  if (broken.length > 0) {
    const names = broken.slice(0, 5).map((o) => o.name).join(", ");
    return `Ada ${broken.length} organisasi TANPA tahap pipeline sama sekali (${names}) - pipeline mereka gak akan berfungsi. Kemungkinan onboarding gagal di tengah jalan.`;
  }
  return null;
}

async function checkDuplicateOrgMembership(admin) {
  const { data, error } = await admin.from("organization_members").select("user_id");
  if (error) { console.log("[health-check] checkDuplicateOrgMembership gagal:", String(error)); return null; }
  const counts = {};
  for (const row of data || []) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
  const dupes = Object.entries(counts).filter(([, c]) => c > 1);
  if (dupes.length > 0) {
    const list = dupes.map(([uid, c]) => `${uid.slice(0, 8)} (${c}x)`).join(", ");
    return `Ada ${dupes.length} akun yang punya LEBIH DARI 1 organisasi sekaligus: ${list}. Ini harusnya udah gak mungkin kejadian lagi (ada UNIQUE constraint di organization_members.user_id sejak 10 Sep 2026) - kalau tetep muncul, kemungkinan ada query manual yang bypass constraint-nya. Cek tabel organization_members, tentuin org mana yang bener buat tiap akun yang kena, hapus sisanya.`;
  }
  return null;
}

async function checkResendDomain() {
  if (!RESEND_API_KEY) return null;
  try {
    const resp = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
    if (!resp.ok) return null;
    const dat = await resp.json();
    const domains = dat.data || [];
    const nextoDomain = domains.find((d) => d.name && d.name.includes("nexto"));
    if (nextoDomain && nextoDomain.status !== "verified") {
      return `Domain email "${nextoDomain.name}" di Resend statusnya "${nextoDomain.status}" (belum terverifikasi) - email masih kekirim dari alamat default resend.dev, bukan domain sendiri.`;
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function checkRLSDisabled(admin) {
  try {
    const { data, error } = await admin.rpc("check_tables_without_rls");
    if (error) { console.log("[health-check] gagal cek RLS:", String(error)); return null; }
    const tables = (data || []).map((r) => r.tablename);
    if (tables.length > 0) {
      return `URGENT - tabel berikut RLS-nya MATI (gak ada perlindungan sama sekali): ${tables.join(", ")}. Ini artinya SIAPAPUN yang punya ANON_KEY publik bisa baca/tulis tabel ini langsung tanpa filter apapun. Cek Database -> Tables -> nyalain lagi RLS-nya SEKARANG.`;
    }
    return null;
  } catch (e) {
    console.log("[health-check] EXCEPTION cek RLS:", String(e));
    return null;
  }
}

async function checkAuditLogDeleteSpike(admin) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60000).toISOString();
    const { count, error } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "DELETE").gte("created_at", oneHourAgo);
    if (error) return null;
    if ((count ?? 0) >= 10) {
      return `Ada ${count} aksi HAPUS (lead/kompetitor/dst) dalam 1 jam terakhir - jumlah ini di luar kebiasaan normal. Kemungkinan ada akun yang kecolongan, atau ada yang gak sengaja hapus banyak data sekaligus. Cek tabel audit_log buat detail siapa & apa yang dihapus.`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function checkPgNetErrors(admin) {
  const { data, error } = await admin.rpc("get_pg_net_error_count", { hours_back: 6 });
  if (error) { console.log("[health-check] checkPgNetErrors gagal:", String(error)); return null; }
  if ((data ?? 0) >= 3) {
    return `Ada ${data} panggilan HTTP otomatis (cron job atau database webhook) yang GAGAL (status error atau gak dapet respons) dalam 6 jam terakhir. Kemungkinan ada cron/webhook yang error diam-diam - cek Database -> Extensions -> pg_net atau log tiap edge function satu-satu buat cari yang gagal.`;
  }
  return null;
}

// Batas "kelamaan gak jalan" PER JOB (28 Sep 2026): angka di sini = jarak
// antar-jadwal terpanjang + margin. Job baru yang gak ada di daftar tetep
// pake default 50 jam.
const CRON_MAX_HOURS_DEFAULT = 50;
const CRON_MAX_HOURS = {
  "nexto-pipeline-review": 17 * 24,
  "nexto-weekly-garbage-sweep": 8 * 24,
  "nexto-weekly-team-report": 8 * 24,
};

async function checkCronJobsHealthy(admin) {
  const { data, error } = await admin.rpc("get_cron_job_health");
  if (error) { console.log("[health-check] checkCronJobsHealthy gagal:", String(error)); return null; }
  const jobs = data || [];
  const problems = jobs.filter((j) => {
    if (j.hours_since_last_run == null) return false;
    if (j.last_status && j.last_status !== "succeeded") return true;
    if (j.hours_since_last_run > (CRON_MAX_HOURS[j.jobname] ?? CRON_MAX_HOURS_DEFAULT)) return true;
    return false;
  });
  if (problems.length > 0) {
    const desc = problems.map((j) => `${j.jobname} (status terakhir: ${j.last_status || "-"}, ${Math.round(j.hours_since_last_run)} jam lalu)`).join("; ");
    return `Cron job berikut kelihatan bermasalah: ${desc}. Kemungkinan job-nya berhenti jalan atau gagal terus - cek Database -> Cron di Supabase Dashboard.`;
  }
  return null;
}

async function checkStorageBucketSize(admin) {
  const { data, error } = await admin.rpc("get_storage_bucket_totals");
  if (error) { console.log("[health-check] checkStorageBucketSize gagal:", String(error)); return null; }
  const buckets = data || [];
  const LIMIT_MB = 1024;
  const totalMb = buckets.reduce((a, b) => a + (Number(b.total_mb) || 0), 0);
  const pct = Math.round((totalMb / LIMIT_MB) * 100);
  if (pct >= 80) {
    const detail = buckets.map((b) => `${b.bucket_id}: ${b.total_mb}MB`).join(", ");
    return `Storage file (foto/audio) udah kepake ${Math.round(totalMb)}MB dari limit 1GB di plan Free Supabase (${pct}%). Rincian: ${detail}. Mendekati batas - pertimbangkan hapus file lama atau upgrade plan.`;
  }
  return null;
}

async function checkMayarUpgradeStuck(admin) {
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const { data, error } = await admin.from("pending_mayar_upgrades").select("email, tier, amount, phone, customer_name, created_at").lt("created_at", cutoff);
  if (error) { console.log("[health-check] checkMayarUpgradeStuck gagal:", String(error)); return null; }
  if ((data || []).length > 0) {
    const list = data.map((r) => {
      const namePart = r.customer_name ? `${r.customer_name} - ` : "";
      const phonePart = r.phone ? `, WA: ${r.phone}` : ", WA: gak ada di data";
      return `${namePart}${r.email} (${r.tier}, Rp${r.amount}${phonePart})`;
    }).join("; ");
    return `SOAL DUIT - ada ${data.length} pembayaran Mayar yang udah masuk tapi belum ke-link ke akun Nexto (lebih dari 15 menit): ${list}. Bukan berarti ada yang error - kemungkinan besar orangnya bayar duluan sebelum bikin akun/pake email beda. Worth di-follow-up cepet (WA/email) biar mereka gak nunggu lama buat dapet akses yang udah dibayar.`;
  }
  return null;
}

async function checkMayarUnknownAmounts(admin) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString();
  const { data, error } = await admin.from("mayar_unknown_amounts").select("email, amount, event").gte("created_at", oneDayAgo);
  if (error) { console.log("[health-check] checkMayarUnknownAmounts gagal:", String(error)); return null; }
  if ((data || []).length > 0) {
    const list = data.map((r) => `${r.email} (Rp${r.amount}, event: ${r.event || "-"})`).join("; ");
    return `SOAL DUIT - PENTING - ada ${data.length} pembayaran Mayar dalam 24 jam terakhir dengan NOMINAL yang GAK DIKENALI kode kita: ${list}. Kemungkinan besar HARGA DI MAYAR BERUBAH tapi mapping nominal di kode (mayar-webhook, AMOUNT_TO_TIER) belum diupdate - user-user ini UDAH BAYAR tapi GAK OTOMATIS ke-upgrade, dan ini bakal KETERUSAN kejadian ke pembayaran berikutnya sampai mapping-nya diperbaiki. Upgrade manual user-user ini dulu, terus update mapping-nya biar gak kejadian lagi.`;
  }
  return null;
}

async function checkGcalOauthAbandoned(admin) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString();
  const { count, error } = await admin
    .from("google_oauth_states")
    .select("state", { count: "exact", head: true })
    .lt("expires_at", new Date().toISOString())
    .gte("created_at", oneDayAgo);
  if (error) { console.log("[health-check] checkGcalOauthAbandoned gagal:", String(error)); return null; }
  if ((count ?? 0) >= 3) {
    return `Ada ${count} percobaan connect Google Calendar dalam 24 jam terakhir yang GAK SELESAI (linknya kedaluwarsa sebelum prosesnya kelar). Bisa jadi user cuma berubah pikiran/gak sempet, tapi kalau jumlahnya sebanyak ini worth dicek juga apakah ada masalah teknis di alur connect-nya (misal Google API nolak, redirect URI salah, dst) - cek Edge Functions -> google-oauth-callback -> Logs.`;
  }
  return null;
}

async function checkWritePathSelftest(admin) {
  const issues = [];
  const { data, error } = await admin.rpc("run_write_path_selftest");
  if (error) {
    issues.push(`PENTING - uji simpan data otomatis (canary) sendiri GAGAL dijalankan: ${String(error.message || error).slice(0, 300)}. Artinya sekarang gak ada yang ngecek apakah user bisa nyimpan data. Cek fungsi run_write_path_selftest di Database -> Functions.`);
  } else if (data && data.ok === false) {
    const list = (data.failures || []).map((f) => `${f.path}: ${String(f.error).slice(0, 160)}`).join("; ");
    issues.push(`URGENT - ada jalur SIMPAN DATA yang GAGAL di uji otomatis (user asli hampir pasti kena error yang sama, dan mereka gak akan bisa nyimpan sampai ini dibenerin): ${list}. Biasanya penyebabnya trigger atau fungsi database yang error - cek Database -> Triggers/Functions yang disebut di pesan error.`);
  }

  const { data: rls, error: rlsErr } = await admin
    .from("canary_results").select("ok, checked, failures, ran_at").eq("kind", "rls").order("ran_at", { ascending: false }).limit(1).maybeSingle();
  if (rlsErr) {
    console.log("[health-check] baca canary_results gagal:", String(rlsErr));
  } else if (rls) {
    const ageHours = (Date.now() - new Date(rls.ran_at).getTime()) / 3600000;
    if (rls.ok === false) {
      const list = (rls.failures || []).map((f) => `${f.path}: ${String(f.error).slice(0, 160)}`).join("; ");
      issues.push(`URGENT - uji RLS otomatis (diuji sebagai user biasa) GAGAL: ${list}. Kalau isinya soal KEBOCORAN, artinya user bisa melihat data organisasi lain - cek policy RLS tabel yang disebut SEKARANG. Kalau soal gagal simpan, user asli kemungkinan kena error yang sama.`);
    } else if (ageHours > 5) {
      issues.push(`PENTING - uji RLS otomatis terakhir jalan ${Math.round(ageHours)} jam lalu (harusnya tiap 2 jam) - cron nexto-rls-canary kemungkinan mati atau gagal. Selama itu isolasi data antar-organisasi gak ada yang ngecek. Cek Database -> Cron.`);
    }
  }

  return issues.length > 0 ? issues.join(" | ") : null;
}

async function checkClientErrors(admin) {
  const since = new Date(Date.now() - 8 * 60 * 60000).toISOString();
  const { data, error } = await admin.from("client_error_log").select("message, user_id").gte("created_at", since).limit(500);
  if (error) { console.log("[health-check] checkClientErrors gagal:", String(error)); return null; }
  const groups = new Map();
  for (const row of data || []) {
    const key = String(row.message || "")
      .toLowerCase()
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
      .replace(/\d+/g, "#")
      .slice(0, 120);
    const g = groups.get(key) || { sample: String(row.message).slice(0, 200), count: 0, users: new Set() };
    g.count++;
    g.users.add(row.user_id);
    groups.set(key, g);
  }
  const repeated = [...groups.values()].filter((g) => g.count >= 3).sort((a, b) => b.count - a.count).slice(0, 4);
  if (repeated.length > 0) {
    const list = repeated.map((g) => `"${g.sample}" (${g.count}x, ${g.users.size} akun)`).join("; ");
    return `Ada error yang berulang dialami user asli di app dalam 8 jam terakhir: ${list}. Ini pesan "Gagal ..." yang muncul di layar mereka - kalau banyak akun kena pesan yang sama, kemungkinan ada bug beneran (bukan salah user). Cek tabel client_error_log buat detail.`;
  }
  return null;
}

// === PERINGATAN BIAYA & LIMIT AI (6 Okt 2026, permintaan Nando) ===
// Ambang bisa diubah di sini. Biaya dalam dolar AS.
const AI_ACCOUNT_PCT_WARN = 85;
const AI_ACCOUNT_DAILY_USD_WARN = 5;
const AI_PLATFORM_DAILY_USD_WARN = 25;
const fmtUsd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

async function computeAiUsageSnapshot(admin) {
  const { data: report, error } = await admin.rpc("admin_ai_usage_report");
  if (error || !report) throw new Error("admin_ai_usage_report gagal: " + String(error?.message || error));
  const accounts = report.accounts || [];
  const byUser = new Map(accounts.map((a) => [a.user_id, a]));
  const nameOf = (uid) => {
    const a = byUser.get(uid);
    return a ? `${a.display_name || a.email || uid.slice(0, 8)} (${a.plan}${a.org_name ? ", " + a.org_name : ""})` : `akun ${String(uid).slice(0, 8)}`;
  };

  // candidates = keadaan SAAT INI yang layak diwaspadai. Dedup per
  // (akun, jenis, jendela) lewat ai_limit_alerts_sent supaya tidak dikirim
  // berulang tiap 8 jam.
  const candidates = [];
  for (const a of accounts) {
    const cycle = String(a.period_start || "").slice(0, 10);
    if (Number(a.pct_of_limit) >= AI_ACCOUNT_PCT_WARN) {
      candidates.push({ user_id: a.user_id, feature_key: "pct85", window_key: cycle, critical: false,
        text: `${nameOf(a.user_id)} sudah ${a.pct_of_limit}% dari total limit AI paketnya (siklus sejak ${cycle})` });
    }
    for (const f of a.features || []) {
      if (f.limit != null && Number(f.used) > Number(f.limit)) {
        candidates.push({ user_id: a.user_id, feature_key: `over:${f.key}`, window_key: cycle, critical: true,
          text: `${nameOf(a.user_id)} memakai ${f.label} ${f.used}x padahal limitnya ${f.limit}x (penjaga kuota kemungkinan bocor)` });
      }
    }
  }

  // Lonjakan biaya 24 jam terakhir (dibaca per halaman 1000 baris).
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const wibDay = new Date(Date.now() + HEALTHCHECK_WIB_OFFSET_MS).toISOString().slice(0, 10);
  const costByUser = new Map();
  let platformCost = 0;
  for (let page = 0; page < 20; page++) {
    const { data, error: usageErr } = await admin.from("ai_usage").select("user_id, cost_usd").gte("created_at", since).order("id").range(page * 1000, page * 1000 + 999);
    if (usageErr) { console.log("[health-check] baca ai_usage gagal:", String(usageErr)); break; }
    for (const r of data || []) {
      const c = Number(r.cost_usd) || 0;
      platformCost += c;
      if (r.user_id) costByUser.set(r.user_id, (costByUser.get(r.user_id) || 0) + c);
    }
    if ((data || []).length < 1000) break;
  }
  for (const [uid, c] of costByUser) {
    if (c >= AI_ACCOUNT_DAILY_USD_WARN) {
      candidates.push({ user_id: uid, feature_key: "cost_spike", window_key: wibDay, critical: false,
        text: `${nameOf(uid)} menghabiskan ${fmtUsd(c)} biaya AI dalam 24 jam terakhir` });
    }
  }
  const platformSpike = platformCost >= AI_PLATFORM_DAILY_USD_WARN;

  let fresh = [];
  if (candidates.length > 0) {
    const { data: alreadySent } = await admin
      .from("ai_limit_alerts_sent")
      .select("user_id, feature_key, window_key")
      .in("window_key", [...new Set(candidates.map((c) => c.window_key))]);
    const sentSet = new Set((alreadySent || []).map((r) => `${r.user_id}::${r.feature_key}::${r.window_key}`));
    fresh = candidates.filter((c) => !sentSet.has(`${c.user_id}::${c.feature_key}::${c.window_key}`));
    if (fresh.length > 0) {
      await admin.from("ai_limit_alerts_sent").upsert(
        fresh.map((c) => ({ user_id: c.user_id, feature_key: c.feature_key, window_key: c.window_key })),
        { onConflict: "user_id,feature_key,window_key", ignoreDuplicates: true }
      );
    }
  }

  const lines = fresh.map((c) => c.text);
  if (platformSpike) lines.push(`Total biaya AI seluruh platform ${fmtUsd(platformCost)} dalam 24 jam terakhir (ambang ${fmtUsd(AI_PLATFORM_DAILY_USD_WARN)})`);
  let issueText = null;
  if (lines.length > 0) {
    issueText = `Pemakaian AI perlu dicek (${lines.length} temuan): ${lines.slice(0, 6).join("; ")}${lines.length > 6 ? ", dst" : ""}. Rinciannya ada di Command Center, kartu BIAYA AI.`;
  }

  return {
    flaggedCount: candidates.length + (platformSpike ? 1 : 0),
    criticalCount: candidates.filter((c) => c.critical).length,
    issueText,
  };
}

// === SALDO TOKEN ANTHROPIC (10 Okt 2026, permintaan Nando: "alert dari ATOM") ===
// Saldo kredit Anthropic tidak bisa dibaca lewat API, jadi dihitung seperti kartu CASH FLOW di Command Center:
// saldo patokan (admin_settings "cashflow") + top-up sejak patokan - biaya AI di ai_usage (RPC admin_ai_cost_between).
// Status: bahaya bila habis/ sisa < 15% / cukup < 7 hari; waspada bila sisa < 40% / cukup < 21 hari. Saldo patokan belum
// diisi = tidak diperingatkan. Pesan Telegram dibatasi (tokenAlertDue) supaya tidak berulang tiap 8 jam.
let lastTokenStatus = null;
async function checkAnthropicBalance(admin) {
  lastTokenStatus = null;
  const { data: st } = await admin.from("admin_settings").select("value").eq("key", "cashflow").maybeSingle();
  const cfg = st?.value || {};
  const cp = cfg.anthropic?.checkpoint_date;
  if (!cp || !/^\d{4}-\d{2}-\d{2}$/.test(cp)) return null;
  const nowIso = new Date(Date.now() + 60000).toISOString();
  const cost = async (fromIso) => {
    const { data, error } = await admin.rpc("admin_ai_cost_between", { p_from: fromIso, p_to: nowIso });
    if (error) throw error;
    return Number(data) || 0;
  };
  const consumed = await cost(new Date(`${cp}T00:00:00+07:00`).toISOString());
  const week = await cost(new Date(Date.now() - 7 * 86400000).toISOString());
  const topups = (cfg.topups || []).filter((t) => t.date >= cp).reduce((a, t) => a + (Number(t.amount_usd) || 0), 0);
  const funded = (Number(cfg.anthropic.balance_usd) || 0) + topups;
  const remaining = funded - consumed;
  const pctLeft = funded > 0 ? Math.max(0, remaining) / funded * 100 : 0;
  const burn = week / 7;
  const days = burn > 0 ? Math.floor(Math.max(0, remaining) / burn) : null;
  const status = remaining <= 0 || pctLeft < 15 || (days !== null && days < 7) ? "danger"
    : pctLeft < 40 || (days !== null && days < 21) ? "warn" : "ok";
  if (status === "ok") return null;
  lastTokenStatus = status;
  const need = burn * 30 * 1.3;
  const rec = Math.max(0, Math.ceil((need - remaining) / 5 - 1e-9) * 5);
  return `Saldo token Anthropic ${status === "danger" ? "HAMPIR HABIS" : "mulai menipis"}: sisa $${remaining.toFixed(2)} (${pctLeft.toFixed(0)}% dari $${funded.toFixed(2)})${days !== null ? `, cukup sekitar ${days} hari` : ""}. Disarankan top up sekitar $${rec} (rata-rata pemakaian $${burn.toFixed(2)} per hari). Kalau saldo habis semua fitur AI Nexto berhenti. Rincian di Command Center, kartu CASH FLOW.`;
}
// Alert Telegram hanya dikirim bila status memburuk, atau sudah 12 jam (bahaya) / 24 jam (waspada) sejak alert terakhir.
async function tokenAlertDue(admin, status) {
  const { data } = await admin.from("admin_settings").select("value").eq("key", "anthropic_alert").maybeSingle();
  const last = data?.value;
  const rank = { warn: 1, danger: 2 };
  const hours = last?.at ? (Date.now() - new Date(last.at).getTime()) / 3600000 : 1e9;
  const due = !last || (rank[status] || 0) > (rank[last.status] || 0) || hours >= (status === "danger" ? 12 : 24);
  if (due) await admin.from("admin_settings").upsert({ key: "anthropic_alert", value: { status, at: new Date().toISOString() }, updated_at: new Date().toISOString() });
  return due;
}

const CHECK_DEFS = [
  { key: "daily_digest", label: "Daily Digest", desc: "Ringkasan & rekomendasi lead harian ngirim ke user tiap pagi" },
  { key: "embedding_backlog", label: "Backlog Vector Memory", desc: "Catatan progress yang belum diproses jadi memori semantik" },
  { key: "database_size", label: "Ukuran Database", desc: "Pemakaian storage Postgres vs limit 500MB plan Free" },
  { key: "leads_row_count", label: "Jumlah Baris Lead", desc: "Total lead se-platform & organisasi terbesar, vs ambang batas performa" },
  { key: "slow_queries", label: "Kecepatan Query", desc: "Query ke tabel aplikasi yang keliatan lambat (lewat pg_stat_statements)" },
  { key: "unindexed_fkeys", label: "Index Foreign Key", desc: "Semua kolom foreign key di skema punya index (jalan otomatis buat FK baru juga)" },
  { key: "missing_secrets", label: "Secret & API Key", desc: "Semua kunci API/secret penting kesetel & gak kosong" },
  { key: "telegram_bot", label: "Bot Alert Telegram", desc: "Token bot Telegram (dipake ngirim alert RAKA ke admin) masih valid" },
  { key: "gcal_sync", label: "Sinkron Google Calendar", desc: "Jadwal kunjungan ke-sync ke Calendar user yang connect" },
  { key: "org_setup", label: "Setup Organisasi", desc: "Semua organisasi punya tahap pipeline (gak nyangkut onboarding)" },
  { key: "duplicate_org_membership", label: "Duplikat Organisasi", desc: "Gak ada akun yang somehow punya lebih dari 1 organisasi sekaligus" },
  { key: "resend_domain", label: "Domain Email", desc: "Domain pengirim email (Resend) udah terverifikasi" },
  { key: "rls", label: "Proteksi RLS Database", desc: "Semua tabel punya Row Level Security aktif" },
  { key: "delete_spike", label: "Lonjakan Hapus Data", desc: "Deteksi penghapusan data massal yang mencurigakan" },
  { key: "pg_net_errors", label: "Cron & Webhook (HTTP)", desc: "Status HTTP asli dari semua panggilan cron/database webhook" },
  { key: "cron_jobs", label: "Status Cron Job", desc: "Semua jadwal otomatis (cron) jalan & sukses tepat waktu" },
  { key: "storage_size", label: "Ukuran Storage File", desc: "Pemakaian file (foto check-in, audio meeting) vs limit 1GB" },
  { key: "mayar_stuck", label: "Pembayaran Mayar", desc: "Pembayaran yang masuk sudah ke-link ke akun user" },
  { key: "mayar_unknown_amount", label: "Nominal Pembayaran Mayar", desc: "Semua nominal pembayaran yang masuk dikenali kode (harga gak berubah diam-diam)" },
  { key: "gcal_oauth_abandoned", label: "Alur Connect Google Calendar", desc: "Percobaan connect Google Calendar berhasil sampai selesai, gak macet di tengah" },
  { key: "write_selftest", label: "Uji Simpan Data & RLS (Canary)", desc: "Uji otomatis jalur simpan kritis (daftar, tambah/edit lead, ganti tahap, progress, deal) + uji RLS sebagai user biasa & isolasi antar-organisasi - selalu di-rollback, gak ninggalin data" },
  { key: "client_errors", label: "Error dari Aplikasi", desc: "Pesan 'Gagal ...' yang dialami user asli di app - error yang berulang = kemungkinan bug beneran" },
  { key: "anthropic_balance", label: "Saldo Token Anthropic", desc: "Sisa kredit token Anthropic cukup untuk pemakaian ke depan (peringatan sebelum habis, dengan saran jumlah top-up)" },
];

// PENCATATAN BIAYA (10 Okt 2026, permintaan Nando): ringkasan AI untuk Telegram dicatat ke ai_usage (feature "health-check")
// supaya masuk hitungan Cash Flow. Gagal mencatat TIDAK boleh mengganggu pengiriman alert.
const SONNET_PRICE = [2, 10, 2.5, 0.2];
async function logAiUsage(model, u) {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const row = {
      feature: "health-check", user_id: null, provider: "anthropic", model: model || "claude-sonnet-5-5",
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

async function summarizeIssues(issues) {
  const prompt = `Kamu asisten teknis buat developer non-programmer yang jalanin CRM bernama Nexto (dibangun pake Supabase + React). Ini beberapa temuan mentah dari health check otomatis sistem:

${issues.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Tulis pesan Telegram (Bahasa Indonesia santai) yang:
- Jelasin tiap temuan dengan bahasa yang gampang dimengerti orang non-teknis
- Kasih saran KONKRET langkah pertama yang perlu dicek (nama tab/menu di Supabase Dashboard yang relevan)
- JANGAN nyaranin eksekusi perbaikan apapun tanpa manusia liat dulu - kamu cuma boleh kasih saran "cek ini", bukan "saya udah benerin" atau "lakukan X"
- Kalau ada lebih dari 1 temuan, urutin dari yang paling penting/mendesak duluan
- Kalau ada temuan yang nyangkut KEAMANAN (RLS mati, secret ilang, lonjakan hapus data, KEBOCORAN data antar-organisasi) ATAU DUIT (pembayaran nyangkut/nominal gak dikenali) ATAU SALDO TOKEN ANTHROPIC HABIS/MENIPIS (semua fitur AI berhenti kalau habis - sebutkan sisa saldo dan saran top-up persis seperti di temuan) ATAU USER GAK BISA NYIMPAN DATA (uji simpan data gagal), taro itu PALING ATAS, tandain jelas - buat temuan soal pembayaran, SEBUTIN JELAS nama/email/nomor WA customer-nya (JANGAN diringkas/dihilangkan) biar bisa langsung dipake buat hubungin orangnya; buat temuan uji simpan data, SEBUTIN persis nama jalur & pesan error-nya
- JANGAN pake tanda bintang (*) atau underscore (_) buat format tebal/miring - tulis PLAIN TEXT doang, gak ada markdown sama sekali (nama variable/secret di temuan sering ada underscore-nya, kalau kepake buat markdown formatting Telegram bakal GAGAL PARSE dan pesannya gak kekirim sama sekali)

BATAS KETAT: maksimal 15 baris, DAN maksimal 3000 karakter total - kalau temuannya banyak, ringkas per poin (gak usah sepanjang penjelasan yang bisa ditulis), JANGAN sampai kepotong di tengah kalimat. Jangan pakai markdown heading, langsung ke isi.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 1100, thinking: { type: "between_tools" }, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) return issues.join("\n\n");
    const dat = await resp.json();
    console.log("[health-check] USAGE:", JSON.stringify(dat.usage), "issues_count:", issues.length, "prompt_chars:", prompt.length);
    await logAiUsage(dat.model, dat.usage);
    return (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n") || issues.join("\n\n");
  } catch (_) {
    return issues.join("\n\n");
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const reqUrl = new URL(req.url);
    if (reqUrl.searchParams.get("test") === "true") {
      await tgSend(`Nexto Health Check (TEST)\n\nIni pesan test dari ATOM - kalau lo nerima ini, artinya notifikasi Telegram ATOM beneran nyambung & jalan. Gak ada masalah asli, ini cuma tes pengiriman.\n\nKalau HP lo gak nerima pesan ini, berarti ADMIN TELEGRAM CHAT ID belum di-set atau salah - cek Edge Functions -> Secrets.`);
      return new Response(JSON.stringify({ ok: true, mode: "test", note: "Cek Telegram kamu - harusnya ada pesan masuk." }), { headers: { "Content-Type": "application/json" } });
    }

    if (reqUrl.searchParams.get("only") === "canary") {
      const issue = await checkWritePathSelftest(admin);
      if (!issue) return new Response(JSON.stringify({ ok: true, mode: "canary", status: "sehat" }), { headers: { "Content-Type": "application/json" } });
      await tgSend(`Nexto Canary (uji simpan data, tiap 2 jam)\n\n${issue}\n\nIni cuma laporan - gak ada yang dieksekusi otomatis. Cek & benerin manual ya bro.`);
      return new Response(JSON.stringify({ ok: true, mode: "canary", status: "ada_temuan", issue }), { headers: { "Content-Type": "application/json" } });
    }

    // URUTAN WAJIB SAMA dengan CHECK_DEFS di atas (dipasangin per index).
    const checkResults = await Promise.all([
      checkDailyDigestRan(admin),
      checkEmbeddingBacklog(admin),
      checkDatabaseSize(admin),
      checkLeadsRowCount(admin),
      checkSlowQueries(admin),
      checkUnindexedForeignKeys(admin),
      checkMissingSecrets(),
      checkTelegramBotToken(),
      checkGcalSyncGaps(admin),
      checkBrokenOrgSetup(admin),
      checkDuplicateOrgMembership(admin),
      checkResendDomain(),
      checkRLSDisabled(admin),
      checkAuditLogDeleteSpike(admin),
      checkPgNetErrors(admin),
      checkCronJobsHealthy(admin),
      checkStorageBucketSize(admin),
      checkMayarUpgradeStuck(admin),
      checkMayarUnknownAmounts(admin),
      checkGcalOauthAbandoned(admin),
      checkWritePathSelftest(admin),
      checkClientErrors(admin),
      checkAnthropicBalance(admin).catch((e) => `Pengecekan saldo token Anthropic gagal dijalankan: ${String(e).slice(0, 200)}`),
    ]);
    const checksDetail = CHECK_DEFS.map((def, i) => ({
      key: def.key,
      label: def.label,
      desc: def.desc,
      ok: checkResults[i] === null,
      detail: checkResults[i] || "Aman, gak ada masalah terdeteksi.",
    }));
    let issues = checkResults.filter(Boolean);
    const tokenText = checkResults[CHECK_DEFS.findIndex((d) => d.key === "anthropic_balance")];
    if (tokenText && lastTokenStatus) {
      // Tetap tampil di kartu ATOM, tapi Telegram hanya bila tokenAlertDue.
      try { if (!(await tokenAlertDue(admin, lastTokenStatus))) issues = issues.filter((t) => t !== tokenText); }
      catch (e) { console.log("[health-check] tokenAlertDue gagal:", String(e)); }
    } else if (!tokenText) {
      try { await admin.from("admin_settings").delete().eq("key", "anthropic_alert"); } catch (_) { /* abaikan */ }
    }

    let aiUsageSnapshot = { flaggedCount: null, criticalCount: 0, issueText: null };
    try {
      aiUsageSnapshot = await computeAiUsageSnapshot(admin);
      if (aiUsageSnapshot.issueText) issues.push(aiUsageSnapshot.issueText);
    } catch (e) {
      console.log("[health-check] computeAiUsageSnapshot gagal:", String(e));
    }

    if (reqUrl.searchParams.get("dry") === "true") {
      return new Response(JSON.stringify({ ok: true, mode: "dry", checks: checksDetail.length, issues, ai_flagged: aiUsageSnapshot.flaggedCount }), { headers: { "Content-Type": "application/json" } });
    }

    if (issues.length === 0) {
      console.log("[health-check] Tidak ada temuan baru untuk dikirim.");
      const tokenOnly = !!(tokenText && lastTokenStatus);
      await admin.from("health_check_runs").insert({ status: tokenOnly ? "ada_temuan" : "sehat", issue_count: tokenOnly ? 1 : 0, summary: tokenOnly ? tokenText : "Semua sinyal normal.", checks_detail: checksDetail, ai_flagged_count: aiUsageSnapshot.flaggedCount });
      return new Response(JSON.stringify({ ok: true, status: "sehat", issues: [] }), { headers: { "Content-Type": "application/json" } });
    }

    const summary = await summarizeIssues(issues);
    await tgSend(`Nexto Health Check\n\n${summary}\n\nIni cuma laporan - gak ada yang dieksekusi otomatis. Cek & benerin manual ya bro.`);
    await admin.from("health_check_runs").insert({ status: "ada_temuan", issue_count: issues.length, summary, checks_detail: checksDetail, ai_flagged_count: aiUsageSnapshot.flaggedCount });

    return new Response(JSON.stringify({ ok: true, status: "ada_temuan", issues }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await tgSend(`Health check function sendiri gagal jalan:\n${String(e).slice(0, 300)}`);
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      await admin.from("health_check_runs").insert({ status: "error", issue_count: 0, summary: String(e).slice(0, 500) });
    } catch (_) {}
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
