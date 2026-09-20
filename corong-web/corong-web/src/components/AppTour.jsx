// Tur interaktif nunjuk ke tombol sidebar asli (18 Sep 2026, permintaan
// Nando: "kyk umumnya di app lain" - spotlight, bukan modal checklist).
// Cara kerja tiap step: (1) suruh App.jsx pindah ke tab step ini
// (onNavigate), (2) tunggu sebentar biar tab-nya sempet render (arsitektur
// "semua tab tetap ke-mount" bikin ini cepet), (3) cari tombol nav yang
// match `data-tour-nav="<key>"` yang KEBETULAN kelihatan (desktop sidebar
// ATAU bottom-nav mobile - dua-duanya punya atribut sama, cuma satu yang
// visible tergantung ukuran layar), (4) highlight tombol itu pake trik
// box-shadow raksasa (bikin efek spotlight tanpa clip-path) + tooltip di
// sebelahnya.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

function findVisibleNavEl(key) {
  const candidates = document.querySelectorAll(`[data-tour-nav="${key}"]`);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] || null;
}

export default function AppTour({ steps, onNavigate, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);

  const step = steps[idx];

  useEffect(() => {
    if (!step) return;
    onNavigate(step.key);
    setRect(null);
    // Kasih waktu React nge-render tab barunya (mounting pertama kali suatu
    // tab bisa lebih lambat dari sekadar toggle display:none) sebelum
    // ngukur posisi tombol nav-nya.
    const t1 = setTimeout(() => {
      const el = findVisibleNavEl(step.key);
      if (el) el.scrollIntoView({ block: "nearest" });
    }, 60);
    const t2 = setTimeout(() => {
      const el = findVisibleNavEl(step.key);
      if (el) setRect(el.getBoundingClientRect());
    }, 160);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Reposisi ulang kalau window di-resize pas tur lagi jalan.
  useEffect(() => {
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const el = step && findVisibleNavEl(step.key);
        if (el) setRect(el.getBoundingClientRect());
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [step]);

  if (!step) return null;

  const isLast = idx === steps.length - 1;
  const goNext = () => (isLast ? onFinish() : setIdx((i) => i + 1));
  const goBack = () => setIdx((i) => Math.max(0, i - 1));

  // Tooltip diposisiin di sebelah kanan target kalau muat, kalau enggak
  // (target di sisi kanan layar / layar sempit) jatuh ke bawah target -
  // biar gak kepotong keluar viewport di HP.
  let tooltipStyle = { position: "fixed", zIndex: 1301, width: 300 };
  if (rect) {
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight > 340) {
      tooltipStyle.left = rect.right + 16;
      tooltipStyle.top = Math.min(Math.max(rect.top, 16), window.innerHeight - 220);
    } else {
      tooltipStyle.left = Math.min(Math.max(rect.left, 16), window.innerWidth - 316);
      tooltipStyle.top = rect.top > window.innerHeight / 2 ? rect.top - 210 : rect.bottom + 16;
    }
  } else {
    tooltipStyle.left = window.innerWidth / 2 - 150;
    tooltipStyle.top = window.innerHeight / 2 - 90;
  }

  return createPortal(
    <>
      {/* Overlay penuh - nutup interaksi ke halaman di belakangnya, TAPI
          gak bikin gelap total (biar konteks halaman asli tetep keliatan,
          gelapnya cuma dari efek spotlight box-shadow di bawah). */}
      <div className="fixed inset-0 z-[1300]" onClick={(e) => e.stopPropagation()} />

      {rect && (
        <div
          className="fixed z-[1300] rounded-[14px] pointer-events-none transition-all duration-200 ease-out"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 4px #F97316, 0 0 0 9999px rgba(11,15,26,0.72)",
          }}
        />
      )}

      <div style={tooltipStyle} className="rounded-2xl bg-white shadow-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Step {idx + 1} / {steps.length}</span>
          <button onClick={onFinish} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>
        <h3 className="text-[14px] font-bold text-slate-900 mb-1">{step.title}</h3>
        <p className="text-[12.5px] text-slate-600 leading-5 mb-3">{step.desc}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            disabled={idx === 0}
            className="flex items-center gap-1 text-[11.5px] font-medium text-slate-400 disabled:opacity-0 hover:text-slate-600"
          >
            <ArrowLeft size={13} /> Kembali
          </button>
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-semibold px-3.5 py-2"
          >
            {isLast ? "Selesai" : "Lanjut"} {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
