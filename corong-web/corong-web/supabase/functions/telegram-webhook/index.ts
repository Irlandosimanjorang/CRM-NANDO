// Supabase Edge Function: telegram-webhook
// AI Asisten ini PUNYA kemampuan nulis ke CRM (update/tambah/hapus lead & kompetitor)
// lewat tool-calling Claude.
//
// LEVEL OTONOMI (nyambung ke prinsip "human-in-the-loop" di roadmap Nexto):
// - Aksi AMAN (update field, tambah lead/kompetitor baru, jadwalin/batalin visit,
//   catat progress, TUTUP lead jadi menang/kalah) DIEKSEKUSI LANGSUNG tanpa
//   konfirmasi - biar cepet, gak berasa lambat.
// - Aksi SENSITIF/GAK BISA DIBALIKIN (hapus lead, hapus kompetitor) WAJIB
//   konfirmasi dulu ("ya"/"gak") sebelum beneran dijalanin - pake mekanisme
//   pending_actions.
//   delete_lead masih masuk recycle bin (bisa dipulihin), tapi delete_competitor
//   PERMANEN total - makanya dua-duanya tetep digerbangin biar gak kejadian
//   AI salah nafsirin voice note terus ngehapus data yang salah.
//
// === FITUR "Rapihin Data" MINGGUAN DIHAPUS (16 Sep 2026, permintaan Nando) ===
// Konfirmasi "ya"/"gak" via TEKS di bawah ini (dicek PALING DULUAN, SEBELUM
// gate weekday/cap/plan) tadinya dibikin biar Standard tetep bisa approve
// saran dari weekly-cleanup-check (cron mingguan yang udah di-unschedule &
// function-nya udah dimatiin - lihat weekly-cleanup-check/index.ts) tanpa
// perlu naik ke Professional+. Sekarang satu-satunya pending_actions yang
// tersisa (delete_lead/delete_competitor) cuma dibuat lewat chat NEXA yang
// emang udah Professional+ doang, jadi posisi paling-duluan ini gak lagi
// krusial secara fungsional - tapi dibiarin apa adanya (gak restructuring)
// karena gak salah & gak ganggu apa-apa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri",
  automotive: "dealer kendaraan (mobil/motor)",
  property: "agen/developer properti",
  b2b_general: "distributor/trading B2B umum",
  insurance: "agen asuransi/financial services",
  retail_fmcg: "distribusi retail/FMCG",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project buat perusahaan (SPK/kontrak kerja)",
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.pvc_chemical;

async function tgSend(chatId, text) {
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    console.log("[tgSend] GAGAL kirim pesan:", resp.status, errBody.slice(0, 300));
    const retryResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!retryResp.ok) {
      console.log("[tgSend] Retry tanpa Markdown JUGA gagal:", retryResp.status);
    }
  }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibDayStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth(), day = wibNow.getUTCDate();
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WIB_OFFSET_MS);
}
function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}
const MAX_AUTONOMOUS_EMAIL_PER_MONTH = 12;
// FIX RACE (17 Sep 2026, ketauan pas audit) - sebelumnya SELECT count() dulu
// baru INSERT kalau masih di bawah limit, 2 langkah TERPISAH - 2 request
// bersamaan bisa dua-duanya lolos hitungan sebelum salah satu sempet
// insert, jatah bulanan bisa kelewat dikit. Sekarang lewat RPC
// reserve_edge_function_call yang ngerjain check+insert dalam 1 transaksi
// pake advisory lock per user+function, jadi beneran atomic.
async function checkRateLimitPerUserMonthly(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[rate-limit] reserve_edge_function_call gagal:", error); return false; }
  return !!data;
}
function wibDayOfWeek(d = new Date()) {
  return new Date(d.getTime() + WIB_OFFSET_MS).getUTCDay();
}

function sanitizePhone(raw) {
  if (!raw) return "";
  const matches = String(raw).match(/(\+?\d[\d\-\s]{5,}\d)/g) || [];
  const cleaned = matches.map((m) => m.replace(/\s+/g, "").trim()).filter(Boolean);
  return cleaned.join(", ");
}

async function transcribeVoice(fileId) {
  const fileInfoResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoResp.json();
  if (!fileInfo.ok) throw new Error("Gagal ambil file audio dari Telegram");
  const filePath = fileInfo.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

  const audioResp = await fetch(fileUrl);
  const audioBuf = await audioResp.arrayBuffer();
  const MAX_VOICE_BYTES = 24 * 1024 * 1024;
  if (audioBuf.byteLength > MAX_VOICE_BYTES) {
    throw new Error(`Voice note kepanjangan/kebesaran (maks ${Math.round(MAX_VOICE_BYTES / 1024 / 1024)}MB). Coba kirim yang lebih pendek atau ketik teks aja.`);
  }
  const audioBlob = new Blob([audioBuf], { type: "audio/ogg" });

  const form = new FormData();
  form.append("file", audioBlob, "voice.ogg");
  form.append("model", "whisper-1");
  form.append("language", "id");

  const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!whisperResp.ok) {
    const errText = await whisperResp.text();
    throw new Error(`Whisper error ${whisperResp.status}: ${errText.slice(0, 200)}`);
  }
  const whisperData = await whisperResp.json();
  return (whisperData.text || "").trim();
}

