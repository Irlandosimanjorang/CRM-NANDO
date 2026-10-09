// Supabase Edge Function: mayar-webhook
//
// === BUKU PEMBAYARAN (9 Okt 2026, permintaan Nando) ===
// Tiap pembayaran sukses dengan nominal yang dikenali sekarang dicatat ke tabel
// subscription_payments (email, akun, paket, nominal, durasi, waktu bayar). Dipakai kartu ARUS KAS
// di Command Center untuk kas masuk, MRR, dan margin yang akurat. Pencatatan dibungkus try/catch:
// kegagalan mencatat TIDAK PERNAH menghalangi upgrade paket customer.
// Sumber fungsi ini sebelumnya hanya ada di server; disimpan ke repo mulai 9 Okt 2026.
// Riwayat perubahan sebelumnya (diringkas): tangkap kontak customer, catat nominal tak dikenali
// (mayar_unknown_amounts), paket 3 bulan, early bird, redact secret di log, stacking masa aktif
// (expired baru dihitung dari MAX(sekarang, expired lama)), audit dedupe + pending 28 Sep 2026.
// PENTING: nominal baru WAJIB ditambahkan ke AMOUNT_TO_TIER dan AMOUNT_TO_MONTHS, dan disamakan
// dengan produk di dashboard Mayar. Nominal lama sengaja dipertahankan karena subscriber lama
// masih ditagih nominal lama saat perpanjangan.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAYAR_WEBHOOK_TOKEN = Deno.env.get("MAYAR_WEBHOOK_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AMOUNT_TO_TIER = {
  99000: "standard", // Standard, 1 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2)
  89000: "standard", // Standard, 1 bulan (normal FINAL v2, 22 Sep 2026)
  79000: "standard", // Standard, 1 bulan (normal LAMA - legacy)
  69000: "standard", // Standard, 1 bulan (early bird, 16 Sep 2026 - legacy sejak 22 Sep v2)
  59000: "standard", // Standard, 1 bulan (early bird FINAL v2, 22 Sep 2026)
  76000: "standard", // Standard, 1 bulan (draft 15 Sep 2026, gak jadi dipakai)
  67000: "standard", // Standard, 1 bulan (early bird LAMA - legacy)
  395000: "standard", // Standard, 6 bulan LAMA (legacy)
  297000: "standard", // Standard, 3 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2)
  267000: "standard", // Standard, 3 bulan (normal FINAL v2, 22 Sep 2026 - 89rb x 3)
  228000: "standard", // Standard, 3 bulan (draft 15 Sep 2026, gak jadi dipakai)
  201000: "standard", // Standard, 3 bulan (diskon 15%, harga LAMA - legacy)
  207000: "standard", // Standard, 3 bulan (early bird, 17 Sep 2026 - legacy sejak 22 Sep v2)
  177000: "standard", // Standard, 3 bulan (early bird FINAL v2, 22 Sep 2026 - 59rb x 3)
  299000: "premium", // Professional, 1 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2)
  249000: "premium", // Professional, 1 bulan (normal FINAL v2, 22 Sep 2026)
  329000: "premium", // Professional, 1 bulan (draft 15 Sep 2026, gak jadi dipakai)
  269000: "premium", // Professional, 1 bulan (normal LAMA - legacy)
  259000: "premium", // Professional, 1 bulan (early bird, 16 Sep 2026 - legacy sejak 22 Sep v2)
  229000: "premium", // Professional, 1 bulan (early bird FINAL v2, 22 Sep 2026)
  209000: "premium", // Professional, 1 bulan (early bird v1 22 Sep 2026, gak jadi dipakai/gak sempet dipasang di Mayar)
  279000: "premium", // Professional, 1 bulan (draft 15 Sep 2026, gak jadi dipakai)
  1345000: "premium", // Professional, 6 bulan LAMA (legacy)
  897000: "premium", // Professional, 3 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2)
  747000: "premium", // Professional, 3 bulan (normal FINAL v2, 22 Sep 2026 - 249rb x 3)
  837000: "premium", // Professional, 3 bulan (draft 15 Sep 2026, gak jadi dipakai)
  686000: "premium", // Professional, 3 bulan (diskon 15%, harga LAMA - legacy)
  777000: "premium", // Professional, 3 bulan (early bird, 17 Sep 2026 - legacy sejak 22 Sep v2)
  687000: "premium", // Professional, 3 bulan (early bird FINAL v2, 22 Sep 2026 - 229rb x 3)
  627000: "premium", // Professional, 3 bulan (early bird v1 22 Sep 2026, gak jadi dipakai)
  1356000: "enterprise", // Enterprise, 1 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2, per-orang 339rb x4)
  1116000: "enterprise", // Enterprise, 1 bulan (normal FINAL v2, 22 Sep 2026 - per-orang 279rb x4)
  1590000: "enterprise", // Enterprise, 1 bulan (draft 15 Sep 2026, gak jadi dipakai)
  1300000: "enterprise", // Enterprise, 1 bulan (normal LAMA - legacy)
  1196000: "enterprise", // Enterprise, 1 bulan (early bird, 16 Sep 2026 - legacy sejak 22 Sep, per-orang 299rb x4)
  996000: "enterprise", // Enterprise, 1 bulan (early bird FINAL, 22 Sep 2026 - per-orang 249rb x4, v1 & v2 sama)
  1350000: "enterprise", // Enterprise, 1 bulan (draft 15 Sep 2026, gak jadi dipakai)
  1105000: "enterprise", // Enterprise, 1 bulan (early bird LAMA - legacy)
  6500000: "enterprise", // Enterprise, 6 bulan LAMA (legacy)
  4068000: "enterprise", // Enterprise, 3 bulan (normal, 16 Sep 2026 - legacy sejak 22 Sep v2)
  3348000: "enterprise", // Enterprise, 3 bulan (normal FINAL v2, 22 Sep 2026 - 1.116jt x 3)
  4050000: "enterprise", // Enterprise, 3 bulan (draft 15 Sep 2026, gak jadi dipakai)
  3588000: "enterprise", // Enterprise, 3 bulan (early bird, 16 Sep 2026 - legacy sejak 22 Sep)
  2988000: "enterprise", // Enterprise, 3 bulan (early bird FINAL, 22 Sep 2026 - 996rb x 3, v1 & v2 sama)
  3315000: "enterprise", // Enterprise, 3 bulan (diskon 15%, harga LAMA - legacy)
};

