// Layar kunci untuk anggota team (selain owner) saat paket Enterprise team
// sudah berakhir. Keputusan Nando (30 Sep 2026): anggota dikunci, owner tetap
// bisa masuk untuk memperpanjang. Data tidak dihapus - begitu owner
// memperpanjang, anggota cukup muat ulang halaman.
export default function TeamLockedScreen({ orgName, onReload, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-panel border border-slate-200 bg-white p-6 sm:p-8">
        <div className="text-[12px] font-semibold text-slate-500">Nexto</div>
        <h1 className="mt-3 text-xl font-bold text-ink text-balance">Akses team sedang dikunci</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Paket Enterprise untuk team <span className="font-semibold text-ink">{orgName || "Anda"}</span> sudah berakhir.
          Selama belum diperpanjang, hanya owner yang dapat masuk.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Data Anda tetap tersimpan dengan aman. Hubungi owner team untuk memperpanjang paket, lalu muat ulang halaman ini.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button onClick={onReload} className="flex-1 rounded-inner bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Muat ulang</button>
          <button onClick={onLogout} className="flex-1 rounded-inner border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Keluar</button>
        </div>
      </div>
    </div>
  );
}