const TOOLS = [
  {
    name: "get_lead_info",
    description: "Ambil data LENGKAP satu lead (semua field + progress notes terbaru) buat jawab pertanyaan soal SATU lead spesifik yang disebut namanya (misal 'gimana kondisi PT X'). Kalau nyangkut BANYAK lead sekaligus, pake query_leads, bukan ini.",
    input_schema: {
      type: "object",
      properties: { lead_match: { type: "string", description: "Nama perusahaan atau nama key person yang ditanyain user" } },
      required: ["lead_match"],
    },
  },
  {
    name: "query_leads",
    description: "Cari/filter/rangkum BANYAK lead sekaligus (bukan 1 nama spesifik) - misal 'lead overdue', 'berapa di Jakarta', 'stage negosiasi apa aja', 'kategori apa aja'. Hasilnya include cuplikan progress TERAKHIR tiap lead (sampe 20 lead) - JANGAN panggil get_lead_info berkali-kali buat kebutuhan ini. Kalau 1 nama spesifik, pake get_lead_info.",
    input_schema: {
      type: "object",
      properties: {
        filter_stage_type: { type: "string", enum: ["active", "won", "lost", "any"], description: "active = lead yang masih jalan (default kalau gak disebut), won = udah menang/deal, lost = udah kalah, any = semua status" },
        filter_city: { type: "string", description: "nama kota, kosongkan kalau user gak nyebut kota" },
        filter_category: { type: "string", description: "kategori/jenis usaha, kosongkan kalau gak disebut" },
        filter_priority: { type: "string", enum: ["high", "medium", "low"], description: "kosongkan kalau user gak nyebut prioritas" },
        overdue_only: { type: "boolean", description: "true kalau user nanya soal yang overdue/lama gak dikontak/belum di-follow-up" },
        keyword: { type: "string", description: "kata kunci nama perusahaan (buat pencarian sebagian, bukan exact match), kosongkan kalau gak relevan" },
        sort_by: { type: "string", enum: ["last_contact_oldest", "priority_high_first"], description: "cara urutin hasil, sesuaikan sama maksud pertanyaan" },
        count_only: { type: "boolean", description: "true kalau user CUMA nanya JUMLAHNYA doang (misal 'berapa lead di Jakarta'), gak perlu daftar detail tiap lead" },
      },
    },
  },
  {
    name: "update_lead",
    description: "Update lead yang SUDAH ADA. lead_match dicocokin ke nama perusahaan/key person yang disebut DI PESAN INI.",
    input_schema: {
      type: "object",
      properties: {
        lead_match: { type: "string", description: "Nama perusahaan atau nama key person buat nyari lead-nya" },
        updates: {
          type: "object",
          description: "Field yang berubah, isi CUMA yang disebut/relevan di pesan ini",
          properties: {
            visit_date: { type: "string", description: "YYYY-MM-DD" },
            visit_agenda: { type: "string" }, visit_meet: { type: "string" }, next_action: { type: "string" },
            phone: { type: "string" }, email: { type: "string" }, website: { type: "string" },
            key_person: { type: "string" }, key_person_title: { type: "string" },
            product: { type: "string" }, city: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
        progress_note: { type: "string", description: "Catatan progress baru buat lead ini, isi ringkasan info baru dari PESAN INI SAJA" },
        cancel_visit: { type: "boolean", description: "Set TRUE kalau user secara EKSPLISIT minta BATALIN/HAPUS jadwal visit yang udah ada (bukan pindah ke tanggal lain - itu masuk updates.visit_date biasa). Ini bakal ngosongin jadwal DAN hapus event-nya dari Google Calendar." },
      },
      required: ["lead_match"],
    },
  },
  {
    name: "close_lead",
    description: "Tutup lead jadi MENANG atau KALAH PERMANEN (bukan ditunda/dijadwal ulang). Isi progress_note kalau alasan disebut eksplisit; kosongin buat auto-guess sistem.",
    input_schema: {
      type: "object",
      properties: {
        lead_match: { type: "string", description: "Nama perusahaan atau nama key person" },
        result: { type: "string", enum: ["won", "lost"], description: "won = menang/deal closed, lost = kalah/batal" },
        progress_note: { type: "string", description: "Opsional - alasan/catatan penutupan kalau user sebutin eksplisit di pesan ini" },
      },
      required: ["lead_match", "result"],
    },
  },
  {
    name: "create_lead",
    description: "Bikin lead BARU (perusahaan yang belum ada di CRM).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" }, category: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
        website: { type: "string" }, key_person: { type: "string" }, key_person_title: { type: "string" },
        product: { type: "string" }, city: { type: "string" }, progress_note: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_lead",
    description: "Hapus lead (masuk recycle bin, bisa dipulihin). BUTUH konfirmasi user - tetap panggil tool ini, sistem yang nanya konfirmasi.",
    input_schema: { type: "object", properties: { lead_match: { type: "string" } }, required: ["lead_match"] },
  },
  {
    name: "send_email",
    description: "Generate+KIRIM langsung email follow-up ke lead, TANPA konfirmasi tambahan (user udah setuju mode ini). Cuma kalau user JELAS minta kirim/email-in SEKARANG (bukan cuma mikir-mikir). Lead wajib punya email tercatat, kalau gak ada bakal gagal.",
    input_schema: { type: "object", properties: { lead_match: { type: "string" } }, required: ["lead_match"] },
  },
  {
    name: "create_competitor",
    description: "Tambah data kompetitor baru.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, background: { type: "string" }, product: { type: "string" }, notes: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "update_competitor",
    description: "Update data kompetitor yang sudah ada.",
    input_schema: {
      type: "object",
      properties: { competitor_match: { type: "string" }, background: { type: "string" }, product: { type: "string" }, notes: { type: "string" } },
      required: ["competitor_match"],
    },
  },
  {
    name: "delete_competitor",
    description: "Hapus kompetitor PERMANEN (gak ada recycle bin). BUTUH konfirmasi user - tetap panggil tool ini, sistem yang nanya konfirmasi.",
    input_schema: { type: "object", properties: { competitor_match: { type: "string" } }, required: ["competitor_match"] },
    cache_control: { type: "ephemeral", ttl: "1h" },
  },
];

function findLeadCandidates(leads, matchStr) {
  if (!matchStr) return [];
  const s = matchStr.toLowerCase().trim();
  const exact = leads.filter((l) => l.name.toLowerCase() === s);
  if (exact.length) return exact;
  const nameMatches = leads.filter((l) => l.name.toLowerCase().includes(s) || s.includes(l.name.toLowerCase()));
  if (nameMatches.length) return nameMatches;
  const personExact = leads.filter((l) => l.key_person && l.key_person.toLowerCase() === s);
  if (personExact.length) return personExact;
  return leads.filter((l) => l.key_person && (l.key_person.toLowerCase().includes(s) || s.includes(l.key_person.toLowerCase())));
}
function findLead(leads, matchStr) {
  const candidates = findLeadCandidates(leads, matchStr);
  return candidates.length ? candidates[0] : null;
}

function findCompetitorCandidates(comps, matchStr) {
  if (!matchStr) return [];
  const s = matchStr.toLowerCase().trim();
  const exact = comps.filter((c) => c.name.toLowerCase() === s);
  if (exact.length) return exact;
  return comps.filter((c) => c.name.toLowerCase().includes(s) || s.includes(c.name.toLowerCase()));
}
function findCompetitor(comps, matchStr) {
  const candidates = findCompetitorCandidates(comps, matchStr);
  return candidates.length ? candidates[0] : null;
}

async function getValidAccessToken(admin, userId) {
  const { data: link } = await admin.from("google_calendar_links").select("*").eq("user_id", userId).maybeSingle();
  if (!link) return null;
  if (new Date(link.expires_at) > new Date(Date.now() + 60000)) return link.access_token;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: link.refresh_token, grant_type: "refresh_token",
    }),
  });
  const tok = await resp.json();
  if (!resp.ok) return null;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await admin.from("google_calendar_links").update({ access_token: tok.access_token, expires_at: expiresAt }).eq("user_id", userId);
  return tok.access_token;
}

async function upsertCalendarEvent(accessToken, existingEventId, summary, description, dateISO) {
  const eventBody = { summary, description, start: { date: dateISO }, end: { date: dateISO } };
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  if (existingEventId) {
    const resp = await fetch(`${base}/${existingEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(eventBody),
    });
    if (resp.ok) { const d = await resp.json(); return d.id; }
  }
  const resp2 = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(eventBody),
  });
  if (!resp2.ok) return null;
  const d2 = await resp2.json();
  return d2.id;
}

async function syncToCalendar(admin, userId, leadId, leadName, p) {
  try {
    const accessToken = await getValidAccessToken(admin, userId);
    if (!accessToken) return;
    const { data: lead } = await admin.from("leads").select("gcal_visit_event_id").eq("id", leadId).maybeSingle();
    if (p.visitDate) {
      const desc = p.visitAgenda || "Kunjungan sales - Nexto";
      const eventId = await upsertCalendarEvent(accessToken, lead?.gcal_visit_event_id, `Visit: ${leadName}`, desc, p.visitDate);
      if (eventId) await admin.from("leads").update({ gcal_visit_event_id: eventId }).eq("id", leadId);
    }
  } catch (e) {
    console.log("[gcal] EXCEPTION:", String(e));
  }
}

async function cancelCalendarVisit(admin, userId, leadId) {
  try {
    const accessToken = await getValidAccessToken(admin, userId);
    if (!accessToken) return;
    const { data: lead } = await admin.from("leads").select("gcal_visit_event_id").eq("id", leadId).maybeSingle();
    if (lead?.gcal_visit_event_id) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${lead.gcal_visit_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch((e) => console.log("[gcal] gagal hapus event:", String(e)));
      await admin.from("leads").update({ gcal_visit_event_id: null }).eq("id", leadId);
    }
  } catch (e) {
    console.log("[gcal] EXCEPTION cancel:", String(e));
  }
}

const CONFIRM_WINDOW_MS = 5 * 60 * 1000;

async function generateEmailDraft(lead, industryKey, senderName) {
  const notes = (lead.progress_notes || []).slice(-5).map((p) => `${p.note_date}: ${(p.text || "").slice(0, 200)}`);
  const payload = {
    name: lead.name, product: lead.product || "", category: lead.category || "",
    key_person: lead.key_person || "", key_person_title: lead.key_person_title || "",
    recent_progress: notes,
  };
  const signOff = senderName ? `Nama pengirim: ${senderName} - tutup email pake nama ini (misal "Salam,\\n${senderName}"), JANGAN pake "Tim Sales" atau nama generik lain.` : `Nama pengirim gak diketahui - tutup email pake "Salam," doang tanpa nama spesifik, JANGAN ngarang nama.`;
  const prompt = `Kamu asisten sales yang bantu bikin email follow-up ke lead di bisnis ${industryContext(industryKey)}.

Data lead ini: ${JSON.stringify(payload)}

Tulis email follow-up - agak formal, ada salam pembuka & penutup singkat. JANGAN pakai emoji atau simbol dekoratif. Titik koma (;) boleh dipake buat gabungin klausa yang berkaitan erat kalau pas secara gramatikal. Personalisasi berdasarkan histori progress - kalau ada objection/pertanyaan yang belum kejawab, singgung itu. Kalau belum ada histori sama sekali, buat email perkenalan yang natural. JANGAN mengarang detail yang gak ada di data. ${signOff}

Balas HANYA JSON, tanpa markdown: {"subject":"...","body":"..."}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 900, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`AI gagal generate email: status ${resp.status}`);
  const dat = await resp.json();
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let obj = {};
  const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); const e = x.lastIndexOf("}");
  if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }
  if (!obj.subject || !obj.body) throw new Error("AI gagal bikin draft email yang valid");
  const cleanText = (s) => (s || "").replace(/�/g, "").replace(/ {2,}/g, " ");
  return { subject: cleanText(obj.subject), body: cleanText(obj.body) };
}

