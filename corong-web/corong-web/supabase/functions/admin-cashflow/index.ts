// Supabase Edge Function: admin-cashflow
// Kartu CASH FLOW di Command Center (9 Okt 2026, permintaan Nando): laporan keuangan bulanan
// (laba rugi, arus kas metode langsung, posisi keuangan ringkas), rekonsiliasi saldo prabayar
// Anthropic, dan status saldo token live. Hanya admin platform (cek ADMIN_EMAIL).
//
// Body: { action: "get", period?: "YYYY-MM" }  -> laporan lengkap satu bulan (default bulan berjalan, WIB)
//       { action: "balance" }                  -> status saldo token Anthropic (ringan, di-poll tiap beberapa detik)
//       { action: "save", settings }           -> simpan pengaturan (admin_settings, key "cashflow")
//
// PRINSIP AKUNTANSI (mengacu PSAK 72 pengakuan pendapatan dan PSAK 10 kurs valuta asing):
//  - Pendapatan diakui bertahap per hari sepanjang periode layanan (bukan saat uang masuk). Uang yang
//    sudah diterima tetapi layanan belum berjalan = pendapatan diterima di muka (liabilitas).
//  - Token Anthropic yang dibeli adalah aset prabayar. Beban pokok pendapatan (HPP) = pemakaian,
//    dinilai dengan biaya rata-rata tertimbang (weighted average) dari saldo prabayar. Pembelian token
//    muncul sebagai kas keluar di laporan arus kas pada tanggal top-up.
//  - Transaksi USD dicatat pada kurs tanggal transaksi (kurs historis ECB via frankfurter.dev). Pembelian
//    token memakai nominal Rupiah yang benar-benar dibayar bila diisi.
//  - Semua angka Rupiah dibulatkan per baris; subtotal dan total adalah penjumlahan baris yang tampil,
//    sehingga laporan selalu cocok (foot) tanpa selisih pembulatan.
// BATASAN: pajak (PPN/PPh), penyusutan, dan gaji tidak dihitung kecuali ditambahkan sebagai biaya tetap.
// Biaya tetap diasumsikan sama tiap bulan dan dibayar pada bulan yang sama.
//
// Saldo Anthropic TIDAK bisa dibaca lewat API (kredit prabayar tidak diekspos): dihitung dari saldo
// patokan (diisi dari Console) + top-up - biaya AI di tabel ai_usage. Hanya pemakaian lewat Nexto tercatat.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const wibDateOf = (iso: string) => new Date(new Date(iso).getTime() + 7 * HOUR_MS).toISOString().slice(0, 10);
const wibToday = () => wibDateOf(new Date().toISOString());
const startOfWibDay = (d: string) => new Date(`${d}T00:00:00+07:00`).toISOString();
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY_MS);
const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const R = (x: number) => Math.round(x);
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const pct = (x: number, base: number) => (base > 0 ? Math.round(x / base * 1000) / 10 : null);

// Tanggal "YYYY-MM-DD" + m bulan (kalender).
function addMonthsDate(dateStr: string, m: number) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return wibDateOf(d.toISOString());
}
const monthOf = (d: string) => d.slice(0, 7);
const firstOfNext = (ym: string) => addMonthsDate(`${ym}-01`, 1);
const prevMonth = (ym: string) => monthOf(addMonthsDate(`${ym}-01`, -1));
const lastDayBefore = (d: string) => wibDateOf(new Date(Date.parse(`${d}T00:00:00+07:00`) - 1).toISOString());
function monthsBetween(fromYm: string, toYm: string) {
  const out: string[] = [];
  for (let ym = fromYm, i = 0; ym <= toYm && i < 120; ym = monthOf(firstOfNext(ym)), i++) out.push(ym);
  return out;
}

const DEFAULT_SETTINGS = {
  kurs: 17700, // dipakai bila kurs otomatis dimatikan, atau sebagai cadangan bila sumber kurs tidak dapat dihubungi
  kurs_auto: true,
  token_pct: 25,
  anthropic: { checkpoint_date: null as string | null, balance_usd: 0 },
  topups: [] as { id: string; date: string; amount_usd: number; amount_idr: number | null; note: string }[],
  costs: [] as { id: string; name: string; currency: string; amount: number; kind: string }[],
  cash_opening: { month: null as string | null, amount_idr: 0 },
};
// Harga katalog per pengguna per bulan (sama dengan Auth.jsx): early bird sampai 15 Okt 2026, setelah itu normal.
const EARLY = new Date() < new Date("2026-10-15T23:59:59+07:00");
const CATALOG_PRICE = { standard: EARLY ? 59000 : 89000, professional: EARLY ? 229000 : 249000 };

