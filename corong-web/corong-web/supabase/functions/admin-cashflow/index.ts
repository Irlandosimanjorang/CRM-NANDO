// Supabase Edge Function: admin-cashflow
// Panel ARUS KAS di Command Center (9 Okt 2026, permintaan Nando): uang masuk
// dari invoice, jatah token Anthropic per kontrak, saldo Anthropic (perkiraan
// live), biaya tetap, dan runway. Hanya admin platform (cek ADMIN_EMAIL).
//
// Body: { action: "get" }
//       { action: "save", settings }  -> simpan pengaturan arus kas (admin_settings, key "cashflow")
//
// Saldo Anthropic TIDAK bisa dibaca lewat API (kredit prabayar tidak
// diekspos), jadi dihitung: saldo patokan (dicatat Nando dari Console pada
// tanggal tertentu) + top-up sesudahnya - biaya AI di tabel ai_usage sejak
// patokan. ai_usage hanya mencatat pemakaian lewat Nexto.
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
const DAY_MS = 86400000;
const wibToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const wibMonthStart = () => `${wibToday().slice(0, 7)}-01`;
const startOfWibDay = (d: string) => new Date(`${d}T00:00:00+07:00`).toISOString();
const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

const DEFAULT_SETTINGS = {
  kurs: 17700,
  token_pct: 25,
  anthropic: { checkpoint_date: null as string | null, balance_usd: 0 },
  topups: [] as { id: string; date: string; amount_usd: number; note: string }[],
  costs: [] as { id: string; name: string; currency: string; amount: number; kind: string }[],
};

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
    .map((t: any) => ({ id: String(t.id || crypto.randomUUID()).slice(0, 64), date: t.date, amount_usd: num(t.amount_usd), note: String(t.note || "").slice(0, 200) }));
  const costs = (Array.isArray(s.costs) ? s.costs : []).slice(0, 100)
    .filter((c: any) => String(c?.name || "").trim() && num(c.amount ?? c.amount_idr) >= 0)
    .map((c: any) => {
      const currency = c.currency === "USD" ? "USD" : "IDR";
      const amount = num(c.amount ?? c.amount_idr);
      return {
        id: String(c.id || crypto.randomUUID()).slice(0, 64), name: String(c.name).trim().slice(0, 100),
        currency, amount: currency === "USD" ? Math.round(amount * 100) / 100 : Math.round(amount),
        kind: c.kind === "opex" ? "opex" : "hpp", // hpp = biaya penyedia layanan (Supabase, Vercel), opex = beban lain
      };
    });
  return { kurs, token_pct, anthropic, topups, costs };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat melihat arus kas." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "save") {
      const settings = cleanSettings(body.settings);
      const { error } = await admin.from("admin_settings").upsert({ key: "cashflow", value: settings, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, settings });
    }

    if (body.action !== "get") return json({ error: "Aksi tidak dikenal." }, 400);

    const { data: stRow, error: stErr } = await admin.from("admin_settings").select("value").eq("key", "cashflow").maybeSingle();
    if (stErr) throw stErr;
    const settings = cleanSettings({ ...DEFAULT_SETTINGS, ...(stRow?.value || {}) });
    const kurs = settings.kurs;

    const today = wibToday();
    const monthStart = wibMonthStart();
    const { data: invoices, error: invErr } = await admin.from("admin_invoices")
      .select("id, number, company, invoice_date, due_date, total, status, paid_at, data").neq("status", "void")
      .order("invoice_date", { ascending: false }).limit(500);
    if (invErr) throw invErr;

    // ai_usage dari tanggal paling awal yang dibutuhkan (kontrak, patokan saldo, 30 hari terakhir).
    const thirtyAgo = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
    let earliest = thirtyAgo < monthStart ? thirtyAgo : monthStart;
    if (settings.anthropic.checkpoint_date && settings.anthropic.checkpoint_date < earliest) earliest = settings.anthropic.checkpoint_date;
    for (const inv of invoices || []) {
      const st = inv.data?.start;
      if (inv.status === "paid" && DATE_RE.test(st || "") && st < earliest) earliest = st;
    }
    const usage = await fetchAiUsage(admin, startOfWibDay(earliest));

    const { data: members, error: memErr } = await admin.from("organization_members").select("user_id, org_id");
    if (memErr) throw memErr;
    const orgsOfUser: Record<string, string> = {};
    for (const m of members || []) if (!orgsOfUser[m.user_id]) orgsOfUser[m.user_id] = m.org_id;

    const sumUsd = (pred: (u: typeof usage[number]) => boolean) => usage.reduce((s, u) => (pred(u) ? s + u.cost_usd : s), 0);
    const wibDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10);

    // Kontrak dari invoice.
    let mrr = 0, cashInMonth = 0, receivable = 0, overdueCount = 0, activeContractValue = 0, deferred = 0;
    const contracts = (invoices || []).map((inv: any) => {
      const d = inv.data || {};
      const months = Math.max(1, Math.floor(num(d.months, 1)));
      const total = num(inv.total);
      const start = DATE_RE.test(d.start || "") ? d.start : inv.invoice_date;
      const end = DATE_RE.test(d.end || "") ? d.end : null;
      const orgId = d.activation?.org_id || null;
      const active = inv.status === "paid" && start <= today && (!end || end >= today);
      if (inv.status === "paid" && inv.paid_at && wibDate(inv.paid_at) >= monthStart) cashInMonth += total;
      if (inv.status === "unpaid") { receivable += total; if (inv.due_date < today) overdueCount++; }
      if (active) { mrr += total / months; activeContractValue += total; }
      // Biaya AI klien ini sejak kontrak mulai (hanya bila organisasinya sudah diaktifkan lewat invoice).
      let aiUsd: number | null = null;
      if (inv.status === "paid" && orgId) {
        const since = startOfWibDay(start);
        aiUsd = sumUsd((u) => !!u.user_id && orgsOfUser[u.user_id] === orgId && u.created_at >= since);
      }
      const quotaIdr = Math.round(total * settings.token_pct / 100);
      // Pendapatan diakui (akrual): dibagi rata per hari sepanjang masa kontrak; sisanya = pendapatan diterima di muka.
      let recognized = 0;
      if (inv.status === "paid") {
        const t0 = new Date(`${start}T00:00:00+07:00`).getTime();
        const t1 = end ? new Date(`${end}T23:59:59+07:00`).getTime() : t0 + months * 30 * DAY_MS;
        recognized = total * Math.min(1, Math.max(0, (Date.now() - t0) / Math.max(1, t1 - t0)));
        deferred += total - recognized;
      }
      return {
        recognized_idr: Math.round(recognized), unearned_idr: inv.status === "paid" ? Math.round(total - recognized) : 0,
        margin_pct: aiUsd === null || recognized <= 0 ? null : Math.round((recognized - aiUsd * kurs) / recognized * 1000) / 10,
        id: inv.id, number: inv.number, company: inv.company, status: inv.status, total, months, seats: num(d.seats, 1),
        start, end, due_date: inv.due_date, paid_at: inv.paid_at, active, org_id: orgId,
        monthly: Math.round(total / months), quota_idr: quotaIdr,
        ai_usd: aiUsd, ai_idr: aiUsd === null ? null : Math.round(aiUsd * kurs),
        quota_used_pct: aiUsd === null || quotaIdr <= 0 ? null : Math.round((aiUsd * kurs) / quotaIdr * 1000) / 10,
      };
    });

    // Saldo Anthropic (perkiraan live).
    const cpDate = settings.anthropic.checkpoint_date;
    const spentSince = cpDate ? sumUsd((u) => u.created_at >= startOfWibDay(cpDate)) : 0;
    const topupsSince = settings.topups.filter((t) => !cpDate || t.date >= cpDate).reduce((s, t) => s + t.amount_usd, 0);
    const balanceUsd = cpDate ? settings.anthropic.balance_usd + topupsSince - spentSince : null;
    const burn7 = sumUsd((u) => u.created_at >= new Date(Date.now() - 7 * DAY_MS).toISOString()) / 7;
    const runwayDays = balanceUsd !== null && burn7 > 0 ? Math.floor(Math.max(0, balanceUsd) / burn7) : null;

    // Biaya AI per hari, 30 hari terakhir (untuk grafik kecil).
    const perDay: Record<string, number> = {};
    for (const u of usage) { const dd = wibDate(u.created_at); if (dd >= thirtyAgo) perDay[dd] = (perDay[dd] || 0) + u.cost_usd; }
    const daily = Object.entries(perDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, usd]) => ({ day, usd: Math.round(usd * 10000) / 10000 }));

    const aiMonthUsd = sumUsd((u) => u.created_at >= startOfWibDay(monthStart));
    const costIdr = (c: { currency: string; amount: number }) => (c.currency === "USD" ? c.amount * kurs : c.amount);
    const hppFixed = settings.costs.filter((c) => c.kind === "hpp").reduce((s, c) => s + costIdr(c), 0);
    const opexFixed = settings.costs.filter((c) => c.kind !== "hpp").reduce((s, c) => s + costIdr(c), 0);
    const fixedCosts = hppFixed + opexFixed;

    // Laba rugi bulanan (akrual): HPP = biaya AI + biaya tetap berjenis HPP (mis. Supabase); beban = sisanya.
    const aiMonthIdr = aiMonthUsd * kurs;
    const cogs = aiMonthIdr + hppFixed;
    const grossProfit = mrr - cogs;
    const netProfit = grossProfit - opexFixed;
    const pct = (x: number, base: number) => (base > 0 ? Math.round(x / base * 1000) / 10 : null);
    const varRatio = mrr > 0 ? (mrr - aiMonthIdr) / mrr : 0; // biaya AI naik seiring pendapatan, biaya tetap tidak
    const pnl = {
      revenue: Math.round(mrr), cogs: Math.round(cogs), cogs_ai: Math.round(aiMonthIdr), cogs_fixed: Math.round(hppFixed),
      gross_profit: Math.round(grossProfit), gross_margin_pct: pct(grossProfit, mrr),
      opex: Math.round(opexFixed), net_profit: Math.round(netProfit), net_margin_pct: pct(netProfit, mrr),
      ai_pct_of_revenue: pct(aiMonthIdr, mrr),
      breakeven_mrr: varRatio > 0 ? Math.round(fixedCosts / varRatio) : null,
      deferred_revenue: Math.round(deferred),
    };

    return json({
      ok: true, today, settings, kurs, pnl,
      summary: {
        mrr: Math.round(mrr), cash_in_month: Math.round(cashInMonth), receivable: Math.round(receivable), overdue_count: overdueCount,
        active_contract_value: Math.round(activeContractValue),
        ai_month_usd: Math.round(aiMonthUsd * 10000) / 10000, ai_month_idr: Math.round(aiMonthUsd * kurs),
        fixed_costs_idr: Math.round(fixedCosts),
        profit_month_idr: Math.round(netProfit),
      },
      anthropic: {
        balance_usd: balanceUsd === null ? null : Math.round(balanceUsd * 100) / 100,
        spent_since_usd: Math.round(spentSince * 10000) / 10000, topups_since_usd: topupsSince,
        burn_usd_per_day: Math.round(burn7 * 10000) / 10000, runway_days: runwayDays,
        tracking_since: usage[0]?.created_at || null,
      },
      contracts, daily,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