async function sendEmailViaResend(toEmail, toName, subject, body) {
  const htmlBody = body.split("\n\n").map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Nexto <noreply@nexto.site>",
      to: [toEmail],
      subject,
      html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:#1e293b;line-height:1.6;">${htmlBody}</div>`,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Resend gagal kirim: status ${resp.status} ${errText.slice(0, 150)}`);
  }
}

async function answerLeadQuery(userText, leadData) {
  const prompt = `User nanya (lewat chat Telegram ke asisten sales-nya): "${userText}"

Ini data lead yang relevan, ambil langsung dari database CRM:
${JSON.stringify(leadData, null, 2)}

Jawab pertanyaan user pake Bahasa Indonesia yang sopan dan formal (sapa dengan "Anda"), RINGKAS (maksimal 5-6 kalimat atau poin-poin singkat). Fokus ke info yang paling relevan sama pertanyaannya - kalau ada progress notes, rangkum yang paling baru/penting dulu. JANGAN mengarang info yang gak ada di data ini - kalau field yang ditanya kosong/gak ada datanya, bilang terus terang aja itu belum tercatat.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`AI gagal jawab query: status ${resp.status}`);
  const dat = await resp.json();
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return t || "Data ketemu, tapi AI gagal ngerangkumnya. Coba cek langsung di web ya.";
}

async function answerCrmQuery(userText, resultData) {
  const prompt = `User nanya (lewat chat Telegram ke asisten sales-nya) soal RANGKUMAN banyak lead: "${userText}"

Hasil pencarian dari database CRM (sudah difilter sesuai kriteria pertanyaan):
Total yang cocok: ${resultData.total_count}
${resultData.count_only ? "(User cuma minta jumlahnya doang, gak perlu daftar detail per lead - JANGAN sebutin nama satu-satu kecuali user eksplisit minta itu.)" : `Daftar (ditampilin maks ${resultData.shown.length} dari total ${resultData.total_count}):\n${JSON.stringify(resultData.shown, null, 2)}`}

Tiap lead di daftar (kalau ditampilin) udah dilengkapi "last_note" - cuplikan catatan progress PALING BARU buat lead itu. Kalau pertanyaan user nyangkut ISI progress (misal "yang mana yang masih nunggu approval", "yang udah nanya harga siapa aja"), baca last_note tiap lead buat jawab - JANGAN bilang "gak bisa baca progress", datanya udah ada di sini.

Jawab pertanyaan user pake Bahasa Indonesia yang sopan dan formal (sapa dengan "Anda"), RINGKAS. Kalau daftarnya ditampilin dan lebih dari yang di-shown vs total_count, sebutin "masih ada X lagi" biar user tau itu bukan daftar lengkap. JANGAN mengarang lead yang gak ada di data ini, dan JANGAN mengarang isi progress yang gak ada di last_note.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`AI gagal jawab query: status ${resp.status}`);
  const dat = await resp.json();
  const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return t || "Data ketemu, tapi AI gagal ngerangkumnya. Coba cek langsung di web ya.";
}

