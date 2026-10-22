// Panel "Konteks AI" (23 Okt 2026): memperlihatkan apa saja yang masuk ke konteks AI untuk user yang login.
// Bagian yang masuk prompt dibatasi 2400 karakter (build_memory_context). Fakta pipeline hanya dipakai agen.
// Token dihitung perkiraan (karakter / 4), bukan jumlah token resmi model.

const cn = (...v) => v.filter(Boolean).join(" ");

const PROMPT_PARTS = ["Profil perusahaan", "Pola organisasi", "Memori pribadi"];
const SEG_COLORS = ["bg-indigo-500", "bg-sky-500", "bg-emerald-500"];
const SOURCE_LABEL = { agen: "ringkasan agen", aturan: "aturan", "belum ada": "belum ada", org_product_catalog: "katalog produk", org_memory: "memori organisasi", member_facts: "fakta pipeline" };

function formatWaktu(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

export default function AiContextPanel({ data }) {
  const bagian = data?.bagian || [];
  const limit = data?.batas_karakter || 2400;
  const promptBagian = bagian.filter((b) => PROMPT_PARTS.includes(b.nama));
  const dipakai = Math.min(promptBagian.reduce((s, b) => s + (b.karakter || 0), 0), limit);
  const pct = Math.round((100 * dipakai) / limit);
  const berubah = data?.perubahan_sejak_update || 0;
  const terakhir = formatWaktu(data?.terakhir_diperbarui);

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-slate-700">Konteks AI</div>
        <div className="text-[11px] font-semibold text-slate-500 tabular-nums">{pct}% dipakai</div>
      </div>

      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Konteks AI terpakai ${pct} persen`}>
        {promptBagian.map((b, i) => {
          const w = Math.min(100, (100 * (b.karakter || 0)) / limit);
          return w > 0 ? <div key={b.nama} className={SEG_COLORS[i % SEG_COLORS.length]} style={{ width: `${w}%` }} /> : null;
        })}
      </div>

      <ul className="mt-3 space-y-2">
        {bagian.map((b, i) => {
          const isPrompt = PROMPT_PARTS.includes(b.nama);
          const token = Math.ceil((b.karakter || 0) / 4);
          return (
            <li key={b.nama} className="flex items-center justify-between gap-3 text-[11.5px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", isPrompt ? SEG_COLORS[promptBagian.indexOf(b) % SEG_COLORS.length] : "bg-slate-300")} />
                <span className="truncate text-slate-700">{b.nama}</span>
                <span className="truncate text-slate-400">· {SOURCE_LABEL[b.sumber] || b.sumber}</span>
              </div>
              <div className="shrink-0 text-right tabular-nums text-slate-500">
                {b.karakter > 0 ? `±${token.toLocaleString("id-ID")} token` : "kosong"}
                {!isPrompt && <span className="ml-1 text-slate-400">(untuk agen)</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{terakhir ? `Agen terakhir diperbarui ${terakhir}` : "Agen belum pernah memperbarui ringkasan"}</span>
        <span className={cn("font-semibold", berubah > 0 ? "text-amber-600" : "text-slate-500")}>
          {berubah > 0 ? `${berubah} perubahan sejak update terakhir` : "Tidak ada perubahan sejak update terakhir"}
        </span>
      </div>
    </div>
  );
}
