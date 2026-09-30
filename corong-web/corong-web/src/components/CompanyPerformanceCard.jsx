import { useEffect, useState } from "react";
import { Building2, Target, UserRound } from "lucide-react";
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
      <text x="60" y="56" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 20, fontWeight: 900 }}>{pct}%</text>
    </svg>
  );
}

function Panel({ icon: Icon, tone, title, children }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${tone}`}><Icon size={14} /></div>
        <div className="text-[12px] font-bold text-slate-700">{title}</div>
      </div>
      {children}
    </div>
  );
}

export default function CompanyPerformanceCard() {
  const [view, setView] = useState(null);
  const [allTime, setAllTime] = useState(null);

  useEffect(() => {
    let alive = true;
    db.getSalesCompanyView().then((d) => alive && setView(d)).catch(() => alive && setView(false));
    db.getOrgDashboardStats().then((d) => alive && setAllTime(d)).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (view === false) return null;

  const cardCls = "rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_-30px_rgba(15,23,42,.32)]";
  if (!view) {
    return (
      <section className={cardCls}>
        <div className="h-4 w-48 rounded bg-slate-100 motion-safe:animate-pulse" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-2xl bg-slate-100 motion-safe:animate-pulse" />)}</div>
      </section>
    );
  }

  const { company, me, trend } = view;
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
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-500">Performa perusahaan · {monthLabel}</div>
          <h2 className="mt-1 text-[16px] font-black tracking-[-0.02em] text-slate-900">Semua team, bulan ini</h2>
        </div>
        <span className="text-[10.5px] text-slate-400">Rincian per sales cuma bisa dilihat manager</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel icon={Building2} tone="bg-orange-50 text-orange-500" title="Target perusahaan">
          {Number(company.target) > 0 ? (
            <div className="mt-2 flex flex-col items-center text-center">
              <Gauge pct={companyPct} />
              <div className="text-[12px] tabular-nums text-slate-600"><b className="text-slate-900">{fmtJt(company.revenue)}</b> / {fmtJt(company.target)}</div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-[24px] font-black leading-none tracking-[-0.04em] tabular-nums text-slate-900">{fmtJt(company.revenue)}</div>
              <div className="mt-1 text-[11px] text-slate-400">Revenue bulan ini · target belum di-set manager</div>
            </div>
          )}
          <div className="mt-auto pt-2 text-center text-[10.5px] text-slate-400">{company.deals} deal closing bulan ini</div>
        </Panel>

        <Panel icon={UserRound} tone="bg-violet-50 text-violet-500" title="Kontribusi lu">
          <div className="mt-3 text-[26px] font-black leading-none tracking-[-0.04em] tabular-nums text-slate-900">{share}%</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {Number(company.revenue) > 0
              ? <>dari revenue perusahaan · <b className="text-slate-800">{fmtJt(me.revenue)}</b> dari {fmtJt(company.revenue)}</>
              : "Belum ada deal masuk bulan ini"}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/70">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-violet-500 motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${share}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
            <span>Deal lu: {me.deals}</span>
            <span>Team lain: {Math.max(0, Number(company.deals) - Number(me.deals))}</span>
          </div>
        </Panel>

        <Panel icon={Target} tone="bg-emerald-50 text-emerald-600" title="Target pribadi">
          {Number(me.target) > 0 ? (
            <div className="mt-2 flex flex-col items-center text-center">
              <Gauge pct={myPct} forecastPct={myProjected} color="#10b981" soft="#a7f3d0" />
              <div className="text-[12px] tabular-nums text-slate-600"><b className="text-slate-900">{fmtJt(me.revenue)}</b> / {fmtJt(me.target)}</div>
              <div className="mt-0.5 text-[10.5px] tabular-nums text-slate-400">Forecast pipeline {fmtJt(me.forecast)}</div>
            </div>
          ) : (
            <div className="mt-3 text-[11.5px] text-slate-500">Manager belum set target lu bulan ini. Forecast pipeline lu: <b className="text-slate-800">{fmtJt(me.forecast)}</b></div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="text-[11px] font-semibold text-slate-500">Revenue perusahaan 6 bulan terakhir</div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {trend.map((t, i) => {
              const cur = i === trend.length - 1;
              const v = Number(t.revenue);
              return (
                <div key={t.month} className="flex flex-col items-center" title={fmtJt(v)}>
                  <span className={`text-[9.5px] tabular-nums ${cur ? "font-bold text-orange-600" : "text-slate-400"}`}>{v > 0 ? fmtJt(v).replace("Rp", "") : "-"}</span>
                  <div className="mt-1 flex h-14 w-full items-end justify-center">
                    <div className={`w-3/5 max-w-[28px] rounded-t-md ${cur ? "bg-gradient-to-t from-orange-500 to-violet-400" : v ? "bg-orange-200" : "bg-slate-100"}`} style={{ height: `${v > 0 ? Math.max(8, Math.round((v / maxTrend) * 100)) : 4}%` }} />
                  </div>
                  <span className="mt-1 text-[10px] text-slate-500">{new Date(t.month + "T00:00:00Z").toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" })}</span>
                </div>
              );
            })}
          </div>
        </div>
        {allTime && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Sepanjang masa</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                [allTime.total, "Total lead"],
                [`${allTime.win_rate}%`, "Win rate"],
                [allTime.deals, "Deal closing"],
                [fmtJt(allTime.revenue), "Total revenue"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-[17px] font-black leading-none tracking-[-0.03em] tabular-nums text-slate-900">{v}</div>
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