async function executeTool(admin, userId, orgId, myRole, toolName, input, leads, competitors, isEnterprise) {
  const today = todayISO();

  if (toolName === "get_lead_info") {
    const candidates = findLeadCandidates(leads, input.lead_match);
    if (candidates.length === 0) return { ok: false, msg: `Gak nemu lead "${input.lead_match}" di data Anda. Coba sebut nama perusahaannya lebih lengkap/jelas.` };
    if (candidates.length > 1) {
      const names = candidates.slice(0, 6).map((l) => l.name).join(", ");
      return { ok: false, msg: `Ada ${candidates.length} lead yang cocok sama "${input.lead_match}": ${names}. Sebutin nama lengkapnya biar gak salah.` };
    }
    const { data: fullLead, error } = await admin
      .from("leads")
      .select("name, category, stage_key, phone, email, website, key_person, key_person_title, product, city, priority, visit_date, visit_agenda, next_action, last_contact, created_at, progress_notes(note_date, text)")
      .eq("id", candidates[0].id)
      .single();
    if (error || !fullLead) return { ok: false, msg: `⚠️ Gagal ambil data lead: ${error?.message || "unknown error"}` };
    const sortedNotes = (fullLead.progress_notes || []).sort((a, b) => (a.note_date < b.note_date ? 1 : -1)).slice(0, 5);
    return { ok: true, isQuery: true, data: { ...fullLead, progress_notes: sortedNotes } };
  }

  if (toolName === "query_leads") {
    let q = admin.from("leads").select("id, name, city, category, stage_key, priority, last_contact, next_action, wait_until").is("deleted_at", null).eq("org_id", orgId);
    if (myRole === "sales_rep") q = q.eq("assigned_to", userId);
    const { data: allLeads, error } = await q;
    if (error) return { ok: false, msg: `⚠️ Gagal ambil data: ${error.message}` };

    const { data: stagesData } = await admin.from("stages").select("key, type").eq("org_id", orgId);
    const stageTypeMap = Object.fromEntries((stagesData || []).map((s) => [s.key, s.type]));

    const wantType = input.filter_stage_type === "any" ? null : (input.filter_stage_type === "won" || input.filter_stage_type === "lost" ? input.filter_stage_type : "normal");

    let filtered = (allLeads || []).filter((l) => {
      const type = stageTypeMap[l.stage_key] || "normal";
      if (wantType && type !== wantType) return false;
      if (input.filter_city && !(l.city || "").toLowerCase().includes(String(input.filter_city).toLowerCase())) return false;
      if (input.filter_category && !(l.category || "").toLowerCase().includes(String(input.filter_category).toLowerCase())) return false;
      if (input.filter_priority && (l.priority || "").toLowerCase() !== String(input.filter_priority).toLowerCase()) return false;
      if (input.keyword && !(l.name || "").toLowerCase().includes(String(input.keyword).toLowerCase())) return false;
      if (input.overdue_only) {
        if (l.wait_until && l.wait_until >= today) return false;
        const days = l.last_contact ? Math.floor((Date.now() - new Date(l.last_contact).getTime()) / 86400000) : Infinity;
        if (days <= 7) return false;
      }
      return true;
    });

    const totalCount = filtered.length;
    if (input.sort_by === "last_contact_oldest") {
      filtered.sort((a, b) => (a.last_contact || "") < (b.last_contact || "") ? -1 : 1);
    } else if (input.sort_by === "priority_high_first") {
      const rank = { high: 0, medium: 1, low: 2, "": 3 };
      filtered.sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
    }

    const limit = 20;
    const topLeads = filtered.slice(0, limit);

    let lastNoteByLeadId = {};
    if (topLeads.length > 0) {
      const { data: notesRows } = await admin
        .from("progress_notes")
        .select("lead_id, note_date, text")
        .in("lead_id", topLeads.map((l) => l.id))
        .order("note_date", { ascending: false });
      for (const n of notesRows || []) {
        if (!lastNoteByLeadId[n.lead_id]) lastNoteByLeadId[n.lead_id] = `${n.note_date}: ${(n.text || "").slice(0, 150)}`;
      }
    }

    const shown = topLeads.map((l) => ({
      name: l.name, city: l.city || "", category: l.category || "", priority: l.priority || "",
      last_contact: l.last_contact || "belum pernah", next_action: l.next_action || "",
      last_note: lastNoteByLeadId[l.id] || "(belum ada catatan progress)",
    }));

    return { ok: true, isCrmQuery: true, data: { total_count: totalCount, shown, count_only: !!input.count_only } };
  }

  if (toolName === "update_lead") {
    const lead = findLead(leads, input.lead_match);
    if (!lead) return { ok: false, msg: `Hmm, gak nemu lead "${input.lead_match}" di data Anda. Coba sebut nama perusahaannya lebih jelas.` };
    const ALLOWED_LEAD_UPDATE_KEYS = new Set([
      "visit_date", "visit_agenda", "visit_meet", "next_action",
      "phone", "email", "website", "key_person", "key_person_title",
      "product", "city", "priority",
    ]);
    const upd = {};
    // BUG FIX (17 Sep 2026, ketauan pas audit): sebelumnya `if (v && ...)` -
    // falsy-check nge-skip string kosong, jadi user gak bisa pernah minta
    // NGOSONGIN field lewat chat (misal "hapus nomor telepon lead X") -
    // AI ngirim phone:"" tapi diem-diem dibuang, keliatan kayak instruksinya
    // gak digubris. Sekarang cuma nge-skip field yang emang gak disebut sama
    // sekali (undefined/null), string kosong yang EKSPLISIT dikirim AI tetep
    // dipakai buat ngosongin field-nya.
    for (const [k, v] of Object.entries(input.updates || {})) {
      if (v !== undefined && v !== null && ALLOWED_LEAD_UPDATE_KEYS.has(k)) upd[k] = v;
    }
    if (upd.phone) upd.phone = sanitizePhone(upd.phone);
    if (Object.keys(upd).length) await admin.from("leads").update(upd).eq("id", lead.id);
    if (input.progress_note) {
      await admin.from("progress_notes").insert({ user_id: userId, org_id: orgId, lead_id: lead.id, note_date: today, text: input.progress_note });
      await admin.from("leads").update({ last_contact: today }).eq("id", lead.id);
    }
    if (input.cancel_visit) {
      await admin.from("leads").update({ visit_date: null, visit_agenda: "", visit_meet: "" }).eq("id", lead.id);
      await cancelCalendarVisit(admin, userId, lead.id);
    } else if (upd.visit_date) {
      await syncToCalendar(admin, userId, lead.id, lead.name, { visitDate: upd.visit_date, visitAgenda: upd.visit_agenda });
    }
    const parts = [`✅ *${lead.name}* diupdate.`];
    if (input.cancel_visit) parts.push(`- Jadwal visit dibatalin & dihapus dari jadwal + Google Calendar.`);
    for (const [k, v] of Object.entries(upd)) parts.push(`- ${k}: ${v}`);
    if (input.progress_note) parts.push(`- catatan: "${input.progress_note}"`);
    return { ok: true, msg: parts.join("\n") };
  }

  if (toolName === "close_lead") {
    const candidates = findLeadCandidates(leads, input.lead_match);
    if (candidates.length === 0) return { ok: false, msg: `Gak nemu lead "${input.lead_match}" di data Anda.` };
    if (candidates.length > 1) {
      const names = candidates.slice(0, 6).map((l) => l.name).join(", ");
      return { ok: false, msg: `Ada ${candidates.length} lead yang cocok sama "${input.lead_match}": ${names}. Sebutin nama lengkapnya biar gak salah tutup.` };
    }
    const lead = candidates[0];
    const { data: stageRow } = await admin.from("stages").select("key, label").eq("org_id", orgId).eq("type", input.result).order("position").limit(1).maybeSingle();
    if (!stageRow) return { ok: false, msg: `⚠️ Gak nemu stage "${input.result === "won" ? "menang" : "kalah"}" di pipeline Anda, gak bisa nutup lead ini lewat sini. Coba tutup manual dari web.` };

    const updates = { stage_key: stageRow.key };
    if (input.progress_note) updates.outcome = { reason_category: null, reason: input.progress_note, source: "manual", computed_at: new Date().toISOString() };
    await admin.from("leads").update(updates).eq("id", lead.id);
    if (input.progress_note) {
      await admin.from("progress_notes").insert({ user_id: userId, org_id: orgId, lead_id: lead.id, note_date: today, text: input.progress_note });
    }

    const label = input.result === "won" ? "MENANG 🎉" : "KALAH";
    const parts = [`✅ *${lead.name}* ditutup jadi ${label} (${stageRow.label}).`];
    if (input.progress_note) parts.push(`- alasan dicatat: "${input.progress_note}"`);
    else parts.push(`- AI bakal nyoba nebak alasannya otomatis dari histori progress notes (kalau jatah harian masih ada).`);
    return { ok: true, msg: parts.join("\n") };
  }

  if (toolName === "create_lead") {
    const { data: stages } = await admin.from("stages").select("key").eq("org_id", orgId).order("position").limit(1);
    const firstStage = stages?.[0]?.key || "";
    const row = {
      user_id: userId, org_id: orgId, assigned_to: userId,
      name: input.name, category: input.category || "Lainnya", stage_key: firstStage,
      phone: sanitizePhone(input.phone), email: input.email || "", website: input.website || "",
      key_person: input.key_person || "", key_person_title: input.key_person_title || "",
      product: input.product || "", city: input.city || "", source: "telegram",
    };
    const { data: newLead, error } = await admin.from("leads").insert(row).select().single();
    if (error) return { ok: false, msg: `⚠️ Gagal bikin lead: ${error.message}` };
    if (input.progress_note) {
      await admin.from("progress_notes").insert({ user_id: userId, org_id: orgId, lead_id: newLead.id, note_date: today, text: input.progress_note });
      await admin.from("leads").update({ last_contact: today }).eq("id", newLead.id);
    }
    return { ok: true, msg: `✅ Lead baru *${input.name}* dibuat.` };
  }

  if (toolName === "delete_lead") {
    const candidates = findLeadCandidates(leads, input.lead_match);
    if (candidates.length === 0) return { ok: false, msg: `Gak nemu lead "${input.lead_match}".` };
    if (candidates.length > 1) {
      const names = candidates.slice(0, 6).map((l) => l.name).join(", ");
      return { ok: false, msg: `⚠️ Ada ${candidates.length} lead yang cocok sama "${input.lead_match}": ${names}. Sebutin nama lengkapnya biar gak salah hapus.` };
    }
    const lead = candidates[0];

    if (isEnterprise && myRole !== "owner" && myRole !== "manager") {
      await admin.from("approval_requests").insert({
        org_id: orgId, requested_by: userId, action_type: "delete_lead",
        payload: { lead_id: lead.id, lead_name: lead.name },
      });
      return { ok: true, msg: `📨 Permintaan hapus *${lead.name}* udah dikirim ke owner/manager buat di-approve dulu.` };
    }

    const expiresAt = new Date(Date.now() + CONFIRM_WINDOW_MS).toISOString();
    await admin.from("pending_actions").insert({
      user_id: userId, tool_name: "delete_lead",
      payload: { id: lead.id, name: lead.name },
      expires_at: expiresAt,
    });
    return { ok: true, msg: `⚠️ Yakin mau hapus *${lead.name}*?\n\n(Masih masuk recycle bin, bisa dipulihin dari web kalau salah)\n\nBalas *ya* buat konfirmasi, atau abaikan/balas *gak* buat batal.` };
  }

  if (toolName === "send_email") {
    if (!isEnterprise) {
      return { ok: false, msg: `⚠️ Kirim email otonom itu fitur khusus paket *Enterprise*. Di paket Professional, Anda tetep bisa bikin draft email lewat tombol "AI Draft" di web - cuma pengirimannya manual (Anda yang review & kirim sendiri).` };
    }
    const candidates = findLeadCandidates(leads, input.lead_match);
    if (candidates.length === 0) return { ok: false, msg: `Gak nemu lead "${input.lead_match}".` };
    if (candidates.length > 1) {
      const names = candidates.slice(0, 6).map((l) => l.name).join(", ");
      return { ok: false, msg: `⚠️ Ada ${candidates.length} lead yang cocok sama "${input.lead_match}": ${names}. Sebutin nama lengkapnya biar gak salah kirim - ini email otomatis, gak ada jeda buat dibatalin.` };
    }
    const leadStub = candidates[0];

    const { data: fullLead } = await admin.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", leadStub.id).single();
    if (!fullLead?.email) return { ok: false, msg: `⚠️ *${leadStub.name}* belum punya alamat email tercatat, gak bisa dikirim.` };

    // QUOTA-BURN-ON-FAILURE FIX (17 Sep 2026, ketauan pas audit) - dipindah
    // ke SINI, SETELAH lead & email-nya dipastiin valid - sebelumnya kuota
    // langsung kepotong di awal (sebelum lead dicari sama sekali), jadi
    // user bisa kehabisan 12 jatah bulanan cuma gara-gara salah ketik nama/
    // lead ambigu/lead belum punya email, padahal belum ada SATU email pun
    // yang beneran kekirim.
    const emailRateOk = await checkRateLimitPerUserMonthly(admin, userId, "telegram_send_email", MAX_AUTONOMOUS_EMAIL_PER_MONTH);
    if (!emailRateOk) {
      return { ok: false, msg: `⚠️ Kuota kirim email otonom (${MAX_AUTONOMOUS_EMAIL_PER_MONTH}x/bulan) udah kepake abis. Coba lagi bulan depan, atau bikin draft manual lewat tombol "AI Draft" di web.` };
    }

    const { data: org } = await admin.from("organizations").select("industry").eq("id", orgId).maybeSingle();
    const industryKey = org?.industry || "pvc_chemical";
    const { data: senderSettings } = await admin.from("settings").select("community_display_name").eq("user_id", userId).maybeSingle();
    const senderName = senderSettings?.community_display_name || "";

    try {
      const draft = await generateEmailDraft(fullLead, industryKey, senderName);
      await sendEmailViaResend(fullLead.email, fullLead.name, draft.subject, draft.body);
      await admin.from("progress_notes").insert({ user_id: userId, org_id: orgId, lead_id: fullLead.id, note_date: today, text: `Email otomatis (via bot Telegram) terkirim - subjek: "${draft.subject}"` });
      await admin.from("leads").update({ last_contact: today }).eq("id", fullLead.id);
      return { ok: true, msg: `📧 Email ke *${fullLead.name}* (${fullLead.email}) udah terkirim otomatis.\n\nSubjek: "${draft.subject}"` };
    } catch (err) {
      return { ok: false, msg: `⚠️ Gagal kirim email ke ${fullLead.name}: ${String(err).slice(0, 150)}` };
    }
  }

  if (toolName === "create_competitor") {
    await admin.from("competitors").insert({ user_id: userId, org_id: orgId, name: input.name, background: input.background || "", product: input.product || "", notes: input.notes || "" });
    return { ok: true, msg: `✅ Kompetitor baru *${input.name}* ditambahin.` };
  }

  if (toolName === "update_competitor") {
    const comp = findCompetitor(competitors, input.competitor_match);
    if (!comp) return { ok: false, msg: `Gak nemu kompetitor "${input.competitor_match}".` };
    const upd = {};
    for (const k of ["background", "product", "notes"]) if (input[k]) upd[k] = input[k];
    if (Object.keys(upd).length) await admin.from("competitors").update(upd).eq("id", comp.id);
    return { ok: true, msg: `✅ Kompetitor *${comp.name}* diupdate.` };
  }

  if (toolName === "delete_competitor") {
    const candidates = findCompetitorCandidates(competitors, input.competitor_match);
    if (candidates.length === 0) return { ok: false, msg: `Gak nemu kompetitor "${input.competitor_match}".` };
    if (candidates.length > 1) {
      const names = candidates.slice(0, 6).map((c) => c.name).join(", ");
      return { ok: false, msg: `⚠️ Ada ${candidates.length} kompetitor yang cocok sama "${input.competitor_match}": ${names}. Sebutin nama lengkapnya biar gak salah hapus - ini PERMANEN.` };
    }
    const comp = candidates[0];

    // GATE APPROVAL ENTERPRISE (17 Sep 2026, ketauan pas audit) - delete_lead
    // udah lebih dulu punya gerbang ini (sales_rep Enterprise wajib minta
    // approval owner/manager, gak bisa self-confirm), tapi delete_competitor
    // kelewat gak ikut disamain - padahal ini PERMANEN (gak ada recycle bin
    // sama sekali, beda dari delete_lead). Sekarang disamain persis.
    if (isEnterprise && myRole !== "owner" && myRole !== "manager") {
      await admin.from("approval_requests").insert({
        org_id: orgId, requested_by: userId, action_type: "delete_competitor",
        payload: { competitor_id: comp.id, competitor_name: comp.name },
      });
      return { ok: true, msg: `📨 Permintaan hapus kompetitor *${comp.name}* udah dikirim ke owner/manager buat di-approve dulu.` };
    }

    const expiresAt = new Date(Date.now() + CONFIRM_WINDOW_MS).toISOString();
    await admin.from("pending_actions").insert({
      user_id: userId, tool_name: "delete_competitor",
      payload: { id: comp.id, name: comp.name },
      expires_at: expiresAt,
    });
    return { ok: true, msg: `⚠️ Yakin mau hapus kompetitor *${comp.name}*?\n\n🚨 Ini PERMANEN - gak ada recycle bin buat kompetitor, gak bisa dibalikin lagi.\n\nBalas *ya* buat konfirmasi, atau abaikan/balas *gak* buat batal.` };
  }

  return { ok: true, msg: "Selesai." };
}