function cleanSettings(src: any) {
  const s = src || {};
  const kurs = Math.min(100000, Math.max(1000, num(s.kurs, DEFAULT_SETTINGS.kurs)));
  const token_pct = Math.min(100, Math.max(1, num(s.token_pct, DEFAULT_SETTINGS.token_pct)));
  const cp = s.anthropic || {};
  const anthropic = {
    checkpoint_date: DATE_RE.test(cp.checkpoint_date || "") ? cp.checkpoint_date : null,
    balance_usd: Math.max(0, num(cp.balance_usd)),
  };
  const topups = (Array.isArray(s.topups) ? s.topups : []).slice(0, 500)
    .filter((t: any) => DATE_RE.test(t?.date || "") && num(t.amount_usd) > 0)
    .map((t: any) => ({
      id: String(t.id || crypto.randomUUID()).slice(0, 64), date: t.date, amount_usd: r4(num(t.amount_usd)),
      amount_idr: t.amount_idr !== null && t.amount_idr !== undefined && t.amount_idr !== "" && num(t.amount_idr) > 0 ? R(num(t.amount_idr)) : null,
      note: String(t.note || "").slice(0, 200),
    }));
  const costs = (Array.isArray(s.costs) ? s.costs : []).slice(0, 100)
    .filter((c: any) => String(c?.name || "").trim() && num(c.amount ?? c.amount_idr) >= 0)
    .map((c: any) => {
      const currency = c.currency === "USD" ? "USD" : "IDR";
      const amount = num(c.amount ?? c.amount_idr);
      return {
        id: String(c.id || crypto.randomUUID()).slice(0, 64), name: String(c.name).trim().slice(0, 100),
        currency, amount: currency === "USD" ? Math.round(amount * 100) / 100 : R(amount),
        kind: c.kind === "opex" ? "opex" : "hpp", // hpp = biaya penyedia layanan (Supabase, Vercel), opex = beban lain
      };
    });
  const sp = s.sub_price || {};
  const sub_price = {
    standard: Math.max(0, R(num(sp.standard, CATALOG_PRICE.standard))),
    professional: Math.max(0, R(num(sp.professional, CATALOG_PRICE.professional))),
  };
  const co = s.cash_opening || {};
  const cash_opening = { month: YM_RE.test(co.month || "") ? co.month : null, amount_idr: R(num(co.amount_idr)) };
  return { kurs, kurs_auto: s.kurs_auto !== false, token_pct, anthropic, topups, costs, sub_price, cash_opening };
}

// ---------- KURS ----------
// Kurs terkini: disimpan di admin_settings ("fx_usd_idr"), diperbarui paling cepat tiap 6 jam.
const FX_SOURCES: [string, string, (j: any) => unknown][] = [
  ["open.er-api.com", "https://open.er-api.com/v6/latest/USD", (j) => j?.rates?.IDR],
  ["frankfurter.dev", "https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", (j) => j?.rates?.IDR],
];
async function getFxRate(admin: any) {
  const { data } = await admin.from("admin_settings").select("value").eq("key", "fx_usd_idr").maybeSingle();
  const cached = data?.value;
  if (cached?.rate && Date.now() - new Date(cached.fetched_at).getTime() < 6 * HOUR_MS) return { ...cached, stale: false };
  for (const [source, url, pick] of FX_SOURCES) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const rate = Number(pick(await r.json()));
      if (rate > 1000 && rate < 100000) {
        const v = { rate: R(rate), source, fetched_at: new Date().toISOString() };
        await admin.from("admin_settings").upsert({ key: "fx_usd_idr", value: v, updated_at: v.fetched_at });
        return { ...v, stale: false };
      }
    } catch (_) { /* coba sumber berikutnya */ }
  }
  return cached?.rate ? { ...cached, stale: true } : null;
}

