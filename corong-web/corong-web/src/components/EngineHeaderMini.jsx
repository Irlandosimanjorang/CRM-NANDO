// ============================================================
// ENGINE HEADER MINI (5 Sep 2026) - versi final setelah beberapa iterasi
// (ticker horizontal, orbital circle, reactor strip - semua ditolak karena
// nambah tinggi/kesan "page sendiri"). Ini numpang di ruang KOSONG yang
// UDAH ADA di header desktop (antara label "Sales Workspace" dan pill
// "Data tersinkron") - JADI GAK NAMBAH TINGGI SAMA SEKALI. Robot mini +
// 4 chip statistik (Lead/Follow-up/Visit/Deal), warna sama persis kayak
// Context/Decision/Action/Memory di landing page - statistik ASLI dari
// data yang udah dimuat App.jsx, bukan karangan.
// ============================================================

export default function EngineHeaderMini({ stats }) {
  const chips = [
    { key: "active", label: "Lead", color: "#0ea5e9" },
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
          <div key={c.key} className={`flex flex-col items-start px-3 leading-[1.05] ${i > 0 ? "border-l border-slate-200" : ""}`}>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px 1px ${c.color}` }} />
              <span className="text-sm font-extrabold text-slate-900">{stats?.[c.key] ?? 0}</span>
            </div>
            <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ehm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ehm-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
      `}</style>
    </div>
  );
}