// FITUR DIHAPUS (16 Sep 2026, permintaan Nando): "weekly_cleanup" dulu di
// sini nge-eksekusi saran dari weekly-cleanup-check (cron mingguan yang
// ngirim saran rapihin data ke Telegram). Cron-nya udah di-unschedule dan
// function-nya udah dimatiin (lihat weekly-cleanup-check/index.ts) - gak
// akan ada lagi pending_action ber-tool_name "weekly_cleanup" yang kebuat,
// jadi cabangnya di executePendingAction() ikut dihapus. Rapihin Data versi
// MANUAL (tombol di tab Pengaturan) TETAP ADA, gak kena pengaruh sama sekali.
async function executePendingAction(admin, pending) {
  if (pending.tool_name === "delete_lead") {
    await admin.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", pending.payload.id);
    return `🗑️ *${pending.payload.name}* dihapus (masuk recycle bin, masih bisa dipulihin dari web).`;
  }
  if (pending.tool_name === "delete_competitor") {
    await admin.from("competitors").delete().eq("id", pending.payload.id);
    return `🗑️ Kompetitor *${pending.payload.name}* dihapus permanen.`;
  }
  return "Selesai.";
}

async function getChatHistory(admin, userId, limit = 12) {
  const { data } = await admin.from("chat_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data || []).reverse();
}
async function saveAssistantReply(admin, userId, replyText, source) {
  await admin.from("chat_messages").insert({ user_id: userId, role: "assistant", content: replyText, source });
}

async function classifyComplexity(text) {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8,
        messages: [{
          role: "user",
          content: `Klasifikasi 1 pesan chat sales ke Telegram bot CRM. Balas SATU KATA doang: SIMPLE atau COMPLEX.
COMPLEX = minta bikin/update/hapus/tutup data lead atau kompetitor, jadwalin/batalin visit, nyeritain hasil meeting/progress panjang, nanya kondisi/status/histori SATU lead tertentu, ATAU nanya rangkuman/filter BANYAK lead sekaligus (misal "lead mana yang overdue", "berapa lead di kota X").
SIMPLE = nanya/ngobrol ringan, sapaan, konfirmasi ya/gak, pertanyaan umum yang gak butuh data spesifik lead manapun.

Pesan: "${text}"`,
        }],
      }),
    });
    if (!resp.ok) return "COMPLEX";
    const dat = await resp.json();
    const t = (dat.content || []).map((b) => b.text || "").join("").trim().toUpperCase();
    return t.includes("SIMPLE") ? "SIMPLE" : "COMPLEX";
  } catch (_) {
    return "COMPLEX";
  }
}

