import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

// Tombol mengambang di tab Leads: daftar progres deal milik pengguna yang sedang login (17 Nov 2026).
// Data dikirim dari journey setiap ada perubahan (tabel marketing_progres). Akses dibatasi RLS:
// marketing hanya melihat deal yang ditugaskan kepadanya, owner dan manager melihat semua.

const TAHAP = [
  { key: "deal", label: "Deal" },
  { key: "dana_masuk", label: "Payment" },
  { key: "spk", label: "SPK" },
  { key: "spkp", label: "SPKP" },
  { key: "produksi", label: "Produksi" },
  { key: "produksi_qc", label: "Produk QC" },
  { key: "delivery", label: "Delivery" },
  { key: "instalasi", label: "Instalasi" },
  { key: "instalasi_qc", label: "BAP" },
  { key: "full_payment", label: "BAST" },
];

const rp = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
const tgl = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "");
const labelTahap = (key) => TAHAP.find((t) => t.key === key)?.label || key || "-";

function Progres({ tahap }) {
  return (
    <div className="grid grid-cols-10 gap-0.5" role="img" aria-label="Progres tahap">
      {TAHAP.map((t) => {
        const s = (tahap || []).find((x) => x.key === t.key);
        const selesai = !!s?.selesai;
        const berjalan = !selesai && !!s?.mulai;
        return (
          <span
            key={t.key}
            title={t.label}
            className={`h-1.5 rounded-full ${selesai ? "bg-emerald-500" : berjalan ? "bg-amber-400" : "bg-slate-200"}`}
          />
        );
      })}
    </div>
  );
}

export default function ProgresDealBar() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [galat, setGalat] = useState("");

  const muat = async () => {
    const { data, error } = await supabase
      .from("marketing_progres")
      .select("lead_id, payload, sumber_waktu")
      .order("sumber_waktu", { ascending: false });
    if (error) { setGalat("Gagal memuat progres deal."); return; }
    setGalat("");
    setRows(data || []);
  };

  useEffect(() => {
    muat();
    const t = setInterval(muat, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const tekan = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [open]);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Tutup progres deal"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/10"
        />
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Progres deal"
          className="fixed bottom-20 left-1/2 z-50 flex max-h-[70vh] w-[min(92vw,440px)] -translate-x-1/2 flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-[15px] font-medium text-slate-900">Progres deal</h2>
              <p className="text-[12px] text-slate-500">{rows.length} deal</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {galat && <p className="px-1 text-[13px] text-red-600">{galat}</p>}
            {!galat && rows.length === 0 && (
              <p className="px-1 py-6 text-center text-[13px] text-slate-500">Belum ada deal yang tercatat di proyek.</p>
            )}
            <div className="flex flex-col gap-2">
              {rows.map((r) => {
                const p = r.payload || {};
                const nilai = Number(p.nilai) || 0;
                const terbayar = Number(p.terbayar) || 0;
                return (
                  <article key={r.lead_id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate text-[14px] font-medium text-slate-900">{p.judul || p.customer || "Proyek"}</h3>
                      <span className="shrink-0 text-[12px] text-slate-500">{p.selesai ? "Selesai" : labelTahap(p.tahap_sekarang)}</span>
                    </div>
                    <div className="mt-2">
                      <Progres tahap={p.tahap} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <dt className="text-slate-500">Nilai</dt>
                        <dd className="font-medium text-slate-900">{rp(nilai)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Sudah masuk</dt>
                        <dd className="font-medium text-emerald-700">{rp(terbayar)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Belum masuk</dt>
                        <dd className="font-medium text-slate-900">{rp(Math.max(nilai - terbayar, 0))}</dd>
                      </div>
                    </dl>
                    {Array.isArray(p.termin) && p.termin.length > 0 && (
                      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-[12px]">
                        {p.termin.map((t, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-slate-700">{t.label || t.jenis}</span>
                            <span className="text-right text-slate-900">
                              {rp(t.nominal)}
                              <span className={`ml-2 ${t.tanggal_bayar ? "text-emerald-700" : "text-slate-500"}`}>
                                {t.tanggal_bayar ? `dibayar ${tgl(t.tanggal_bayar)}` : t.jatuh_tempo ? `jatuh tempo ${tgl(t.jatuh_tempo)}` : "belum dibayar"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-800 shadow-md hover:bg-slate-50"
      >
        Progres deal
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] tabular-nums text-white">{rows.length}</span>
      </button>
    </>
  );
}