// Tiap nominal dipetakan ke durasinya (bulan) untuk menghitung plan_expires_at.
const AMOUNT_TO_MONTHS = {
  99000: 1,
  89000: 1,
  79000: 1,
  69000: 1,
  59000: 1,
  76000: 1,
  67000: 1,
  395000: 6,
  297000: 3,
  267000: 3,
  228000: 3,
  201000: 3,
  207000: 3,
  177000: 3,
  299000: 1,
  249000: 1,
  329000: 1,
  269000: 1,
  259000: 1,
  229000: 1,
  209000: 1,
  279000: 1,
  1345000: 6,
  897000: 3,
  747000: 3,
  837000: 3,
  686000: 3,
  777000: 3,
  687000: 3,
  627000: 3,
  1356000: 1,
  1116000: 1,
  1590000: 1,
  1300000: 1,
  1196000: 1,
  996000: 1,
  1350000: 1,
  1105000: 1,
  6500000: 6,
  4068000: 3,
  3348000: 3,
  4050000: 3,
  3588000: 3,
  2988000: 3,
  3315000: 3,
};

// STACKING (16 Sep 2026): kalau expired lama masih di masa depan, durasi baru ditambahkan di atasnya.
function addMonthsISO(months, currentExpiresAt) {
  const now = new Date();
  const currentExpiry = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

function isPaidEventName(event) {
  return (
    event.includes("newmemberregistered") ||
    event.includes("changetiermemberregistered") ||
    event.includes("payment") ||
    event.includes("paid")
  );
}
function isExpiredEventName(event) {
  return (
    event.includes("memberexpired") ||
    event.includes("memberunsubscribed") ||
    event.includes("expired") ||
    event.includes("unsubscribe") ||
    event.includes("cancel") ||
    event.includes("inactive")
  );
}

function isSuccessStatus(status) {
  if (typeof status === "boolean") return status === true;
  const s = String(status ?? "").toUpperCase();
  return ["SUCCESS", "PAID", "SETTLED", "ACTIVE", "TRUE"].includes(s);
}

// ---- NOMOR WA/HP CUSTOMER (8 Sep 2026) ----
function extractPhone(data, body) {
  return (
    data?.customerMobile || data?.customerPhone || data?.mobile || data?.phone ||
    data?.whatsapp || data?.customer?.mobile || data?.customer?.phone ||
    data?.customer?.whatsapp || body?.mobile || body?.phone || null
  );
}

// ---- REDACT SECRET SEBELUM DI-LOG (11 Sep 2026) ----
const SENSITIVE_KEY_RE = /token|signature|authorization|secret/i;
function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) { out[k] = "[redacted]"; continue; }
    out[k] = v && typeof v === "object" ? redact(v) : v;
  }
  return out;
}