async function planTurn(admin, userId, text, leads, competitors) {
  const history = await getChatHistory(admin, userId, 6);

  const staticInstructions = `Kamu asisten sales pribadi Nexto CRM via Telegram. Kamu PUNYA AKSES baca & tulis database CRM user lewat tools yang disediain.

BAHASA: selalu sapa user "Anda" (formal) - JANGAN "kamu"/"lo"/"lu". Kata "kamu" di instruksi ini merujuk ke KAMU (AI), bukan user.

OTONOMI: aksi update/tambah/jadwalin/catat progress/tutup lead LANGSUNG dieksekusi tanpa konfirmasi. delete_lead & delete_competitor OTOMATIS minta konfirmasi via sistem - tetap panggil tool-nya kalau user eksplisit minta hapus, JANGAN nanya konfirmasi manual sendiri lewat teks.

BACA LEAD - 2 tool beda: get_lead_info buat 1 perusahaan spesifik ("gimana kondisi PT X"); query_leads buat banyak lead sekaligus ("lead mana overdue", "berapa di Jakarta", "prioritas tinggi apa aja"). JANGAN jawab dari ingatan/tebakan sendiri, dan JANGAN bilang "gak punya akses" - selalu pake tool yang sesuai.

TUTUP LEAD: user bilang DEAL/MENANG/CLOSING atau GAGAL/KALAH/BATAL PERMANEN (bukan "nunggu") -> panggil close_lead result won/lost. Isi progress_note kalau alasan disebut eksplisit di pesan yang sama, kosongin kalau enggak (sistem nebak otomatis).

EMAIL OTONOM: user eksplisit minta "email-in"/"kirim email ke"/"follow up via email" ke lead tertentu -> panggil send_email (generate+kirim langsung, TANPA konfirmasi/preview). JANGAN panggil kalau user cuma mikir-mikir ("gimana ya kalau di-email"). WhatsApp BELUM bisa dikirim otomatis (belum ada integrasi WA Business API) - kalau diminta WA-in lead, arahkan ke tombol AI Draft di web/app.

SUMBER KEBENARAN: isi tool call (lead_match, updates, progress_note, dst) HARUS murni dari PESAN USER PALING BARU - JANGAN PERNAH gabung/salin info dari giliran chat sebelumnya walau topiknya mirip. Histori chat cuma buat KONTEKS (misal user bilang "lanjutin yang tadi"), bukan buat diambil isinya otomatis. Kalau ga yakin perusahaan mana yang dimaksud (nama ambigu), JANGAN panggil tool - tanya balik dulu pake teks biasa. Gak perlu liat daftar lengkap lead buat nyocokin nama - sistem yang nyari kecocokannya di belakang layar.

Nama perusahaan di CRM kadang unik/kedengeran kayak kalimat biasa (misal "PT Siapa Kamu", "CV Kapan Lagi") - itu TETAP nama valid, bukan obrolan biasa. Kalau user nyebut nama diawali "PT"/"CV"/"UD" atau kedengeran nama usaha, ANGGAP itu lead yang dicari - LANGSUNG panggil tool, JANGAN tanya balik "maksudnya nama perusahaan apa?".

BATALIN VISIT: user EKSPLISIT minta batalin/hapus jadwal visit ("batalin", "hapus visit-nya", "gak jadi visit") -> WAJIB set cancel_visit:true di update_lead, JANGAN cuma nyatet di progress_note doang. Geser/pindah tanggal (bukan batalin) -> pake updates.visit_date biasa, JANGAN pake cancel_visit.

JANGAN OVER-ISI FIELD: cerita/rencana naratif (misal "minggu depan gua follow up X", "tadi udah ketemu ngobrol harga") CUKUP masuk progress_note. JANGAN otomatis isi next_action/visit_date/field terstruktur lain KECUALI user EKSPLISIT minta itu ("jadwalin visit tanggal...", "set next action jadi..."). Ragu antara catatan vs instruksi jadwalin -> anggap CUMA CATATAN, isi progress_note aja. Lebih baik under-isi daripada over-isi.

User minta update/hapus/tambah/tutup data -> panggil tool sesuai. Nanya kondisi 1 lead -> get_lead_info. Nanya rangkuman/filter banyak lead -> query_leads. Ngobrol biasa yang gak nyangkut data lead -> jawab teks biasa tanpa tool.`;

  const dynamicContext = `Hari ini: ${todayISO()} (YYYY-MM-DD). Ubah tanggal relatif/Indonesia ("besok", "senin depan") jadi format ini. Total lead tercatat: ${leads.length}. Total kompetitor tercatat: ${competitors.length}.`;

  const messages = [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: text }];

  const complexity = await classifyComplexity(text);
  // Sonnet 4.6 -> 5.5 (29 Sep 2026): lebih murah $2/$10 vs $3/$15. Tanpa "mikir di awal"
  // (between_tools) - aman karena cuma 1 panggilan per pesan (tool dieksekusi di
  // server, gak ada loop yang ngirim balik blok thinking).
  const model = complexity === "SIMPLE" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5-5";
  console.log("[route]", complexity, "->", model);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "extended-cache-ttl-2025-04-11",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      ...(model.startsWith("claude-sonnet") ? { thinking: { type: "between_tools" }, output_config: { effort: "medium" } } : {}),
      system: [
        { type: "text", text: staticInstructions, cache_control: { type: "ephemeral", ttl: "1h" } },
        { type: "text", text: dynamicContext },
      ],
      messages,
      tools: TOOLS,
    }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  const dat = await resp.json();
  // USAGE LOGGING (29 Sep 2026) - biar biaya bot per pesan kebaca dari log, bukan perkiraan.
  console.log("[telegram-webhook] USAGE", model, JSON.stringify(dat.usage));
  return dat;
}

