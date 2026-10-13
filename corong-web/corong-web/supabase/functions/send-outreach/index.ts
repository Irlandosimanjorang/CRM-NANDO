// Supabase Edge Function: send-outreach (13 Okt 2026, permintaan Nando)
// Kirim email perkenalan Nexto ke daftar perusahaan dari Command Center (kartu EMAIL OUTREACH) dengan satu klik.
// Hanya ADMIN_EMAIL. Pengirim lewat Resend: gambar Dashboard, Team, dan Report tampil langsung di badan email.
//
// Body: { action: "list" }                                   -> ringkasan + 30 pengiriman terakhir
//       { action: "test", to? }                              -> kirim satu email contoh (tidak dicatat), default ke email admin
//       { action: "send", recipients: [{ email, nama, perusahaan }] }
//                                                            -> kirim ke tiap alamat yang belum pernah dikirimi
//       { action: "unsubscribe", email }                     -> tandai berhenti, tidak akan dikirimi lagi
//
// Pengaman: batas kirim per hari (DAILY_CAP, hari WIB), alamat yang sudah dikirimi atau berhenti dilewati
// (tabel outreach_log, unik per alamat), jeda antar email, dan email diberi Reply-To ke Gmail Nando dan header
// List-Unsubscribe. Variabel lingkungan opsional: OUTREACH_FROM, OUTREACH_REPLY_TO.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("OUTREACH_FROM") || "Irlando Simanjorang <irlando@nexto.site>";
const REPLY_TO = Deno.env.get("OUTREACH_REPLY_TO") || "simanjorangirlando@gmail.com";