async function getAllUsers() {
  let allUsers = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[mayar-webhook] listUsers GAGAL di halaman", page, ":", String(error));
      break;
    }
    const batch = data?.users || [];
    allUsers = allUsers.concat(batch);
    if (batch.length < perPage) break;
    page++;
    if (page > 50) { console.error("[mayar-webhook] listUsers berhenti di halaman 50 (safety net)"); break; }
  }
  return allUsers;
}

// Antre pembayaran yang akunnya belum ada (28 Sep 2026): `months` di-SUM kalau email yang sama
// sudah punya baris pending, supaya pembayaran kedua tidak menimpa yang pertama.
async function queuePending({ emailLower, tier, amount, phone, customerName, durationMonths }) {
  const addMonths = durationMonths || 1;
  const { data: existing } = await admin.from("pending_mayar_upgrades").select("tier, months").eq("email", emailLower).maybeSingle();
  if (existing && existing.tier !== tier) {
    console.error(`[mayar-webhook] ${emailLower} punya pending ${existing.tier} DAN bayar lagi ${tier} sebelum akunnya ada - durasi di-SUM, tier ikut yang terbaru (${tier}). Cek manual kalau perlu.`);
  }
  const months = (existing ? (existing.months || 1) : 0) + addMonths;
  const { error } = await admin.from("pending_mayar_upgrades").upsert({ email: emailLower, tier, amount, months, phone, customer_name: customerName, created_at: new Date().toISOString() });
  if (error) console.error("Gagal nyimpen pending_mayar_upgrades:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let dedupeEventId = null;

  try {
    const body = await req.json().catch(() => ({}));
    console.log("Mayar webhook masuk:", JSON.stringify(redact(body)));

    const headerToken =
      req.headers.get("x-callback-token") ||
      req.headers.get("x-webhook-token") ||
      req.headers.get("mayar-signature") ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const bodyToken = body?.token;
    const incomingToken = headerToken || bodyToken;

    if (!MAYAR_WEBHOOK_TOKEN || incomingToken !== MAYAR_WEBHOOK_TOKEN) {
      console.error("Token webhook gak cocok - ditolak. Header yang diterima:", JSON.stringify(redact(Object.fromEntries(req.headers))));
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const event = (body?.event || body?.type || "").toString().toLowerCase();
    const data = body?.data || body;
    const email = data?.customerEmail || data?.email || data?.customer?.email || data?.buyerEmail || data?.customer_email;
    const amount = Number(data?.amount ?? body?.amount ?? 0);
    const phone = extractPhone(data, body);
    const customerName = data?.customerName || data?.name || data?.customer?.name || null;

    const eventId = data?.id || body?.id || null;
    if (eventId) {
      const { error: dupErr } = await admin.from("mayar_processed_events").insert({ event_id: String(eventId) });
      if (dupErr) {
        if (dupErr.code === "23505") {
          console.log(`[mayar-webhook] duplikat/replay - event_id ${eventId} udah pernah diproses, di-skip.`);
          return new Response(JSON.stringify({ ok: true, note: "duplicate event, already processed" }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        console.error("[mayar-webhook] gagal nyatet mayar_processed_events (lanjut proses tanpa dedupe):", dupErr);
      } else {
        dedupeEventId = String(eventId);
      }
    } else {
      console.error("[mayar-webhook] payload gak punya field id - gak bisa di-dedupe, resiko diproses dobel kalau Mayar retry.");
    }

    if (!email) {
      console.error("Gak nemu field email di payload webhook ini.");
      return new Response(JSON.stringify({ ok: true, note: "no email in payload" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const emailLower = email.toLowerCase();

    const isExpiredEvent = isExpiredEventName(event);
    const isPaidEvent = !isExpiredEvent && (isPaidEventName(event) || isSuccessStatus(data?.status ?? body?.status));
    const tier = AMOUNT_TO_TIER[amount];
    const durationMonths = AMOUNT_TO_MONTHS[amount] || null;

    const usersList = await getAllUsers();
    const matchedUser = usersList.find((u) => (u.email || "").toLowerCase() === emailLower);

    // BUKU PEMBAYARAN (9 Okt 2026): catat pembayaran sukses. Gagal mencatat tidak boleh menghalangi upgrade.
    if (isPaidEvent && tier) {
      try {
        const { error: ledgerErr } = await admin.from("subscription_payments").insert({
          event_id: eventId ? String(eventId) : null, email: emailLower, user_id: matchedUser?.id || null,
          tier, amount, months: durationMonths || 1, paid_at: new Date().toISOString(), source: "mayar",
        });
        if (ledgerErr && ledgerErr.code !== "23505") console.error("[mayar-webhook] gagal nyatet subscription_payments:", ledgerErr);
      } catch (ledgerEx) {
        console.error("[mayar-webhook] exception nyatet subscription_payments:", ledgerEx);
      }
    }

    if (isPaidEvent && !tier) {
      const { error: logErr } = await admin.from("mayar_unknown_amounts").insert({
        email: emailLower, amount, event, matched_user: !!matchedUser,
      });
      if (logErr) console.error("[mayar-webhook] gagal nyatet mayar_unknown_amounts:", logErr);
    }

    if (!matchedUser) {
      if (isPaidEvent && tier) {
        await queuePending({ emailLower, tier, amount, phone, customerName, durationMonths });
        console.log(`Pembayaran dari ${emailLower} (${tier}, Rp${amount}, HP: ${phone || "-"}) disimpen sbg PENDING - belum ada akun Nexto dengan email ini. Bakal otomatis di-apply begitu akunnya dibuat/login.`);
      } else {
        console.error(`Ada webhook dari ${emailLower} tapi gak ketemu akun Nexto DAN bukan paid-event dgn nominal dikenal - diabaikan.`);
      }
      return new Response(JSON.stringify({ ok: true, note: "user not found, queued as pending" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    await admin.from("pending_mayar_upgrades").delete().eq("email", emailLower);

    if (isPaidEvent) {
      if (!tier) {
        console.error(`Pembayaran dari ${email} sebesar Rp${amount} - nominal ini GAK DIKENALI di AMOUNT_TO_TIER (kode di mayar-webhook.ts). Kemungkinan harga di Mayar berubah tapi kode belum diupdate, atau ada diskon/promo yang bikin nominal beda. User TIDAK di-upgrade otomatis - perlu diupgrade manual dulu sampai mapping ini diperbaiki.`);
        return new Response(JSON.stringify({ ok: true, note: "unknown amount, needs manual upgrade", amount, email }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (tier === "enterprise") {
        const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", matchedUser.id).limit(1).maybeSingle();
        if (memberRow) {
          const { data: orgRow } = await admin.from("organizations").select("plan_expires_at").eq("id", memberRow.org_id).maybeSingle();
          const expiresAtISO = durationMonths ? addMonthsISO(durationMonths, orgRow?.plan_expires_at) : null;
          const { error } = await admin.from("organizations").update({ plan: "enterprise", member_limit: 4, plan_expires_at: expiresAtISO, plan_expiry_reminder_sent_at: null }).eq("id", memberRow.org_id);
          if (error) throw error;
          console.log(`${email} - organisasinya (${memberRow.org_id}) berhasil di-upgrade ke Enterprise, expire ${expiresAtISO} (base lama: ${orgRow?.plan_expires_at || "-"}).`);
        } else {
          await queuePending({ emailLower, tier, amount, phone, customerName, durationMonths });
          console.error(`${email} bayar Enterprise (Rp${amount}) tapi organisasinya belum kebentuk. Disimpen sbg pending, bakal ke-apply pas dia buka app.`);
        }
      } else {
        const { data: settingsRow } = await admin.from("settings").select("plan_expires_at").eq("user_id", matchedUser.id).maybeSingle();
        const expiresAtISO = durationMonths ? addMonthsISO(durationMonths, settingsRow?.plan_expires_at) : null;
        const { error } = await admin.from("settings").update({ plan: tier, plan_expires_at: expiresAtISO, plan_expiry_reminder_sent_at: null }).eq("user_id", matchedUser.id);
        if (error) throw error;
        console.log(`${email} berhasil di-upgrade ke ${tier} (bayar Rp${amount}), expire ${expiresAtISO} (base lama: ${settingsRow?.plan_expires_at || "-"}).`);
      }
    } else if (isExpiredEvent) {
      const { error } = await admin.from("settings").update({ plan: null, plan_expires_at: null, plan_expiry_reminder_sent_at: null }).eq("user_id", matchedUser.id);
      if (error) throw error;
      console.log(`${email} di-downgrade ke free (langganan berakhir/dibatalkan).`);

      const { data: memberRowExp } = await admin.from("organization_members").select("org_id").eq("user_id", matchedUser.id).limit(1).maybeSingle();
      if (memberRowExp) {
        const { data: orgRowExp } = await admin.from("organizations").select("plan").eq("id", memberRowExp.org_id).maybeSingle();
        if (orgRowExp?.plan === "enterprise") {
          const { error: orgErr } = await admin.from("organizations").update({ plan: null, plan_expires_at: null, plan_expiry_reminder_sent_at: null, member_limit: 1 }).eq("id", memberRowExp.org_id);
          if (orgErr) console.error(`Gagal downgrade organisasi (${memberRowExp.org_id}) abis Enterprise expired:`, orgErr);
          else console.log(`Organisasi ${memberRowExp.org_id} ikut di-downgrade dari Enterprise (dipicu expired-nya ${email}).`);
        }
      }
    } else {
      console.log(`Event "${event}" (amount: ${amount}) diterima tapi gak dianggap paid/expired, gak ada aksi.`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error di mayar-webhook:", e);
    // Rollback dedupe (audit 28 Sep 2026): proses gagal -> event_id HARUS dilepas lagi, kalau enggak
    // retry dari Mayar dianggap duplikat & di-skip (customer udah bayar tapi gak pernah ke-upgrade).
    if (dedupeEventId) {
      try {
        const { error: rbErr } = await admin.from("mayar_processed_events").delete().eq("event_id", dedupeEventId);
        if (rbErr) console.error("[mayar-webhook] gagal rollback mayar_processed_events:", rbErr);
      } catch (rbEx) {
        console.error("[mayar-webhook] exception pas rollback mayar_processed_events:", rbEx);
      }
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