Deno.serve(async (req) => {
  let chatId, admin;
  try {

    if (!TELEGRAM_WEBHOOK_SECRET) {
      console.log("[telegram-webhook] FATAL: TELEGRAM_WEBHOOK_SECRET belum di-set - endpoint ditutup total.");
      return new Response("Unauthorized", { status: 401 });
    }
    // SECURITY FIX (audit 16 Sep 2026): fallback ?secret= di URL dihapus -
    // query string webhook ini ke-log sama platform (edge function logs),
    // siapapun yang bisa baca log bisa nemu TELEGRAM_WEBHOOK_SECRET dan
    // forge update Telegram palsu (bisa nge-drive tool write-capable kayak
    // update_lead/close_lead/delete_lead/send_email atas nama user manapun
    // yang chat_id-nya ketebak/udah ke-link). Telegram sendiri udah ngirim
    // secret ini lewat header sejak Bot API 5.4 - fallback query param gak
    // pernah beneran dibutuhin, cuma nambah permukaan bocor doang.
    const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!incomingSecret || incomingSecret !== TELEGRAM_WEBHOOK_SECRET) {
      console.log("[telegram-webhook] Ditolak: secret gak cocok/gak ada.");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const msg = body.message;
    if (!msg) return new Response("ok");
    chatId = msg.chat.id;

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (body.update_id) {
      const { error: dupErr } = await admin.from("telegram_processed_updates").insert({ update_id: body.update_id });
      if (dupErr) {
        if (dupErr.code === "23505") {
          console.log("[dedup] update_id udah pernah diproses, skip:", body.update_id);
          return new Response("ok");
        }
        console.log("[dedup] insert gagal tapi BUKAN duplikat (lanjut proses pesannya):", String(dupErr));
      }
    }

    if (!msg.voice && !msg.text) return new Response("ok");

    if (msg.text) {
      const cmdText = msg.text.trim();
      if (cmdText === "/start") {
        await tgSend(chatId, "Halo! 👋 Kirim */link <kode 6 digit>* dari tab Pengaturan Nexto buat menghubungkan akun Anda.");
        return new Response("ok");
      }

      if (cmdText.startsWith("/link")) {
        const RATE_LIMIT_WINDOW_MIN = 15;
        const MAX_ATTEMPTS = 5;
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60000).toISOString();
        const { count: recentAttempts } = await admin
          .from("link_attempts")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", chatId)
          .gte("attempted_at", windowStart);
        if ((recentAttempts ?? 0) >= MAX_ATTEMPTS) {
          await tgSend(chatId, `⚠️ Terlalu banyak percobaan kode yang gagal. Coba lagi dalam ${RATE_LIMIT_WINDOW_MIN} menit, atau generate kode baru di tab Pengaturan Nexto.`);
          return new Response("ok");
        }

        const code = cmdText.split(" ")[1]?.trim();
        if (!code) { await tgSend(chatId, "Format: /link 123456"); return new Response("ok"); }
        const { data: codeRow } = await admin.from("link_codes").select("*").eq("code", code).eq("used", false).maybeSingle();
        if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
          await admin.from("link_attempts").insert({ chat_id: chatId });
          await tgSend(chatId, "❌ Kode salah atau sudah kedaluwarsa. Generate kode baru di tab Pengaturan Nexto.");
          return new Response("ok");
        }
        await admin.from("telegram_links").upsert({ user_id: codeRow.user_id, chat_id: chatId, username: msg.chat.username || msg.from?.username || "", linked_at: new Date().toISOString() });
        await admin.from("link_codes").update({ used: true }).eq("code", code);
        await tgSend(chatId, 'Berhasil terhubung ke Nexto!\n\nBisa chat teks, ngobrol bebas, minta update/tambah/hapus/tutup data, nanya kondisi lead tertentu atau rangkuman banyak lead sekaligus, atau kirim *voice note* buat rekap meeting - langsung dieksekusi begitu Anda minta (kecuali hapus data, itu bakal ditanya konfirmasi dulu).');
        return new Response("ok");
      }
    }

    const { data: link } = await admin.from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();
    if (!link) {
      await tgSend(chatId, "Akun Telegram Anda belum terhubung. Buka tab *Pengaturan* di Nexto, klik Hubungkan Telegram, lalu kirim kode yang muncul ke sini pakai /link <kode>.");
      return new Response("ok");
    }
    const userId = link.user_id;

    // ---- KONFIRMASI PENDING ACTION - DICEK PALING DULUAN, SEBELUM gate
    // weekday/cap/plan. Historisnya posisi ini dibikin biar Standard bisa
    // approve saran "Rapihin Data" mingguan (fitur itu udah dihapus 16 Sep
    // 2026, lihat catatan di header file). Sekarang cuma nyentuh
    // delete_lead/delete_competitor - dibiarin di posisi ini (bukan
    // restructuring) karena gak ada ruginya. Balesan "ya"/"gak" ini
    // rule-based doang (regex, BUKAN manggil AI). Cuma buat pesan TEKS
    // (bukan voice) - biar gak perlu Whisper (berbayar, tetep Professional+
    // doang) cuma buat baca "ya"/"gak".
    if (msg.text) {
      const { data: earlyPending } = await admin
        .from("pending_actions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (earlyPending && new Date(earlyPending.expires_at) > new Date()) {
        const t = msg.text.trim().toLowerCase();
        // BUG FIX (17 Sep 2026, ketauan pas audit): sebelumnya prefix-match
        // (^kata\b) - pesan biasa yang KEBETULAN diawali salah satu kata ini
        // (misal "Oke, saya mau update PT Y jadi menang juga") kesalah-anggep
        // konfirmasi hapus. Sekarang WAJIB exact match (boleh titik/seru di
        // akhir) - cuma balesan pendek yang beneran cuma "ya"/"gak" dkk yang
        // dianggap konfirmasi.
        const isYes = /^(ya|iya|y|ok|oke|okay|lanjut|gas|betul|benar|yes|sip|jalanin|jalan|go|siap)[.!]?$/.test(t);
        const isNo = /^(gak|nggak|tidak|jangan|batal|no|cancel|skip|nanti|engga|ga jadi)[.!]?$/.test(t);
        if (isYes) {
          // RACE FIX (17 Sep 2026, ketauan pas audit) - delete+execute
          // sebelumnya 2 langkah TERPISAH, jadi 2 konfirmasi nyaris
          // bersamaan (misal teks & voice) bisa dua-duanya baca row yang
          // sama SEBELUM salah satu sempet hapus, dan dua-duanya jalanin
          // executePendingAction (buat delete_competitor yang HARD delete,
          // ini bisa ganda walau hasilnya keliatan "cuma" 2 pesan sukses).
          // Sekarang delete+select dalam 1 request - kalau gak ada row yang
          // kehapus, artinya udah dieksekusi request lain barusan, skip diam-diam.
          const { data: claimed } = await admin.from("pending_actions").delete().eq("id", earlyPending.id).select("id");
          if (!claimed || claimed.length === 0) return new Response("ok");
          const resultMsg = await executePendingAction(admin, earlyPending);
          await tgSend(chatId, resultMsg);
          await saveAssistantReply(admin, userId, resultMsg, "telegram");
          return new Response("ok");
        }
        if (isNo) {
          await admin.from("pending_actions").delete().eq("id", earlyPending.id);
          await tgSend(chatId, "Oke, batal ✋");
          return new Response("ok");
        }
      }
    }

    const dayOfWeek = wibDayOfWeek();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      await tgSend(chatId, "🗓️ NEXA cuma standby Senin-Jumat ya. Sampai ketemu lagi hari kerja berikutnya!");
      return new Response("ok");
    }

    const DAILY_MESSAGE_CAP = 18;
    const MONTHLY_MESSAGE_CAP = 330;
    const todayStart = wibDayStartUTC().toISOString();
    const monthStart = wibMonthStartUTC().toISOString();
    const [{ count: msgCountToday }, { count: msgCountMonth }] = await Promise.all([
      admin.from("chat_messages").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("role", "user").eq("source", "telegram").gte("created_at", todayStart),
      admin.from("chat_messages").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("role", "user").eq("source", "telegram").gte("created_at", monthStart),
    ]);
    if ((msgCountMonth ?? 0) >= MONTHLY_MESSAGE_CAP) {
      await tgSend(chatId, `⚠️ Anda udah kepake jatah ${MONTHLY_MESSAGE_CAP} pesan bulan ini (batas fair-use bulanan). Coba lagi bulan depan ya, atau hubungi admin kalau emang butuh lebih.`);
      return new Response("ok");
    }
    if ((msgCountToday ?? 0) >= DAILY_MESSAGE_CAP) {
      await tgSend(chatId, `⚠️ Anda udah kepake ${DAILY_MESSAGE_CAP} pesan hari ini (batas fair-use harian). Coba lagi besok ya, atau hubungi admin kalau emang butuh lebih.`);
      return new Response("ok");
    }
    const usageFooter = `\n\n📊 _${(msgCountMonth ?? 0) + 1}/${MONTHLY_MESSAGE_CAP} pesan bulan ini_`;

    const { data: memberRow } = await admin.from("organization_members").select("org_id, role").eq("user_id", userId).limit(1).maybeSingle();
    const orgId = memberRow?.org_id || null;
    const myRole = memberRow?.role || "sales_rep";

    const [{ data: settingsRow }, { data: orgRow }] = await Promise.all([
      admin.from("settings").select("plan").eq("user_id", userId).maybeSingle(),
      orgId ? admin.from("organizations").select("plan").eq("id", orgId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const isEnterprise = orgRow?.plan === "enterprise";
    const myPlanLevel = isEnterprise ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (myPlanLevel < 2) {
      await tgSend(chatId, "⚠️ Asisten chat ini fitur khusus paket *Professional* ke atas. Upgrade dulu di tab Pengaturan Nexto ya.");
      return new Response("ok");
    }

    const { data: reservedMsg } = await admin
      .from("chat_messages")
      .insert({ user_id: userId, role: "user", content: msg.voice ? "[voice note]" : (msg.text || "").trim(), source: "telegram" })
      .select("id")
      .single();

    let text;
    if (msg.voice) {
      try {
        text = await transcribeVoice(msg.voice.file_id);
        if (!text) {
          await tgSend(chatId, "⚠️ Ga kedengeran jelas suaranya, coba rekam ulang ya.");
          return new Response("ok");
        }
        await tgSend(chatId, `🎙️ _Transkrip:_ "${text}"`);
        if (reservedMsg?.id) await admin.from("chat_messages").update({ content: text }).eq("id", reservedMsg.id);
      } catch (e) {
        await tgSend(chatId, "⚠️ Gagal transkrip voice note: " + e.message);
        return new Response("ok");
      }
    } else {
      text = msg.text.trim();
    }

    // Konfirmasi via TEKS udah ditangani lebih awal (liat blok di atas, SEBELUM
    // gate weekday/cap/plan) - blok ini SEKARANG cuma buat konfirmasi lewat
    // VOICE NOTE (transkripsinya baru ada di titik ini, setelah plan-gate lolos
    // - voice note emang udah pasti Professional+ doang).
    const { data: pending } = msg.voice
      ? await admin
          .from("pending_actions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (pending && new Date(pending.expires_at) > new Date()) {
      const t = text.toLowerCase().trim();
      // BUG FIX (17 Sep 2026, ketauan pas audit) - exact match, bukan
      // prefix, sama kayak blok konfirmasi TEKS di atas (liat catatan di
      // sana buat alasannya).
      const isYes = /^(ya|iya|y|ok|oke|okay|lanjut|gas|betul|benar|yes|sip|jalanin|jalan|go|siap)[.!]?$/.test(t);
      const isNo = /^(gak|nggak|tidak|jangan|batal|no|cancel|skip|nanti|engga|ga jadi)[.!]?$/.test(t);
      if (isYes) {
        // RACE FIX (17 Sep 2026, ketauan pas audit) - delete+select atomic,
        // sama kayak blok konfirmasi TEKS di atas.
        const { data: claimed } = await admin.from("pending_actions").delete().eq("id", pending.id).select("id");
        if (!claimed || claimed.length === 0) return new Response("ok");
        const resultMsg = await executePendingAction(admin, pending);
        await tgSend(chatId, resultMsg);
        await saveAssistantReply(admin, userId, resultMsg, "telegram");
        return new Response("ok");
      }
      if (isNo) {
        await admin.from("pending_actions").delete().eq("id", pending.id);
        await tgSend(chatId, "Oke, batal ✋");
        return new Response("ok");
      }
      await admin.from("pending_actions").delete().eq("id", pending.id);
    }

    let leadsQuery = admin.from("leads").select("id, name, key_person").is("deleted_at", null).eq("org_id", orgId);
    if (myRole === "sales_rep") leadsQuery = leadsQuery.eq("assigned_to", userId);

    const [{ data: leads }, { data: competitors }] = await Promise.all([
      leadsQuery,
      admin.from("competitors").select("id, name").eq("org_id", orgId),
    ]);

    let dat;
    try { dat = await planTurn(admin, userId, text, leads || [], competitors || []); }
    catch (e) {
      await tgSend(chatId, "⚠️ AI gagal diproses, coba lagi bentar ya.");
      return new Response("ok");
    }

    const toolUse = (dat.content || []).find((b) => b.type === "tool_use");

    if (!toolUse) {
      const replyText = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n") || "Noted.";
      await tgSend(chatId, replyText + usageFooter);
      await saveAssistantReply(admin, userId, replyText, "telegram");
      return new Response("ok");
    }

    const result = await executeTool(admin, userId, orgId, myRole, toolUse.name, toolUse.input, leads || [], competitors || [], isEnterprise);

    if (toolUse.name === "get_lead_info" && result.ok && result.isQuery) {
      let finalText;
      try {
        finalText = await answerLeadQuery(text, result.data);
      } catch (e) {
        finalText = "⚠️ Data ketemu tapi AI gagal ngerangkumnya, coba lagi bentar ya.";
      }
      await tgSend(chatId, finalText + usageFooter);
      await saveAssistantReply(admin, userId, finalText, "telegram");
      return new Response("ok");
    }

    if (toolUse.name === "query_leads" && result.ok && result.isCrmQuery) {
      let finalText;
      try {
        finalText = await answerCrmQuery(text, result.data);
      } catch (e) {
        finalText = "⚠️ Data ketemu tapi AI gagal ngerangkumnya, coba lagi bentar ya.";
      }
      await tgSend(chatId, finalText + usageFooter);
      await saveAssistantReply(admin, userId, finalText, "telegram");
      return new Response("ok");
    }

    await tgSend(chatId, result.msg + usageFooter);
    await saveAssistantReply(admin, userId, result.msg, "telegram");

    return new Response("ok");
  } catch (e) {
    console.log("[fatal]", String(e));
    if (chatId) {
      try { await tgSend(chatId, "⚠️ Ada gangguan teknis pas proses pesan Anda, coba kirim ulang bentar lagi ya."); } catch (_) {}
    }
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
