import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";

// Tahap uji: hanya untuk akun ini sampai fitur disetujui. Pengecekan juga ada di RLS database.
const UID_UJI = "45dadf81-c11a-465b-ac9d-47e1a1aae83c";

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

const SINGKAT = {
  deal: "Deal",
  dana_masuk: "Payment",
  spk: "SPK",
  spkp: "SPKP",
  produksi: "Prod",
  produksi_qc: "QC",
  delivery: "DEV",
  instalasi: "INS",
  instalasi_qc: "BAP",
  full_payment: "BAST",
};

const rp = (n) =>`Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
const tgl = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "");
const labelTahap = (key) => TAHAP.find((t) => t.key === key)?.label || key || "-";

function Progres({ tahap }) {
  const [aktif, setAktif] = useState(null);
  const jumlahSelesai = TAHAP.filter((t) => !!(tahap || []).find((x) => x.key === t.key)?.selesai).length;
  const persen = Math.round((jumlahSelesai / TAHAP.length) * 100);
  const detail = aktif ? (tahap || []).find((x) => x.key === aktif) : null;
  const infoAktif = TAHAP.find((t) => t.key === aktif);

  const statusAktif = (() => {
    if (!detail) return null;
    if (detail.selesai) return { teks: "Selesai", warna: "bg-emerald-500" };
    if (detail.mulai) return { teks: "Sedang berjalan", warna: "bg-amber-400" };
    return { teks: "Belum dimulai", warna: "bg-slate-300" };
  })();

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{jumlahSelesai} dari {TAHAP.length} tahap</span>
        <span className="font-medium tabular-nums text-slate-700">{persen}%</span>
      </div>
      <div className="grid grid-cols-10 gap-[3px]" role="group" aria-label="Progres tahap">
        {TAHAP.map((t, i) => {
          const s = (tahap || []).find((x) => x.key === t.key);
          const selesai = !!s?.selesai;
          const berjalan = !selesai && !!s?.mulai;
          const tampil = aktif === t.key;
          const posisi = i === 0 ? "left-0" : i === TAHAP.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <div key={t.key} className="relative">
              <button
                type="button"
                aria-label={`${t.label}, ${selesai ? "selesai" : berjalan ? "sedang berjalan" : "belum dimulai"}`}
                onMouseEnter={() => setAktif(t.key)}
                onMouseLeave={() => setAktif(null)}
                onFocus={() => setAktif(t.key)}
                onBlur={() => setAktif(null)}
                onClick={() => setAktif((v) => (v === t.key ? null : t.key))}
                className={`block h-2.5 w-full rounded-[4px] ${selesai ? "bg-emerald-500" : berjalan ? "bg-amber-400" : "bg-slate-200"} ${tampil ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
              />
              {tampil && infoAktif && statusAktif && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute top-full z-30 mt-2 w-[184px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[12px] shadow-md ${posisi}`}
                >
                  <p className="font-medium text-slate-900">{infoAktif.label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-slate-700">
                    <span className={`inline-block h-2 w-2 rounded-full ${statusAktif.warna}`} aria-hidden="true" />
                    {statusAktif.teks}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums text-slate-600">
                    <dt className="text-slate-500">Mulai</dt>
                    <dd>{detail?.mulai ? tgl(detail.mulai) : "-"}</dd>
                    <dt className="text-slate-500">Selesai</dt>
                    <dd>{detail?.selesai ? tgl(detail.selesai) : "-"}</dd>
                  </dl>
                  <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">Menyumbang 10% dari progres</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-10 gap-[3px] text-center text-[9px] leading-tight tracking-tight text-slate-500" aria-hidden="true">
        {TAHAP.map((t) => (
          <span key={t.key} className="whitespace-nowrap">{SINGKAT[t.key]}</span>
        ))}
      </div>
    </div>
  );
}

export default function ProgresDealBar() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [galat, setGalat] = useState("");
  const [uid, setUid] = useState(null);

  useEffect(() => { db.getCurrentUserId().then(setUid).catch(() => setUid(null)); }, []);

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
    if (uid !== UID_UJI) return undefined;
    muat();
    const t = setInterval(muat, 60000);
    return () => clearInterval(t);
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const tekan = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [open]);

  if (uid !== UID_UJI) return null;

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

      <section
        role="dialog"
        aria-label="Progres deal"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(92vw,400px)] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
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
            <div className="flex flex-col gap-3">
              {rows.map((r) => {
                const p = r.payload || {};
                const nilai = Number(p.nilai) || 0;
                const terbayar = Number(p.terbayar) || 0;
                return (
                  <article key={r.lead_id} className="rounded-xl border-2 border-slate-300 bg-white p-3.5">
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Buka progres deal"
        className={`fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-md bg-slate-900 px-1 py-2 text-white shadow-md transition-opacity duration-200 hover:bg-slate-800 ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180">Progres deal</span>
        <span className="rounded-full bg-white px-1 text-[9px] font-medium tabular-nums leading-4 text-slate-900">{rows.length}</span>
      </button>
    </>
  );
}