// Kurs harian historis (ECB via frankfurter.dev), disimpan di admin_settings ("fx_history").
// rateOn(tanggal) = kurs hari bisnis terakhir sebelum/pada tanggal itu (akhir pekan memakai kurs Jumat).
async function loadRateOn(admin: any, auto: boolean, manual: number, spot: number | null, fromDate: string, today: string) {
  const fallback = spot ?? manual;
  if (!auto) return { rateOn: (_d: string) => manual, historical: false };
  const { data } = await admin.from("admin_settings").select("value").eq("key", "fx_history").maybeSingle();
  const cache = data?.value || {};
  let rates: Record<string, number> = cache.rates || {};
  const fresh = cache.fetched_at && Date.now() - new Date(cache.fetched_at).getTime() < 6 * HOUR_MS;
  const covers = cache.from && cache.from <= fromDate;
  if (!(fresh && covers)) {
    const start = cache.from && cache.from < fromDate ? cache.from : fromDate;
    try {
      const r = await fetch(`https://api.frankfurter.dev/v1/${start}..${today}?base=USD&symbols=IDR`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const j = await r.json();
        const next: Record<string, number> = { ...rates };
        for (const [d, v] of Object.entries(j?.rates || {})) { const x = Number((v as any)?.IDR); if (x > 1000 && x < 100000) next[d] = x; }
        rates = next;
        await admin.from("admin_settings").upsert({ key: "fx_history", value: { rates, from: start, fetched_at: new Date().toISOString() }, updated_at: new Date().toISOString() });
      }
    } catch (_) { /* pakai cache bila ada */ }
  }
  const keys = Object.keys(rates).sort();
  const rateOn = (d: string) => {
    if (!keys.length) return fallback;
    let lo = 0, hi = keys.length - 1, hit = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid] <= d) { hit = mid; lo = mid + 1; } else hi = mid - 1; }
    return rates[keys[hit >= 0 ? hit : 0]];
  };
  return { rateOn, historical: keys.length > 0 };
}