const DAILY_CAP = 40;
const MAX_PER_CALL = 40;
const DELAY_MS = 700;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const clean = (s: unknown, max = 120) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildEmail(nama: string, perusahaan: string) {
  const sapaan = nama ? `Yth. Bapak/Ibu ${esc(nama)},` : `Yth. Tim Sales ${esc(perusahaan) || "Anda"},`;
  const sapaanText = nama ? `Yth. Bapak/Ibu ${nama},` : `Yth. Tim Sales ${perusahaan || "Anda"},`;
  const subject = perusahaan ? `Apa saja yang dikerjakan tim sales ${perusahaan} hari ini?` : "Apa saja yang dikerjakan tim sales Anda hari ini?";
  const img = (file: string, alt: string, href: string) =>
    `<a href="${href}"><img src="https://nexto.site/email/${file}" width="560" alt="${alt}" style="max-width:100%;height:auto;border:1px solid #e5e7eb;"></a>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:640px;">
<p>${sapaan}</p>
<p>Saya Irlando dari Nexto, AI Sales Loop Engine untuk perusahaan dengan tim sales lapangan.</p>
<p>Kendala yang sering kami dengar dari pimpinan sales: progres tim baru diketahui saat rapat mingguan, laporan kunjungan sulit diverifikasi, dan lead yang terlewat baru ketahuan setelah klien pindah ke kompetitor.</p>
<p>Nexto menjawabnya dengan satu alur dari lead sampai pembayaran, dan satu layar untuk melihat seluruh tim.</p>
<p><b>Coba langsung demonya, tanpa daftar:</b><br><a href="https://nexto.site/demo" style="color:#ea580c;font-weight:bold;">https://nexto.site/demo</a><br><span style="font-size:13px;color:#6b7280;">Data di dalamnya contoh.</span></p>
<p><b>Dashboard</b> &ndash; rekomendasi lead prioritas setiap pagi dan ringkasan pipeline Anda.<br>${img("demo-dashboard.png", "Dashboard Nexto", "https://nexto.site/demo?tab=dashboard")}<br><a href="https://nexto.site/demo?tab=dashboard" style="color:#ea580c;">Buka Dashboard di demo</a></p>
<p><b>Dashboard Tim</b> &ndash; siapa yang aktif, siapa yang tidak, dan posisi setiap sales terhadap target, dalam satu layar.<br>${img("demo-team.png", "Dashboard Tim Nexto", "https://nexto.site/demo?tab=team")}<br><a href="https://nexto.site/demo?tab=team" style="color:#ea580c;">Buka Dashboard Tim di demo</a></p>
<p><b>Report penjualan</b> &ndash; omzet, target versus capaian, forecast, dan hasil tiap marketing, otomatis tanpa rekap manual.<br>${img("demo-report.png", "Report Nexto", "https://nexto.site/demo?tab=report")}<br><a href="https://nexto.site/demo?tab=report" style="color:#ea580c;">Buka Report di demo</a></p>
<p>Di balik layar itu, Nexto bekerja dengan dua hal:</p>
<p><b>1. Sales Loop Engine.</b> Satu alur yang dibantu AI, dari mencari calon klien, menyusun draf follow-up, check-in kunjungan dengan foto yang diverifikasi, mencatat progres cukup lewat pesan suara, sampai deal dan termin pembayaran.</p>
<p><b>2. Dashboard Tim.</b> Owner dan manajer melihat apa yang dikerjakan setiap sales hari ini, dan lead yang mulai terbengkalai ditandai otomatis. Laporan tim terkirim setiap minggu.</p>
<p>Nexto sudah digunakan oleh <b>Kestone Indonesia, INDO uPVC, MAP</b>, dan perusahaan lain di bidang manufaktur, distribusi, dan jasa.</p>
<p>Apakah Bapak/Ibu berkenan meluangkan 20 menit minggu ini untuk demo singkat via Google Meet? Cukup balas email ini dengan waktu yang sesuai, atau hubungi saya di WhatsApp 0822-7914-2894.</p>
<p>Hormat saya,<br><b>Irlando Simanjorang</b><br>Founder, Nexto<br>0822-7914-2894 | <a href="https://nexto.site" style="color:#ea580c;">nexto.site</a></p>
<p style="font-size:12px;color:#9ca3af;">Jika Bapak/Ibu tidak ingin menerima email dari kami, cukup balas dengan "berhenti".</p>
</div>`;
  const text = `${sapaanText}

Saya Irlando dari Nexto, AI Sales Loop Engine untuk perusahaan dengan tim sales lapangan.

Kendala yang sering kami dengar dari pimpinan sales: progres tim baru diketahui saat rapat mingguan, laporan kunjungan sulit diverifikasi, dan lead yang terlewat baru ketahuan setelah klien pindah ke kompetitor.

Nexto menjawabnya dengan satu alur dari lead sampai pembayaran, dan satu layar untuk melihat seluruh tim.

Coba langsung demonya, tanpa daftar: https://nexto.site/demo
Dashboard: https://nexto.site/demo?tab=dashboard
Dashboard Tim: https://nexto.site/demo?tab=team
Report: https://nexto.site/demo?tab=report

Nexto sudah digunakan oleh Kestone Indonesia, INDO uPVC, MAP, dan perusahaan lain di bidang manufaktur, distribusi, dan jasa.

Apakah Bapak/Ibu berkenan meluangkan 20 menit minggu ini untuk demo singkat via Google Meet? Cukup balas email ini dengan waktu yang sesuai, atau hubungi saya di WhatsApp 0822-7914-2894.

Hormat saya,
Irlando Simanjorang
Founder, Nexto
0822-7914-2894 | nexto.site

Jika Bapak/Ibu tidak ingin menerima email dari kami, cukup balas dengan "berhenti".`;
  return { subject, html, text };
}

