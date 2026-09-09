// ============================================================
// ENGINE HEADER MINI (5 Sep 2026, redesign 9 Sep 2026) - numpang di
// ruang KOSONG yang UDAH ADA di header desktop (antara label "Sales
// Workspace" dan pill "Data tersinkron") - JADI GAK NAMBAH TINGGI
// SAMA SEKALI. Robot mini + 4 chip statistik (Lead/Follow-up/Visit/
// Deal), warna sama persis kayak Context/Decision/Action/Memory di
// landing page - statistik ASLI dari data yang udah dimuat App.jsx,
// bukan karangan.
//
// Angka-nya ngitung naik dari 0 tiap kartu ini nongol (buka tab
// Dashboard), bukan langsung muncul jadi - biar kerasa "hidup".
// ============================================================

import { useEffect, useRef, useState } from "react";

function useCountUp(target, delayMs) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const to = Number(target) || 0;
    const duration = 700;
    let start = null;

    const tick = (t) => {
      if (start === null) start = t;
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * to));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    const startTimer = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, delayMs);
    return () => { clearTimeout(startTimer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, delayMs]);

  return value;
}

function StatChip({ label, value, color, delayMs, first }) {
  const animated = useCountUp(value, delayMs);
  return (
    <div className={`flex flex-col items-start px-3 leading-[1.05] ${first ? "" : "border-l border-slate-200"}`}>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px 1px ${color}` }} />
        <span className="text-sm font-extrabold text-slate-900 tabular-nums">{animated}</span>
      </div>
      <span className="mt-0.5 text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

export default function EngineHeaderMini({ stats }) {
  const chips = [
    { key: "total", label: "Lead", color: "#0ea5e9" },
    { key: "followup", label: "Follow-up", color: "#f97316" },
    { key: "visitsToday", label: "Visit", color: "#a855f7" },
    { key: "deals", label: "Deal", color: "#22d3ee" },
  ];

  return (
    <div className="hidden items-center gap-3.5 lg:flex">
      <div className="relative h-[30px] w-[30px] shrink-0">
        <div className="absolute -inset-[5px] rounded-xl border border-dashed border-slate-300" style={{ animation: "ehm-spin 8s linear infinite" }} />
        <div className="absolute inset-0 rounded-[9px] border border-slate-400" style={{ background: "linear-gradient(135deg, #f3f5f7, #cbd2da 55%, #9aa5b2)" }} />
        <div className="absolute left-1/2 top-1/2 flex h-[9px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[3px] rounded-[4.5px] bg-[#171717]">
          <span className="h-[3px] w-[3px] rounded-full bg-orange-500" style={{ animation: "ehm-blink 1.6s ease-in-out infinite" }} />
          <span className="h-[3px] w-[3px] rounded-full bg-orange-500" style={{ animation: "ehm-blink 1.6s ease-in-out infinite .15s" }} />
        </div>
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full border-[1.5px] border-white bg-emerald-400" />
      </div>

      <div className="flex items-center">
        {chips.map((c, i) => (
          <StatChip key={c.key} label={c.label} value={stats?.[c.key] ?? 0} color={c.color} delayMs={i * 90} first={i === 0} />
        ))}
      </div>

      <style>{`
        @keyframes ehm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ehm-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
      `}</style>
    </div>
  );
}
