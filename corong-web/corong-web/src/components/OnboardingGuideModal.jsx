// Panduan fitur pas pertama kali buka app (18 Sep 2026, permintaan Nando:
// "setiap new user akses nexto, di awal masuk k app harus ada guideline
// dari fitur yang ada menyesuaikan dengan plan si user"). Ditandain SEKALI
// per akun lewat settings.has_seen_onboarding (bukan localStorage, biar
// gak nongol lagi kalau user ganti device/browser) - lihat markOnboardingSeen
// di db.js dan pemanggilannya di App.jsx.
//
// Daftar fiturnya IMPORT dari Auth.jsx (STANDARD_FEATURES/PROFESSIONAL_
// FEATURES/ENTERPRISE_FEATURES) - sumber yang SAMA persis dipake landing
// page buat marketing, biar gak ada 2 daftar fitur yang bisa keselisih beda
// (pelajaran dari drift KNOWLEDGE_BASE SASA yang pernah kejadian).
import { createPortal } from "react-dom";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { NextoRobotHead, STANDARD_FEATURES, PROFESSIONAL_FEATURES, ENTERPRISE_FEATURES } from "../Auth.jsx";

// Free gak punya daftar fitur sendiri di Auth.jsx (marketing landing page
// gak butuh "jual" tier gratis) - daftar singkat ini KHUSUS buat modal
// onboarding ini, disengaja pendek karena emang fitur Free dasar banget.
const FREE_FEATURES = [
  { id: "Kelola Leads dasar", en: "Basic lead management" },
  { id: "Pipeline drag & drop", en: "Drag & drop pipeline" },
  { id: "Catat progress harian", en: "Daily progress notes" },
];

function FeatureSection({ label, accentClass, features }) {
  if (!features.length) return null;
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${accentClass}`}>{label}</p>
      <div className="grid gap-1.5">
        {features.map((f) => (
          <div key={f.id} className="flex items-start gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            <span className="text-[13px] text-slate-700 leading-5">{f.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingGuideModal({ myLevel, isEnterprise, displayName, onClose, onGoSettings }) {
  const planLabel = isEnterprise ? "Enterprise" : myLevel >= 2 ? "Professional" : myLevel >= 1 ? "Standard" : "Free";

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="p-6 bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(249,115,22,.35),transparent_45%)]" />
          <div className="relative flex items-center gap-3">
            <NextoRobotHead size={40} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-300">Selamat Datang</p>
              <h2 className="text-[19px] font-black tracking-tight">Halo, {displayName || "Sales"}! 👋</h2>
            </div>
          </div>
          <p className="relative mt-3 text-[12.5px] text-slate-300 leading-5">
            Ini panduan singkat fitur yang bisa kamu pakai sekarang, sesuai paket <b className="text-white">{planLabel}</b> yang kamu punya.
          </p>
        </div>

        <div className="p-6 max-h-[55vh] overflow-y-auto grid gap-5">
          <FeatureSection label="Free — sudah bisa dipakai" accentClass="text-slate-500" features={FREE_FEATURES} />
          <FeatureSection label="Standard" accentClass="text-sky-600" features={myLevel >= 1 ? STANDARD_FEATURES : []} />
          <FeatureSection label="Professional" accentClass="text-orange-600" features={myLevel >= 2 ? PROFESSIONAL_FEATURES : []} />
          <FeatureSection label="Enterprise" accentClass="text-violet-600" features={isEnterprise ? ENTERPRISE_FEATURES : []} />

          {!isEnterprise && (
            <button
              onClick={onGoSettings}
              className="flex items-center justify-between gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-left hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-orange-600 shrink-0" />
                <span className="text-[12.5px] font-medium text-orange-900">
                  {myLevel >= 2 ? "Ada lebih banyak fitur di paket Enterprise" : "Ada lebih banyak fitur AI di paket lebih tinggi"}
                </span>
              </div>
              <ArrowRight size={15} className="text-orange-500 shrink-0" />
            </button>
          )}
        </div>

        <div className="p-5 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold py-3 transition-colors"
          >
            Mulai Pakai Nexto
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
