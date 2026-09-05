import { Database, BrainCircuit, Zap, Layers } from "lucide-react";
import { NextoRobotHead } from "../Auth";

// ============================================================
// LIVE ENGINE LOOP (5 Sep 2026) - versi compact dari "NEXTO AI Engine Loops"
// di landing page (Context/Decision/Action/Memory Engine muter ngelilingin
// robot core), ditaro di paling atas Dashboard. Bedanya: di sini tiap node
// nampilin STATISTIK ASLI (bukan deskripsi generik) - Lead Aktif itu "yang
// dibaca" Context Engine, Follow-up itu "keputusan" Decision Engine, Visit
// hari ini itu "aksi" Action Engine, Deal itu "hasil" Memory Engine. Jadi
// tetep satu bahasa visual sama landing page, tapi fungsinya beda: nunjukin
// data live, bukan jualan fitur ke calon customer.
// ============================================================

const RADIUS = 78;
const NODES = [
  { key: "active", label: "Lead Aktif", icon: Database, color: "#38bdf8", angle: -90 },
  { key: "followup", label: "Follow-up", icon: BrainCircuit, color: "#f97316", angle: 0 },
  { key: "visitsToday", label: "Visit", icon: Zap, color: "#a855f7", angle: 90 },
  { key: "deals", label: "Deal", icon: Layers, color: "#22d3ee", angle: 180 },
];

export default function LiveEngineLoop({ stats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 shadow-[0_10px_40px_-22px_rgba(249,115,22,0.5)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(249,115,22,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,.4) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(circle at center, black 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 0%, transparent 80%)",
        }}
      />

      <div className="relative mb-3 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-400">Nexto Engine · Live</span>
      </div>

      <div className="relative mx-auto" style={{ width: 300, height: 220, maxWidth: "100%" }}>
        {/* cincin orbit - muter pelan terus, sama gaya kayak landing page */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
          style={{
            width: RADIUS * 2, height: RADIUS * 2, marginLeft: -RADIUS, marginTop: -RADIUS,
            borderColor: "rgba(255,255,255,.14)", animation: "nexto-loop-ring 30s linear infinite",
          }}
        />

        {/* spoke dari inti ke tiap node - titik cahaya ngalir terus, delay beda2 per node */}
        {NODES.map((n, i) => {
          const rad = (n.angle * Math.PI) / 180;
          const x2 = RADIUS * Math.cos(rad);
          const y2 = RADIUS * Math.sin(rad);
          const len = Math.sqrt(x2 * x2 + y2 * y2);
          const rot = (Math.atan2(y2, x2) * 180) / Math.PI;
          return (
            <div
              key={`spoke-${n.key}`}
              className="absolute left-1/2 top-1/2 h-px origin-left"
              style={{ width: len, background: `linear-gradient(90deg, ${n.color}77, ${n.color}22)`, transform: `rotate(${rot}deg)` }}
            >
              <span
                className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                style={{
                  background: n.color, boxShadow: `0 0 8px 2px ${n.color}bb`,
                  animation: "nexto-loop-travel 2.6s ease-in-out infinite", animationDelay: `${i * 0.4}s`,
                }}
              />
            </div>
          );
        })}

        {/* inti - robot core, denyut terus */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/25 to-orange-700/10"
            style={{ animation: "nexto-loop-pulse 2.6s ease-in-out infinite" }}
          >
            <NextoRobotHead size={26} />
          </div>
        </div>

        {/* 4 node - tiap titik nampilin 1 statistik asli */}
        {NODES.map((n) => {
          const rad = (n.angle * Math.PI) / 180;
          const x = RADIUS * Math.cos(rad);
          const y = RADIUS * Math.sin(rad);
          const Icon = n.icon;
          const value = stats?.[n.key] ?? 0;
          return (
            <div
              key={n.key}
              className="absolute left-1/2 top-1/2 w-[104px]"
              style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
            >
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center backdrop-blur-sm">
                <Icon size={13} style={{ color: n.color }} className="mx-auto mb-1" />
                <div className="text-[17px] font-bold leading-none text-white">{value}</div>
                <div className="mt-1 truncate text-[8px] font-semibold uppercase tracking-wide text-slate-500">{n.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes nexto-loop-ring { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes nexto-loop-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,.45), 0 0 30px 8px rgba(249,115,22,.25); }
          50% { box-shadow: 0 0 0 10px rgba(249,115,22,0), 0 0 44px 12px rgba(249,115,22,.4); }
        }
        @keyframes nexto-loop-travel {
          0% { left: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
