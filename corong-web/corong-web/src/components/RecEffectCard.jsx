import { useEffect, useState } from "react";
import * as db from "../lib/db";
import { PanelHeader } from "../ui";

// Efektivitas rekomendasi AI (11 Okt 2026, langkah 1 Memory Engine): mengukur apakah rekomendasi harian ditindaklanjuti
// (ada catatan atau perpindahan tahap oleh penerima dalam 3 hari) dan apakah lead lalu maju tahap. Ini perbandingan
// pengamatan, bukan bukti sebab-akibat, dan sampelnya perlu cukup besar. Tidak tampil bila belum ada rekomendasi tercatat.
const pct = (a, n) => (n > 0 ? `${Math.round((a / n) * 100)}%` : "-");
const MIN_SAMPLE = 30;

export default function RecEffectCard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    db.getRecommendationEffect(90).then((r) => { if (alive) setD(r); }).catch(() => { if (alive) setD(null); });
    return () => { alive = false; };
  }, []);
  if (!d || !d.total) return null;
  const f = d.ditindaklanjuti || { n: 0, maju: 0, menang: 0, kalah: 0 };
  const nf = d.tidak_ditindaklanjuti || { n: 0, maju: 0, menang: 0, kalah: 0 };
  const small = d.total < MIN_SAMPLE;
  const row = (label, g) => (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-3 text-[12.5px] font-medium text-slate-700">{label}</td>
      <td className="px-3 py-2 text-right text-[12.5px] tabular-nums">{g.n}</td>
      <td className="px-3 py-2 text-right text-[12.5px] tabular-nums">{g.maju} <span className="text-slate-400">({pct(g.maju, g.n)})</span></td>
      <td className="px-3 py-2 text-right text-[12.5px] tabular-nums">{g.menang}</td>
      <td className="py-2 pl-3 text-right text-[12.5px] tabular-nums">{g.kalah}</td>
    </tr>
  );
  return (
    <section className="rounded-panel border border-slate-200/80 bg-white p-5 sm:p-6">
      <PanelHeader className="mb-4" title="Efektivitas rekomendasi AI" meta={`${d.total} rekomendasi dalam ${d.hari} hari terakhir. ${pct(f.n, d.total)} ditindaklanjuti dalam 3 hari.`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold text-slate-500">
              <th className="pb-1.5 pr-3 text-left">Kelompok</th><th className="px-3 pb-1.5 text-right">Rekomendasi</th><th className="px-3 pb-1.5 text-right">Maju tahap</th><th className="px-3 pb-1.5 text-right">Menang</th><th className="pb-1.5 pl-3 text-right">Kalah</th>
            </tr>
          </thead>
          <tbody>{row("Ditindaklanjuti", f)}{row("Tidak ditindaklanjuti", nf)}</tbody>
        </table>
      </div>
      <p className={`mt-3 text-[11.5px] ${small ? "text-amber-700" : "text-slate-500"}`}>
        {small
          ? `Sampel masih kecil (${d.total} dari minimal ${MIN_SAMPLE}). Jangan menyimpulkan apa pun dari angka ini dulu.`
          : "Perbandingan pengamatan: lead yang ditindaklanjuti mungkin memang yang lebih menjanjikan, jadi selisihnya belum membuktikan rekomendasi yang menyebabkannya."}
      </p>
    </section>
  );
}
