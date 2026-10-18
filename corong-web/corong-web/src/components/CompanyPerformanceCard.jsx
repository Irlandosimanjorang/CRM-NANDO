import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import * as db from "../lib/db";

// Kartu "Performa Perusahaan" di Dashboard - khusus sales_rep plan Enterprise
// (permintaan calon klien: "Sales bisa lihat dashboard perusahaan secara
// umum"). Isinya angka AGREGAT perusahaan bulan ini + posisi si sales
// sendiri (kontribusi & target pribadi). Rincian per sales lain tetap cuma
// buat owner/manager di tab Team. Data dari RPC get_sales_company_view
// (bulan ini, WIB) + get_org_dashboard_stats (sepanjang masa).

const fmtJt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return "Rp" + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (v >= 1e6) return "Rp" + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return "Rp" + Math.round(v).toLocaleString("id-ID");
};
const pctOf = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);

// Gauge setengah lingkaran (sama kayak di tab Team): busur tebal = tercapai,
// busur muda = kalau forecast closing.
function Gauge({ pct, forecastPct = 0, color = "#f97316", soft = "#fed7aa" }) {
  const r = 52, len = Math.PI * r;
  const arc = "M 8 62 A 52 52 0 0 1 112 62";
  const c = (v) => Math.max(0, Math.min(100, v || 0));
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[150px]" aria-hidden="true">
      <path d={arc} fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
      {forecastPct > 0 && <path d={arc} fill="none" stroke={soft} strokeWidth="10" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - c(forecastPct) / 100)} />}
      <path d={arc} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - c(pct) / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700" />
      <text x="60" y="56" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 20, fontWeight: 700, fontFamily: "Sora, sans-serif" }}>{pct}%</text>
    </svg>
  );
}

// Satu kolom di dalam kartu - dipisah garis, bukan kartu di dalam kartu.
function Col({ title, children }) {
  return (
    <div className="flex min-w-0 flex-col bg-white p-4">
      <div className="text-[12px] font-semibold text-slate-700">{title}</div>
      {children}
    </div>
  );
}

