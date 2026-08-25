import { useState } from "react";
import { Loader2, ArrowRight, Factory, Car, Building2, Boxes, ShieldCheck, ShoppingBag } from "lucide-react";
import { INDUSTRY_TEMPLATES } from "../lib/industryTemplates";

// Duplikat kecil dari NextoBadge di App.jsx - sengaja gak di-import biar gak
// bikin circular import (App.jsx <-> IndustryPicker.jsx).
function Badge({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <path d="M51,92 L17.04,15.15 Q13,6 21.46,11.34 L51,30 Z" fill="#f97316" />
      <path d="M51,92 L51,30 L80.54,11.34 Q89,6 84.96,15.15 Z" fill="#9a3412" />
    </svg>
  );
}

const ICONS = {
  pvc_chemical: Factory,
  automotive: Car,
  property: Building2,
  b2b_general: Boxes,
  insurance: ShieldCheck,
  retail_fmcg: ShoppingBag,
};

// Ditampilin SEKALI doang ke org yang belum pernah milih industri (org.industry
// masih null) DAN belum punya pipeline sama sekali. Pilihan ini nentuin pipeline
// + label field bawaan yang di-seed - bisa diedit lagi belakangan lewat Settings.
export default function IndustryPicker({ onSelect, busy }) {
  const [picked, setPicked] = useState(null);

  const confirm = () => {
    if (!picked || busy) return;
    onSelect(picked);
  };

  return (
    <div className="min-h-screen bg-[#0b101a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Badge size={48} />
          <h1 className="text-white text-2xl font-bold mt-4">Industri bisnis kamu apa?</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-md">
            Nexto bakal nyiapin pipeline & istilah yang sesuai. Bisa diubah lagi kapan aja lewat Pengaturan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(INDUSTRY_TEMPLATES).map((tpl) => {
            const Icon = ICONS[tpl.key] || Boxes;
            const active = picked === tpl.key;
            return (
              <button
                key={tpl.key}
                onClick={() => setPicked(tpl.key)}
                disabled={busy}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? "border-orange-500 bg-orange-500/10 ring-4 ring-orange-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${active ? "bg-orange-500 text-white" : "bg-white/10 text-slate-300"}`}>
                  <Icon size={20} />
                </div>
                <div className="text-white font-semibold text-sm">{tpl.label}</div>
                <div className="text-slate-400 text-xs mt-1 leading-relaxed">{tpl.description}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={confirm}
          disabled={!picked || busy}
          className="w-full mt-6 py-3.5 rounded-xl bg-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <>Lanjut <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}