// Semua baris ai_usage sejak tanggal tertentu (dipaginasi 1000/halaman).
async function fetchAiUsage(admin: any, sinceIso: string) {
  const rows: { user_id: string | null; cost_usd: number; created_at: string }[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await admin.from("ai_usage").select("user_id, cost_usd, created_at")
      .gte("created_at", sinceIso).order("created_at", { ascending: true }).range(from, from + 999);
    if (error) throw error;
    for (const r of data || []) rows.push({ user_id: r.user_id, cost_usd: num(r.cost_usd), created_at: r.created_at });
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function loadSettings(admin: any) {
  const { data, error } = await admin.from("admin_settings").select("value").eq("key", "cashflow").maybeSingle();
  if (error) throw error;
  return cleanSettings({ ...DEFAULT_SETTINGS, ...(data?.value || {}) });
}

// ---------- SALDO TOKEN ANTHROPIC (live, ringan) ----------
async function costBetween(admin: any, fromIso: string, toIso: string) {
  const { data, error } = await admin.rpc("admin_ai_cost_between", { p_from: fromIso, p_to: toIso });
  if (error) throw error;
  return num(data);
}
async function anthropicBalance(admin: any, settings: ReturnType<typeof cleanSettings>) {
  const cp = settings.anthropic.checkpoint_date;
  const nowIso = new Date(Date.now() + 60000).toISOString();
  const today = wibToday();
  const [todayUsd, hourUsd, weekUsd] = await Promise.all([
    costBetween(admin, startOfWibDay(today), nowIso),
    costBetween(admin, new Date(Date.now() - HOUR_MS).toISOString(), nowIso),
    costBetween(admin, new Date(Date.now() - 7 * DAY_MS).toISOString(), nowIso),
  ]);
  const { data: recentRows } = await admin.from("ai_usage").select("feature, cost_usd, created_at").order("created_at", { ascending: false }).limit(8);
  const recent = (recentRows || []).map((r: any) => ({ at: r.created_at, feature: r.feature, cost_usd: Math.round(num(r.cost_usd) * 1e6) / 1e6 }));
  const burn = weekUsd / 7;
  const out: any = {
    ok: true, server_time: new Date().toISOString(), has_checkpoint: !!cp, checkpoint_date: cp,
    spent_today_usd: r4(todayUsd), spent_last_hour_usd: r4(hourUsd), burn_usd_per_day: r4(burn),
    last_usage_at: recent[0]?.at || null, recent,
  };
  if (cp) {
    const topups = settings.topups.filter((t) => t.date >= cp).reduce((s, t) => s + t.amount_usd, 0);
    const consumed = await costBetween(admin, startOfWibDay(cp), nowIso);
    const funded = settings.anthropic.balance_usd + topups;
    const remaining = funded - consumed;
    out.opening_usd = r4(settings.anthropic.balance_usd); out.topups_usd = r4(topups);
    out.funded_usd = r4(funded); out.consumed_usd = r4(consumed); out.remaining_usd = r4(remaining);
    out.pct_remaining = funded > 0 ? Math.round(Math.max(0, remaining) / funded * 1000) / 10 : 0;
    out.runway_days = burn > 0 ? Math.floor(Math.max(0, remaining) / burn) : null;
    out.empty_date = burn > 0 && remaining > 0 ? wibDateOf(new Date(Date.now() + (remaining / burn) * DAY_MS).toISOString()) : null;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat melihat cash flow." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "save") {
      const settings = cleanSettings(body.settings);
      const { error } = await admin.from("admin_settings").upsert({ key: "cashflow", value: settings, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, settings });
    }

    if (body.action === "balance") {
      return json(await anthropicBalance(admin, await loadSettings(admin)));
    }

    if (body.action !== "get") return json({ error: "Aksi tidak dikenal." }, 400);

    const settings = await loadSettings(admin);
    const today = wibToday();
    const currentYm = monthOf(today);
    const ym = YM_RE.test(body.period || "") ? body.period : currentYm;
    if (ym > currentYm) return json({ error: "Periode di masa depan belum bisa dilaporkan." }, 400);
    const pStart = `${ym}-01`;
    const pEnd = firstOfNext(ym); // eksklusif
    const isCurrent = ym === currentYm;
    const asOf = isCurrent ? today : lastDayBefore(pEnd); // tanggal acuan akhir periode

    const spotInfo = settings.kurs_auto ? await getFxRate(admin) : null;
    const spot = spotInfo?.rate ?? settings.kurs;
    const kursInfo = {
      mode: settings.kurs_auto ? "auto" : "manual", rate: spot, source: spotInfo?.source ?? "manual",
      fetched_at: spotInfo?.fetched_at ?? null, stale: !!spotInfo?.stale, fallback: settings.kurs_auto && !spotInfo,
    };

    // ---- data sumber ----
    const { data: invoices, error: invErr } = await admin.from("admin_invoices")
      .select("id, number, company, invoice_date, due_date, total, status, paid_at, data").neq("status", "void")
      .order("invoice_date", { ascending: false }).limit(500);
    if (invErr) throw invErr;
    const { data: payRows, error: payErr } = await admin.from("subscription_payments")
      .select("id, email, user_id, tier, amount, months, paid_at, source, note").order("paid_at", { ascending: true }).limit(2000);
    if (payErr) throw payErr;

    // ai_usage dan kurs dari tanggal paling awal yang dibutuhkan.
    const thirtyAgo = wibDateOf(new Date(Date.now() - 30 * DAY_MS).toISOString());
    let earliest = thirtyAgo < pStart ? thirtyAgo : pStart;
    const cp = settings.anthropic.checkpoint_date;
    if (cp && cp < earliest) earliest = cp;
    for (const inv of invoices || []) {
      const st = inv.data?.start;
      if (inv.status === "paid" && DATE_RE.test(st || "") && st < earliest) earliest = st;
    }
    for (const pay of payRows || []) { const d = wibDateOf(pay.paid_at); if (d < earliest) earliest = d; }
    if (settings.cash_opening.month && `${settings.cash_opening.month}-01` < earliest) earliest = `${settings.cash_opening.month}-01`;
    for (const t of settings.topups) if (t.date < earliest) earliest = t.date;

    const usage = await fetchAiUsage(admin, startOfWibDay(earliest));
    const { rateOn, historical } = await loadRateOn(admin, settings.kurs_auto, settings.kurs, spotInfo?.rate ?? null, earliest, today);

    const { data: members, error: memErr } = await admin.from("organization_members").select("user_id, org_id");
    if (memErr) throw memErr;
    const orgsOfUser: Record<string, string> = {};
    for (const m of members || []) if (!orgsOfUser[m.user_id]) orgsOfUser[m.user_id] = m.org_id;
    const { data: orgRows } = await admin.from("organizations").select("id, plan");
    const enterpriseOrgs = new Set((orgRows || []).filter((o: any) => o.plan === "enterprise").map((o: any) => o.id));
    const { data: setRows, error: setErr } = await admin.from("settings")
      .select("user_id, plan, plan_expires_at, community_display_name").limit(5000);
    if (setErr) throw setErr;
    const settingsOf: Record<string, any> = {};
    for (const r of setRows || []) settingsOf[r.user_id] = r;

    const sumUsd = (pred: (u: typeof usage[number]) => boolean) => usage.reduce((s, u) => (pred(u) ? s + u.cost_usd : s), 0);
    // Biaya AI per klien dalam Rupiah memakai kurs harian; HPP laporan memakai biaya rata-rata saldo prabayar.
    const sumIdrDaily = (pred: (u: typeof usage[number]) => boolean) => usage.reduce((s, u) => (pred(u) ? s + u.cost_usd * rateOn(wibDateOf(u.created_at)) : s), 0);

    // ---- PENDAPATAN GABUNGAN: invoice, pembayaran Mayar, perkiraan ----
    type Base = {
      id: string; kind: "invoice" | "mayar" | "estimate"; number: string; company: string; sub: string | null; plan: string | null;
      status: string; total: number; months: number; seats: number; start: string; end: string; due_date: string | null;
      invoice_date: string | null; paid_at: string | null; orgId: string | null; userId: string | null; cash: boolean; note: string | null;
    };
    const bases: Base[] = [];
    const coveredUsers = new Set<string>();
    const coveredOrgs = new Set<string>();
    for (const inv of invoices || []) {
      const d = inv.data || {};
      if (d.activation?.user_id) coveredUsers.add(d.activation.user_id);
      if (d.activation?.org_id) coveredOrgs.add(d.activation.org_id);
      const months = Math.max(1, Math.floor(num(d.months, 1)));
      const start = DATE_RE.test(d.start || "") ? d.start : inv.invoice_date;
      bases.push({
        id: inv.id, kind: "invoice", number: inv.number, company: inv.company, sub: d.email || null, plan: d.plan || null,
        status: inv.status, total: num(inv.total), months, seats: num(d.seats, 1), start,
        end: DATE_RE.test(d.end || "") && d.end > start ? d.end : addMonthsDate(start, months),
        due_date: inv.due_date, invoice_date: inv.invoice_date, paid_at: inv.paid_at,
        orgId: d.activation?.org_id || null, userId: d.activation?.user_id || null, cash: true, note: null,
      });
    }
    // Pembayaran Mayar: periode berurutan per akun (periode baru dimulai setelah periode sebelumnya habis, sama dengan stacking di webhook).
    const lastEndBy: Record<string, string> = {};
    const usersWithPayments = new Set<string>();
    for (const pay of payRows || []) {
      const key = pay.user_id || pay.email;
      const paidDate = wibDateOf(pay.paid_at);
      const start = lastEndBy[key] && lastEndBy[key] > paidDate ? lastEndBy[key] : paidDate;
      const months = Math.max(1, Math.floor(num(pay.months, 1)));
      const end = addMonthsDate(start, months);
      lastEndBy[key] = end;
      if (pay.user_id) usersWithPayments.add(pay.user_id);
      const st = pay.user_id ? settingsOf[pay.user_id] : null;
      bases.push({
        id: pay.id, kind: "mayar", number: pay.source === "backfill" ? "Mayar (perkiraan)" : "Mayar", company: st?.community_display_name || pay.email,
        sub: st?.community_display_name ? pay.email : null, plan: pay.tier === "premium" ? "professional" : pay.tier, status: "paid",
        total: num(pay.amount), months, seats: pay.tier === "enterprise" ? 4 : 1, start, end, due_date: null, invoice_date: null,
        paid_at: pay.paid_at, orgId: pay.tier === "enterprise" && pay.user_id ? (orgsOfUser[pay.user_id] || null) : null, userId: pay.user_id,
        cash: true, note: pay.source === "backfill" ? "Nominal diperkirakan (dicatat sebelum pencatatan otomatis ada)" : null,
      });
    }
    // Akun berbayar lama tanpa catatan pembayaran dan tanpa invoice: perkiraan dari masa aktif dan harga per bulan (tidak masuk kas).
    let manualGrants = 0;
    for (const r of setRows || []) {
      if (r.plan !== "standard" && r.plan !== "premium") continue;
      const org = orgsOfUser[r.user_id];
      if (usersWithPayments.has(r.user_id) || coveredUsers.has(r.user_id) || (org && (enterpriseOrgs.has(org) || coveredOrgs.has(org)))) continue;
      const exp = r.plan_expires_at as string | null;
      if (!exp) { manualGrants++; continue; }
      const endDate = wibDateOf(exp);
      if (endDate < pStart) continue; // sudah berakhir sebelum periode ini
      const plan = r.plan === "premium" ? "professional" : "standard";
      let email: string | null = null;
      try { email = (await admin.auth.admin.getUserById(r.user_id))?.data?.user?.email || null; } catch (_) { /* biarkan kosong */ }
      bases.push({
        id: "est-" + r.user_id, kind: "estimate", number: "Perkiraan", company: r.community_display_name || email || r.user_id.slice(0, 8),
        sub: r.community_display_name ? email : null, plan, status: "paid", total: settings.sub_price[plan], months: 1, seats: 1,
        start: addMonthsDate(endDate, -1), end: endDate, due_date: null, invoice_date: null, paid_at: null, orgId: null, userId: r.user_id,
        cash: false, note: "Belum ada catatan pembayaran. Nominal dan tanggal diperkirakan dari masa aktif dan harga per bulan.",
      });
    }

    // Pengakuan pendapatan harian: bagian total yang sudah berjalan sampai (tidak termasuk) tanggal `until`.
    const recognizedUntil = (b: Base, until: string) => {
      const total = Math.max(1, dayNum(b.end) - dayNum(b.start));
      return b.total * Math.min(1, Math.max(0, (dayNum(until) - dayNum(b.start)) / total));
    };
    const paidBases = bases.filter((b) => b.status === "paid");

    // Pendapatan diakui dalam periode, per sumber (dibulatkan per sumber).
    const revBySource = { invoice: 0, mayar: 0, estimate: 0 };
    for (const b of paidBases) revBySource[b.kind] += recognizedUntil(b, pEnd) - recognizedUntil(b, pStart);
    const revenue = { invoice: R(revBySource.invoice), mayar: R(revBySource.mayar), estimate: R(revBySource.estimate), total: 0 };
    revenue.total = revenue.invoice + revenue.mayar + revenue.estimate;

    // Pendapatan diterima di muka pada akhir periode: uang sudah diterima, layanan belum berjalan.
    let unearned = 0;
    for (const b of paidBases) {
      if (!b.cash || !b.paid_at || wibDateOf(b.paid_at) >= pEnd) continue;
      unearned += b.total - recognizedUntil(b, pEnd);
    }
    // Piutang usaha pada akhir periode: invoice terbit sebelum akhir periode dan belum dibayar sampai saat itu.
    let receivables = 0;
    let overdueCount = 0;
    for (const b of bases) {
      if (b.kind !== "invoice" || !b.invoice_date || b.invoice_date >= pEnd) continue;
      const settledBefore = b.status === "paid" && b.paid_at && wibDateOf(b.paid_at) < pEnd;
      if (!settledBefore) { receivables += b.total; if (b.due_date && b.due_date < asOf) overdueCount++; }
    }

    // ---- BIAYA TETAP (kurs akhir periode) ----
    const fxEnd = rateOn(asOf);
    const costIdr = (c: { currency: string; amount: number }) => R(c.currency === "USD" ? c.amount * fxEnd : c.amount);
    const hppFixed = settings.costs.filter((c) => c.kind === "hpp").reduce((s, c) => s + costIdr(c), 0);
    const opexFixed = settings.costs.filter((c) => c.kind !== "hpp").reduce((s, c) => s + costIdr(c), 0);

    // ---- SALDO PRABAYAR ANTHROPIC: biaya rata-rata tertimbang ----
    const usagePerDay: Record<string, number> = {};
    for (const u of usage) { const d = wibDateOf(u.created_at); usagePerDay[d] = (usagePerDay[d] || 0) + u.cost_usd; }
    type Ev = { date: string; ord: number; usd: number; idr?: number; kind: "open" | "topup" | "use" };
    const events: Ev[] = [];
    if (cp) events.push({ date: cp, ord: 0, usd: settings.anthropic.balance_usd, kind: "open" });
    for (const t of settings.topups) {
      if (cp && t.date < cp) continue; // top-up sebelum patokan sudah termasuk di saldo patokan
      events.push({ date: t.date, ord: 1, usd: t.amount_usd, idr: t.amount_idr ?? R(t.amount_usd * rateOn(t.date)), kind: "topup" });
    }
    for (const [d, usd] of Object.entries(usagePerDay)) events.push({ date: d, ord: 2, usd, kind: "use" });
    events.sort((a, b) => a.date.localeCompare(b.date) || a.ord - b.ord);

    // Jalankan pool sampai (tidak termasuk) tanggal `until`. Pemakaian sebelum patokan dinilai dengan kurs harian (pool belum ada).
    const runPool = (until: string) => {
      let usd = 0, idr = 0, spotConsumedIdr = 0, poolConsumedUsd = 0;
      for (const e of events) {
        // Saldo patokan berlaku sejak awal hari patokan, jadi ikut dihitung bila periode dimulai pada tanggal itu.
        if (e.kind === "open" ? e.date > until : e.date >= until) break;
        if (e.kind === "open") { usd += e.usd; idr += R(e.usd * rateOn(e.date)); }
        else if (e.kind === "topup") { usd += e.usd; idr += e.idr!; }
        else if (!cp || e.date < cp) { spotConsumedIdr += e.usd * rateOn(e.date); }
        else {
          const avg = usd > 1e-9 ? idr / usd : rateOn(e.date);
          usd -= e.usd; idr -= e.usd * avg; poolConsumedUsd += e.usd;
          if (usd <= 1e-9) { idr = 0; }
        }
      }
      return { usd, idr, spotConsumedIdr, poolConsumedUsd };
    };
    const poolStart = runPool(pStart);
    const poolEnd = runPool(pEnd);
    const topupsInPeriod = events.filter((e) => e.kind === "topup" && e.date >= pStart && e.date < pEnd);
    const topupUsdPeriod = topupsInPeriod.reduce((s, e) => s + e.usd, 0);
    const topupIdrPeriod = topupsInPeriod.reduce((s, e) => s + e.idr!, 0);
    let cogsAi: number;
    // Saldo prabayar hanya terlacak mulai tanggal patokan; periode yang berakhir sebelum itu memakai kurs harian.
    const cpActive = !!cp && cp < pEnd;
    const prepaid: any = { basis: cpActive ? "average-cost" : "daily-spot", available: cpActive };
    if (cpActive) {
      const startsAfterCp = cp! <= pStart;
      const openIdr = startsAfterCp ? R(poolStart.idr) : R(settings.anthropic.balance_usd * rateOn(cp!));
      const openUsd = startsAfterCp ? poolStart.usd : settings.anthropic.balance_usd;
      const closeIdr = R(poolEnd.idr);
      const preSpot = R(poolEnd.spotConsumedIdr - poolStart.spotConsumedIdr); // pemakaian sebelum tanggal patokan
      const consumedIdr = openIdr + topupIdrPeriod - closeIdr;
      cogsAi = consumedIdr + preSpot;
      prepaid.usd = {
        opening: r4(openUsd), topup: r4(topupUsdPeriod),
        consumed: r4(poolEnd.poolConsumedUsd - poolStart.poolConsumedUsd), closing: r4(poolEnd.usd),
      };
      prepaid.idr = { opening: openIdr, topup: topupIdrPeriod, consumed: consumedIdr, closing: closeIdr };
      prepaid.pre_checkpoint_idr = preSpot;
    } else {
      cogsAi = R(poolEnd.spotConsumedIdr - poolStart.spotConsumedIdr);
    }

    // ---- LABA RUGI ----
    const cogs = { ai: cogsAi, infra: hppFixed, total: cogsAi + hppFixed };
    const grossProfit = revenue.total - cogs.total;
    const operatingProfit = grossProfit - opexFixed;
    const income = {
      revenue, cogs, gross_profit: grossProfit, gross_margin_pct: pct(grossProfit, revenue.total),
      opex: opexFixed, net_profit: operatingProfit, net_margin_pct: pct(operatingProfit, revenue.total),
      ai_pct_of_revenue: pct(cogs.ai, revenue.total),
    };

    // ---- ARUS KAS (metode langsung) per bulan ----
    const cashOfMonth = (m: string) => {
      const a = `${m}-01`, b = firstOfNext(m);
      let recInvoice = 0, recMayar = 0;
      for (const x of paidBases) {
        if (!x.cash || !x.paid_at) continue;
        const d = wibDateOf(x.paid_at);
        if (d >= a && d < b) { if (x.kind === "invoice") recInvoice += x.total; else recMayar += x.total; }
      }
      const tIdr = events.filter((e) => e.kind === "topup" && e.date >= a && e.date < b).reduce((s, e) => s + e.idr!, 0);
      const mEnd = lastDayBefore(b);
      const fx = rateOn(mEnd < today ? mEnd : today);
      const sumCosts = (k: (x: any) => boolean) => settings.costs.filter(k).reduce((s, x) => s + R(x.currency === "USD" ? x.amount * fx : x.amount), 0);
      const infra = sumCosts((x) => x.kind === "hpp"), opex = sumCosts((x) => x.kind !== "hpp");
      const rec = { invoice: R(recInvoice), mayar: R(recMayar), total: R(recInvoice) + R(recMayar) };
      const pay = { anthropic: tIdr, infra, opex, total: tIdr + infra + opex };
      return { receipts: rec, payments: pay, net: rec.total - pay.total };
    };
    const cf = cashOfMonth(ym);
    let openingCash: number | null = null, closingCash: number | null = null;
    const co = settings.cash_opening;
    if (co.month && co.month <= ym) {
      openingCash = co.amount_idr;
      if (co.month < ym) for (const m of monthsBetween(co.month, prevMonth(ym))) openingCash += cashOfMonth(m).net;
      closingCash = openingCash + cf.net;
    }
    const cashflow = {
      receipts: cf.receipts, payments: cf.payments, net_operating: cf.net, investing: 0, financing: 0, net_change: cf.net,
      opening_cash: openingCash, closing_cash: closingCash,
    };

    // ---- POSISI KEUANGAN RINGKAS (akhir periode) ----
    const prepaidIdr = cpActive ? R(poolEnd.idr) : null;
    const assets = {
      cash: closingCash, receivables: R(receivables), prepaid_ai: prepaidIdr,
      total: (closingCash ?? 0) + R(receivables) + (prepaidIdr ?? 0),
    };
    const liabilities = { unearned: R(unearned), total: R(unearned) };
    const position = { assets, liabilities, net_assets: assets.total - liabilities.total, complete: closingCash !== null && cpActive };

    // ---- PELANGGAN (kondisi saat ini; biaya AI per klien memakai kurs harian) ----
    const tomorrow = wibDateOf(new Date(Date.now() + DAY_MS).toISOString());
    let mrr = 0, activeValue = 0, subMrr = 0, subCount = 0;
    const contracts = bases.map((b) => {
      const paid = b.status === "paid";
      const active = paid && b.start <= today && b.end > today;
      if (active) { mrr += b.total / b.months; activeValue += b.total; if (b.kind !== "invoice") { subMrr += b.total / b.months; subCount++; } }
      let aiUsd: number | null = null, aiIdr: number | null = null;
      if (paid && (b.orgId || b.userId)) {
        const since = startOfWibDay(b.start);
        const match = (u: typeof usage[number]) => !!u.user_id && u.created_at >= since && (b.orgId ? orgsOfUser[u.user_id] === b.orgId : u.user_id === b.userId);
        aiUsd = sumUsd(match); aiIdr = R(sumIdrDaily(match));
      }
      const quotaIdr = R(b.total * settings.token_pct / 100);
      const rec = paid ? recognizedUntil(b, tomorrow) : 0; // diakui sampai akhir hari ini
      return {
        id: b.id, kind: b.kind, number: b.number, company: b.company, sub: b.sub, plan: b.plan, note: b.note, status: b.status,
        total: b.total, months: b.months, seats: b.seats, start: b.start, end: b.end, due_date: b.due_date, paid_at: b.paid_at,
        active, org_id: b.orgId, monthly: R(b.total / b.months), quota_idr: quotaIdr,
        recognized_idr: R(rec), unearned_idr: paid && b.cash ? R(b.total - rec) : 0,
        margin_pct: aiIdr === null || rec <= 0 ? null : Math.round((rec - aiIdr) / rec * 1000) / 10,
        ai_usd: aiUsd === null ? null : r4(aiUsd), ai_idr: aiIdr,
        quota_used_pct: aiIdr === null || quotaIdr <= 0 ? null : Math.round(aiIdr / quotaIdr * 1000) / 10,
      };
    }).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || String(b.start).localeCompare(String(a.start)));

    const balance = await anthropicBalance(admin, settings);

    return json({
      ok: true, today, settings, kurs: spot, kurs_info: { ...kursInfo, historical },
      period: { ym, start: pStart, end_excl: pEnd, as_of: asOf, is_current: isCurrent, current_ym: currentYm, fx_end: fxEnd },
      income, cashflow, position, prepaid,
      summary: {
        mrr: R(mrr), active_contract_value: R(activeValue), sub_mrr: R(subMrr), sub_count: subCount, manual_grants: manualGrants,
        receivables: R(receivables), overdue_count: overdueCount, unearned: R(unearned), fixed_costs_idr: hppFixed + opexFixed,
      },
      balance, contracts,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