export default function CompanyPerformanceCard() {
  const [view, setView] = useState(null);
  const [allTime, setAllTime] = useState(null);
  // Kartu bisa disembunyikan (17-18 Okt 2026). Pilihan disimpan di perangkat ini saja.
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("nexto_perf_hidden") === "1"; } catch (_) { return false; } });
  const toggleHidden = () => setHidden((v) => {
    const next = !v;
    try { localStorage.setItem("nexto_perf_hidden", next ? "1" : "0"); } catch (_) { /* abaikan */ }
    return next;
  });
  // Angka omzet di bar ringkas naik perlahan (count-up) saat kartu disembunyikan. Hook harus dipanggil sebelum return apa pun.
  const heroValue = (() => {
    if (!view || view === false) return 0;
    const v = Number((view.company ? view.company.revenue : view.me?.revenue) || 0);
    const t = Number((view.company ? view.company.target : view.me?.target) || 0);
    return t > 0 ? (v / t) * 100 : 0;
  })();
  const [shownValue, setShownValue] = useState(0);
  useEffect(() => {
    if (!hidden) return undefined;
    let raf;
    const start = performance.now();
    const dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / dur);
      setShownValue(heroValue * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hidden, heroValue]);

  useEffect(() => {
    let alive = true;
    db.getSalesCompanyView().then((d) => alive && setView(d)).catch(() => alive && setView(false));
    db.getOrgDashboardStats().then((d) => alive && setAllTime(d)).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (view === false) return null;

  const cardCls = "rounded-panel border border-slate-200/80 bg-white p-5";
  if (!view) {
    return (
      <section className={cardCls}>
        <div className="h-4 w-48 rounded bg-slate-100 motion-safe:animate-pulse" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-inner bg-slate-100 motion-safe:animate-pulse" />)}</div>
      </section>
    );
  }

  if (hidden) {
    // Saat disembunyikan, kartu tinggal satu bar berisi ringkasan. Seluruh bar bisa diklik untuk membuka kartunya lagi.
    const hv = view.company ? view.company.revenue : view.me.revenue;
    const ht = view.company ? view.company.target : view.me.target;
    const hd = view.company ? view.company.deals : view.me.deals;
    const hp = ht > 0 ? Math.min(100, Math.round((hv / ht) * 100)) : 0;
    const ring = 2 * Math.PI * 18;
    const done = hp >= 100;
    return (
      <section className="rounded-panel border border-white/10 bg-[#0b1220] p-4 text-white shadow-lg">
        <button
          type="button"
          onClick={toggleHidden}
          aria-expanded="false"
          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-white">{view.company ? "Performa perusahaan" : "Performa saya"}</h2>
              <p className="mt-0.5 text-[11.5px] text-white/50">Ketuk untuk membuka · tersinkron</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-display text-[19px] font-bold leading-none tabular-nums text-amber-300">{ht > 0 ? `${Math.round(shownValue)}%` : "–"}</div>
              <div className="mt-1 text-[11px] tabular-nums text-white/50">{ht > 0 ? "dari target" : "target belum ditetapkan"} · {hd} deal</div>
            </div>
            <span className="relative grid h-11 w-11 place-items-center">
              <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0" aria-hidden="true">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke={done ? "#34d399" : "#f59e0b"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ring}
                  strokeDashoffset={ring * (1 - hp / 100)}
                  transform="rotate(-90 22 22)"
                  style={{ transition: "stroke-dashoffset 900ms ease", filter: done ? "drop-shadow(0 0 6px rgba(52,211,153,0.8))" : undefined }}
                />
              </svg>
              <ChevronDown size={16} className="relative text-white/80" />
            </span>
          </div>
        </button>
      </section>
    );
  }

  // Sales hanya menerima performa miliknya (company = null). Data perusahaan hanya untuk owner/manager.
  const { company: companyRaw, me, trend } = view;
  const isCompany = !!companyRaw;
  const company = companyRaw || { revenue: 0, target: 0, deals: 0 };
  const monthLabel = new Date(view.month + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const companyPct = pctOf(company.revenue, company.target);
  const share = pctOf(me.revenue, company.revenue);
  const myPct = pctOf(me.revenue, me.target);
  const myProjected = pctOf(Number(me.revenue) + Number(me.forecast), me.target);
  const maxTrend = Math.max(1, ...trend.map((t) => Number(t.revenue)));

  return (
    <section className={cardCls}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">{isCompany ? "Performa perusahaan" : "Performa saya"}</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">{isCompany ? `Seluruh team, ${monthLabel}` : monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {isCompany && <span className="text-[10.5px] text-slate-500">Rincian per sales hanya dapat dilihat manager</span>}
          <button type="button" onClick={toggleHidden} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Sembunyikan</button>
        </div>
      </div>

      <div className={`mt-4 grid gap-px overflow-hidden rounded-inner border border-slate-100 bg-slate-100 ${isCompany ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {!isCompany && (
          <Col title="Revenue saya">
            <div className="mt-3">
              <div className="font-display text-[24px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink">{fmtJt(me.revenue)}</div>
              <div className="mt-1 text-[11px] text-slate-500">Revenue bulan ini dari deal Anda</div>
            </div>
            <div className="mt-auto pt-2 text-center text-[10.5px] text-slate-500">{me.deals} deal closing bulan ini</div>
          </Col>
        )}

        {isCompany && <Col title="Target perusahaan">
          {Number(company.target) > 0 ? (
            <div className="mt-2 flex flex-col items-center text-center">
              <Gauge pct={companyPct} />
              <div className="text-[12px] tabular-nums text-slate-600"><b className="text-slate-900">{fmtJt(company.revenue)}</b> / {fmtJt(company.target)}</div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="font-display text-[24px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink">{fmtJt(company.revenue)}</div>
              <div className="mt-1 text-[11px] text-slate-500">Revenue bulan ini · target belum ditetapkan manager</div>
            </div>
          )}
          <div className="mt-auto pt-2 text-center text-[10.5px] text-slate-500">{company.deals} deal closing bulan ini</div>
        </Col>}

        {isCompany && <Col title="Kontribusi Anda">
          <div className="mt-3 font-display text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink">{share}%</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {Number(company.revenue) > 0
              ? <>dari revenue perusahaan · <b className="text-slate-800">{fmtJt(me.revenue)}</b> dari {fmtJt(company.revenue)}</>
              : "Belum ada deal masuk bulan ini"}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/70">
            <div className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${share}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Deal Anda: {me.deals}</span>
            <span>Anggota lain: {Math.max(0, Number(company.deals) - Number(me.deals))}</span>
          </div>
        </Col>}

        <Col title="Target pribadi">
          {Number(me.target) > 0 ? (
            <div className="mt-2 flex flex-col items-center text-center">
              <Gauge pct={myPct} forecastPct={myProjected} color="#10b981" soft="#a7f3d0" />
              <div className="text-[12px] tabular-nums text-slate-600"><b className="text-slate-900">{fmtJt(me.revenue)}</b> / {fmtJt(me.target)}</div>
              <div className="mt-0.5 text-[10.5px] tabular-nums text-slate-500">Forecast pipeline {fmtJt(me.forecast)}</div>
            </div>
          ) : (
            <div className="mt-3 text-[11.5px] text-slate-500">Target Anda bulan ini belum ditetapkan manager. Forecast pipeline Anda: <b className="text-slate-800">{fmtJt(me.forecast)}</b></div>
          )}
        </Col>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="text-[11px] font-semibold text-slate-500">{isCompany ? "Revenue perusahaan 6 bulan terakhir" : "Revenue saya 6 bulan terakhir"}</div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {trend.map((t, i) => {
              const cur = i === trend.length - 1;
              const v = Number(t.revenue);
              return (
                <div key={t.month} className="flex flex-col items-center" title={fmtJt(v)}>
                  <span className={`text-[9.5px] tabular-nums ${cur ? "font-bold text-orange-600" : "text-slate-500"}`}>{v > 0 ? fmtJt(v).replace("Rp", "") : "-"}</span>
                  <div className="mt-1 flex h-14 w-full items-end justify-center">
                    <div className={`w-3/5 max-w-[28px] rounded-t-md ${cur ? "bg-brand" : v ? "bg-brand-line" : "bg-slate-100"}`} style={{ height: `${v > 0 ? Math.max(8, Math.round((v / maxTrend) * 100)) : 4}%` }} />
                  </div>
                  <span className="mt-1 text-[10px] text-slate-500">{new Date(t.month + "T00:00:00Z").toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" })}</span>
                </div>
              );
            })}
          </div>
        </div>
        {allTime && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500">{isCompany ? "Sepanjang masa" : "Performa saya sepanjang masa"}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                [allTime.total, "Total lead"],
                [`${allTime.win_rate}%`, "Win rate"],
                [allTime.deals, "Deal closing"],
                [fmtJt(allTime.revenue), "Total revenue"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-[17px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{v}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
