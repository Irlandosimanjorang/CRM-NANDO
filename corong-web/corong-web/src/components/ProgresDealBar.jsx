import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";

// Hanya untuk organisasi BSB (PT. Bangun Selaras Bersama). Pengecekan juga ada di RLS database.
const ORG_BSB = "43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0";

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

// Warna sama dengan strip di journey (StageStrip.jsx): di bawah 50% merah muda, 50 sampai 70% kuning, di atas 70% teal.
// Tahap yang sudah 100% memakai teal tua. Tahap yang belum mulai memakai warna netral dari journey.
const tahapColor = (pct) => (pct < 50 ? "#E8917F" : pct <= 70 ? "#E9C77F" : "#7FD9D1");
const WARNA_SELESAI = "#2E9B94";
const WARNA_BELUM = "#3E6469";
const WARNA_TEKS_BELUM = "#5F7F84";

const rp = (n) =>`Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
const tgl = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "");
const labelTahap = (key) => TAHAP.find((t) => t.key === key)?.label || key || "-";

// pcts: persen tiap tahap dari journey, urutannya sama dengan TAHAP. Kalau belum ada (data lama), selesai = 100, lainnya 0.
// Jasa (24 Nov 2026): tanpa SPK sampai Delivery dan BAST. Persen tiap tahap tetap dibaca dari posisi TAHAP asli.
const TAHAP_JASA_DILEWATI = ["spk", "spkp", "produksi", "produksi_qc", "delivery", "full_payment"];
function Progres({ tahap, tahapSekarang, pcts, jenis }) {
  const [aktif, setAktif] = useState(null);
  const lewati = jenis === "jasa" ? TAHAP_JASA_DILEWATI : [];
  const tahapAktif = TAHAP.map((t, i) => ({ ...t, i })).filter((t) => !lewati.includes(t.key));
  const kolom = `repeat(${tahapAktif.length}, minmax(0, 1fr))`;
  const daftar = tahapAktif.map((t) => {
    const i = t.i;
    const s = (tahap || []).find((x) => x.key === t.key);
    const selesai = !!s?.selesai;
    const pct = Array.isArray(pcts) && typeof pcts[i] === "number"
      ? Math.max(0, Math.min(100, Math.round(pcts[i])))
      : selesai ? 100 : 0;
    const sekarang = !selesai && t.key === tahapSekarang;
    const aktifTahap = pct > 0 || sekarang;
    const warna = pct >= 100 ? WARNA_SELESAI : aktifTahap ? tahapColor(pct) : WARNA_BELUM;
    const warnaTeks = pct >= 100 ? WARNA_SELESAI : aktifTahap ? tahapColor(pct) : WARNA_TEKS_BELUM;
    return { ...t, s, selesai, pct, sekarang, warna, warnaTeks };
  });
  const jumlahSelesai = daftar.filter((d) => d.selesai).length;
  // Jasa (24 Nov 2026): total tidak boleh melampaui Payment, sama seperti di Journey.
  const persenRata = Math.round(daftar.reduce((a, d) => a + d.pct, 0) / daftar.length);
  const persenBayar = daftar.find((d) => d.key === "dana_masuk")?.pct ?? 100;
  const persen = jenis === "jasa" ? Math.min(persenRata, persenBayar) : persenRata;
  const detail = daftar.find((d) => d.key === aktif) || null;
  const statusTeks = (d) => (d.selesai ? "Selesai" : d.sekarang || d.pct > 0 ? `Sedang berjalan · ${d.pct}%` : "Belum dimulai");

  return (
    <div>
      <style>{`@keyframes stage-run { from { background-position: -80px 0, 0 0; } to { background-position: calc(100% + 80px) 0, 0 0; } }`}</style>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{jumlahSelesai} dari {daftar.length} tahap selesai</span>
        <span className="font-medium tabular-nums text-slate-700">{persen}%</span>
      </div>
      <div className="grid gap-[3px] text-center font-mono text-[10px] tabular-nums" style={{ gridTemplateColumns: kolom }} aria-hidden="true">
        {daftar.map((d) => (
          <span key={d.key} style={{ color: d.warnaTeks }} className={d.sekarang ? "font-semibold" : ""}>{d.pct}%</span>
        ))}
      </div>
      <div className="mt-1 grid gap-[3px]" style={{ gridTemplateColumns: kolom }} role="group" aria-label="Progres tahap">
        {daftar.map((d, i) => {
          const tampil = aktif === d.key;
          const posisi = i === 0 ? "left-0" : i === daftar.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <div key={d.key} className="relative">
              <button
                type="button"
                aria-label={`${d.label}, ${d.pct}%`}
                onMouseEnter={() => setAktif(d.key)}
                onMouseLeave={() => setAktif(null)}
                onFocus={() => setAktif(d.key)}
                onBlur={() => setAktif(null)}
                onClick={() => setAktif((v) => (v === d.key ? null : d.key))}
                className={`block h-3 w-full ${tampil ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
              >
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    background: d.sekarang
                      ? `linear-gradient(100deg, transparent 0%, rgba(207,250,246,0.7) 50%, transparent 100%) no-repeat, ${d.warna}`
                      : d.warna,
                    backgroundSize: d.sekarang ? "60px 100%, auto" : undefined,
                    animation: d.sekarang ? "stage-run 2.4s ease-in-out infinite" : undefined,
                    transform: "skewX(-20deg)",
                  }}
                />
              </button>
              {tampil && detail && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute top-full z-30 mt-2 w-[184px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[12px] shadow-md ${posisi}`}
                >
                  <p className="font-medium text-slate-900">{detail.label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-slate-700">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: detail.warna }} aria-hidden="true" />
                    {statusTeks(detail)}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums text-slate-600">
                    <dt className="text-slate-500">Mulai</dt>
                    <dd>{detail.s?.mulai ? tgl(detail.s.mulai) : "-"}</dd>
                    <dt className="text-slate-500">Selesai</dt>
                    <dd>{detail.s?.selesai ? tgl(detail.s.selesai) : "-"}</dd>
                  </dl>
                  <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">Menyumbang 10% dari progres</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-[3px] text-center text-[9px] leading-tight tracking-tight text-slate-500" style={{ gridTemplateColumns: kolom }} aria-hidden="true">
        {daftar.map((t) => (
          <span key={t.key} className="whitespace-nowrap">{SINGKAT[t.key]}</span>
        ))}
      </div>
    </div>
  );
}

function KartuDeal({ r }) {
  const p = r.payload || {};
  const nilai = Number(p.nilai) || 0;
  const terbayar = Number(p.terbayar) || 0;
  return (
    <article className="rounded-xl border-2 border-slate-300 bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[14px] font-medium text-slate-900">{p.judul || p.customer || "Proyek"}</h3>
        <span className="shrink-0 text-[12px] text-slate-500">{p.selesai ? "Selesai" : labelTahap(p.tahap_sekarang)}</span>
      </div>
      <div className="mt-2">
        <Progres tahap={p.tahap} tahapSekarang={p.tahap_sekarang} pcts={p.pcts} jenis={p.jenis} />
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
}

export default function ProgresDealBar() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [galat, setGalat] = useState("");
  const [boleh, setBoleh] = useState(false);
  const [showSelesai, setShowSelesai] = useState(false);

  useEffect(() => {
    db.getCurrentUserId()
      .then(async (uid) => {
        if (!uid) { setBoleh(false); return; }
        const { data } = await supabase
          .from("organization_members")
          .select("org_id")
          .eq("user_id", uid)
          .eq("org_id", ORG_BSB)
          .maybeSingle();
        setBoleh(!!data);
      })
      .catch(() => setBoleh(false));
  }, []);

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
    if (!boleh) return undefined;
    muat();
    const t = setInterval(muat, 60000);
    return () => clearInterval(t);
  }, [boleh]);

  useEffect(() => {
    if (!open) return;
    const tekan = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [open]);

  const berjalanRows = rows.filter((r) => !r.payload?.selesai);
  const selesaiRows = rows.filter((r) => !!r.payload?.selesai);

  if (!boleh) return null;

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
              <p className="text-[12px] text-slate-500">{berjalanRows.length} berjalan, {selesaiRows.length} selesai</p>
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

          <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {galat && <p className="px-1 text-[13px] text-red-600">{galat}</p>}
            {!galat && rows.length === 0 && (
              <p className="px-1 py-6 text-center text-[13px] text-slate-500">Belum ada deal yang tercatat di proyek.</p>
            )}
            <div className="flex flex-col gap-3">
              {berjalanRows.map((r) => (
                <KartuDeal key={r.lead_id} r={r} />
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-slate-100 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setShowSelesai((v) => !v)}
              disabled={selesaiRows.length === 0}
              aria-expanded={showSelesai}
              className="flex w-full items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800 disabled:cursor-default disabled:hover:text-slate-500"
            >
              <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
              <span>Selesai</span>
              <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
            </button>
          </div>
          {showSelesai && selesaiRows.length > 0 && (
            <div className="max-h-[50vh] shrink-0 overflow-y-auto border-t border-slate-100 p-3">
              <div className="flex flex-col gap-3">
                {selesaiRows.map((r) => (
                  <KartuDeal key={r.lead_id} r={r} />
                ))}
              </div>
            </div>
          )}
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