async function sendOne(to: string, nama: string, perusahaan: string, subjectPrefix = "") {
  const mail = buildEmail(nama, perusahaan);
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: REPLY_TO, subject: subjectPrefix + mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=berhenti>` },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, error: String(data?.message || data?.error || `Resend ${resp.status}`).slice(0, 200), id: null };
  return { ok: true, error: null, id: (data?.id as string) || null };
}

function wibDayStartISO() {
  const wib = new Date(Date.now() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat mengirim email outreach." }, 403);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY belum diatur." }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    const summary = async () => {
      const since = wibDayStartISO();
      const [{ count: today }, { count: total }, { count: unsub }, { data: recent }] = await Promise.all([
        admin.from("outreach_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", since),
        admin.from("outreach_log").select("id", { count: "exact", head: true }).eq("status", "sent"),
        admin.from("outreach_log").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
        admin.from("outreach_log").select("email, nama, perusahaan, status, error, created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      return { sent_today: today || 0, total_sent: total || 0, unsubscribed: unsub || 0, daily_cap: DAILY_CAP, from: FROM, reply_to: REPLY_TO, recent: recent || [] };
    };

    if (body.action === "list") return json(await summary());

    if (body.action === "test") {
      const to = clean(body.to || userData.user.email, 200).toLowerCase();
      if (!EMAIL_RE.test(to)) return json({ error: "Alamat email uji tidak valid." }, 400);
      const r = await sendOne(to, "Budi", "PT Contoh Maju", "[UJI] ");
      if (!r.ok) return json({ error: `Gagal mengirim email uji: ${r.error}` }, 502);
      return json({ ok: true, to });
    }

    if (body.action === "unsubscribe") {
      const email = clean(body.email, 200).toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ error: "Alamat email tidak valid." }, 400);
      const { error } = await admin.from("outreach_log").upsert({ email, status: "unsubscribed" }, { onConflict: "email" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "send") {
      const raw = Array.isArray(body.recipients) ? body.recipients.slice(0, 500) : [];
      const seen = new Set<string>();
      const list: { email: string; nama: string; perusahaan: string }[] = [];
      const invalid: string[] = [];
      for (const r of raw) {
        const email = clean(r?.email, 200).toLowerCase();
        if (!EMAIL_RE.test(email)) { invalid.push(email || "(kosong)"); continue; }
        if (seen.has(email)) continue;
        seen.add(email);
        list.push({ email, nama: clean(r?.nama), perusahaan: clean(r?.perusahaan) });
      }
      if (list.length === 0) return json({ error: "Tidak ada alamat email yang valid.", invalid }, 400);

      // Alamat yang sudah dikirimi atau berhenti dilewati.
      const { data: known } = await admin.from("outreach_log").select("email, status").in("email", list.map((x) => x.email));
      const knownMap = new Map((known || []).map((k) => [String(k.email).toLowerCase(), k.status]));
      const skipped = list.filter((x) => knownMap.get(x.email) === "sent" || knownMap.get(x.email) === "unsubscribed").map((x) => ({ email: x.email, alasan: knownMap.get(x.email) === "sent" ? "sudah pernah dikirimi" : "berhenti" }));
      const todo = list.filter((x) => !skipped.some((s) => s.email === x.email));

      const { count: sentToday } = await admin.from("outreach_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", wibDayStartISO());
      const room = Math.max(0, Math.min(DAILY_CAP - (sentToday || 0), MAX_PER_CALL));
      const batch = todo.slice(0, room);
      const deferred = todo.slice(room).map((x) => x.email);

      const sent: string[] = [];
      const failed: { email: string; error: string }[] = [];
      for (const r of batch) {
        const res = await sendOne(r.email, r.nama, r.perusahaan);
        await admin.from("outreach_log").upsert(
          { email: r.email, nama: r.nama, perusahaan: r.perusahaan, status: res.ok ? "sent" : "failed", error: res.error, resend_id: res.id },
          { onConflict: "email" },
        );
        if (res.ok) sent.push(r.email); else failed.push({ email: r.email, error: res.error || "gagal" });
        await sleep(DELAY_MS);
      }
      return json({ ok: true, sent: sent.length, failed, skipped, deferred, invalid, daily_cap: DAILY_CAP, sent_today: (sentToday || 0) + sent.length });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.log("[send-outreach] error", String(e));
    return json({ error: String(e) }, 500);
  }
});
