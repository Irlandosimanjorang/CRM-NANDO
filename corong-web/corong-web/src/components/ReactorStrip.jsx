import { useId } from "react";

// ============================================================
// REACTOR STRIP (5 Sep 2026) - widget "mesin futuristic" di paling atas
// Dashboard. Iterasi ke-3: v1 ticker horizontal ditolak (kesannya kayak
// footer TV), v2 orbital circle gede ditolak (kesannya kayak page sendiri,
// warna gelap gak nyatu sama Dashboard). Versi ini: background PUTIH
// PERSIS kayak StatCard/RevenueCard yang udah ada (bg-white, border-
// slate-100, rounded-[28px], shadow soft) - bukan kotak gelap sendiri.
// Reactor core (sirip turbin muter + ring ganda) mancarin 4 konduit energi
// ke panel data HUD, tiap panel nampilin statistik ASLI dari Dashboard
// (bukan data karangan). Bracket sudut sempet ada di draft, DIBUANG atas
// permintaan - desain final gak pakai itu.
// ============================================================

const PANELS = [
  { key: "active", label: "LEAD AKTIF", x: 271, bg: "#f8fafc", border: "#bae6fd", text: "#0284c7", dot: "#0ea5e9", curve: "Q180,16 270,50" },
  { key: "followup", label: "FOLLOW-UP", x: 431, bg: "#fff7ed", border: "#fed7aa", text: "#ea580c", dot: "#f97316", curve: "Q230,88 430,52" },
  { key: "visitsToday", label: "VISIT", x: 591, bg: "#faf5ff", border: "#e9d5ff", text: "#9333ea", dot: "#a855f7", curve: "Q330,12 590,50" },
  { key: "deals", label: "DEAL", x: 751, bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2", dot: "#06b6d4", curve: "Q430,92 750,52" },
];

export default function ReactorStrip({ stats }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glowId = `reactor-glow-${uid}`;

  return (
    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] h-[104px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,.13) 1px, transparent 0)", backgroundSize: "16px 16px" }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-[120px] bg-gradient-to-r from-transparent via-orange-500/[0.07] to-transparent" style={{ animation: "reactor-sweep 5s ease-in-out infinite" }} />

      <div className="absolute right-3.5 top-2.5 z-10 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-45" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-orange-600">Live</span>
      </div>

      <svg viewBox="0 0 900 104" preserveAspectRatio="none" className="relative block h-[104px] w-full">
        <defs>
          <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffedd5" /><stop offset="45%" stopColor="#f97316" /><stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
        </defs>

        {/* konduit energi dari core ke tiap panel */}
        {PANELS.map((p) => (
          <path key={`path-${p.key}`} id={`conduit-${p.key}-${uid}`} d={`M78,54 ${p.curve}`} fill="none" stroke={p.dot} strokeOpacity="0.3" strokeWidth="1.6" />
        ))}
        {PANELS.map((p, i) => (
          <circle key={`dot-${p.key}`} r="3.2" fill={p.dot} filter={`url(#${glowId})`}>
            <animateMotion dur="2.8s" repeatCount="indefinite" begin={`${i * 0.55}s`}>
              <mpath href={`#conduit-${p.key}-${uid}`} />
            </animateMotion>
          </circle>
        ))}

        {/* reactor core - sirip turbin muter + ring dashed + inti berdenyut */}
        <g transform="translate(78,54)">
          <circle r="30" fill="none" stroke="#fed7aa" strokeWidth="1" strokeDasharray="2 4">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
          </circle>
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            <g stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round">
              <line x1="0" y1="-24" x2="0" y2="-17" /><line x1="17" y1="-17" x2="12" y2="-12" />
              <line x1="24" y1="0" x2="17" y2="0" /><line x1="17" y1="17" x2="12" y2="12" />
              <line x1="0" y1="24" x2="0" y2="17" /><line x1="-17" y1="17" x2="-12" y2="12" />
              <line x1="-24" y1="0" x2="-17" y2="0" /><line x1="-17" y1="-17" x2="-12" y2="-12" />
            </g>
          </g>
          <circle r="12" fill={`url(#core-${uid})`} filter={`url(#${glowId})`}>
            <animate attributeName="r" values="11;13;11" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <text x="0" y="46" textAnchor="middle" fontSize="6.5" fontWeight="800" letterSpacing="1.5" fill="#fb923c" fontFamily="ui-sans-serif, system-ui">SYNC</text>
        </g>

        {/* panel data HUD - tiap panel 1 statistik asli */}
        {PANELS.map((p) => {
          const value = stats?.[p.key] ?? 0;
          return (
            <g key={p.key} fontFamily="ui-sans-serif, system-ui, sans-serif">
              <rect x={p.x - 33} y="22" width="66" height="52" rx="10" fill={p.bg} stroke={p.border} strokeWidth="1.3" />
              <text x={p.x} y="49" textAnchor="middle" fontSize="19" fontWeight="800" fill="#0f172a">{value}</text>
              <text x={p.x} y="65" textAnchor="middle" fontSize="6.8" fontWeight="700" letterSpacing="0.4" fill={p.text}>{p.label}</text>
            </g>
          );
        })}
      </svg>

      <style>{`
        @keyframes reactor-sweep {
          0% { left: -120px; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
