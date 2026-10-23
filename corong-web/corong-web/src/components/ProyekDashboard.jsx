// Dashboard lead proyek (23 Okt 2026): lead dengan track = 'proyek' dipisah dari pipeline tim marketing.
// Dipakai di tab Team dan Report untuk manajer. Angka dihitung dari lead yang sudah dimuat (tanpa query baru).

const fmtRp = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");

function hariSejak(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function ProyekDashboard({ leads = [], stages = [] }) {
  const proyek = leads.filter((l) => l.track === "proyek" && !l.deleted_at);
  if (proyek.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-[13px] font-semibold text-slate-800">Lead proyek</div>
        <p className="mt-1 text-[12px] text-slate-500">Belum ada lead proyek. Lead yang diinput admin proyek akan muncul di sini.</p>
      </section>
    );
  }

  const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stages.filter((s) => s.type === "lost").map((s) => s.key);
  const aktif = proyek.filter((l) => !wonKeys.includes(l.stage_key) && !lostKeys.includes(l.stage_key));
  const menang = proyek.filter((l) => wonKeys.includes(l.stage_key));
  const nilai = (arr) => arr.reduce((n, l) => n + (Number(l.deal_value) || 0), 0);
  const perTahap = stages
    .filter((s) => s.type !== "won" && s.type !== "lost")
    .map((s) => {
      const items = proyek.filter((l) => l.stage_key === s.key);
      return { key: s.key, label: s.label, count: items.length, total: nilai(items) };
    });
  const teratas = [...aktif].sort((a, b) => (Number(b.deal_value) || 0) - (Number(a.deal_value) || 0)).slice(0, 8);
  const maxTotal = Math.max(1, ...perTahap.map((t) => t.total));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-800">Lead proyek</div>
          <div className="text-[11.5px] text-slate-500">Terpisah dari pipeline tim marketing.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Proyek aktif", aktif.length.toLocaleString("id-ID")],
          ["Nilai pipeline", fmtRp(nilai(aktif))],
          ["Proyek menang", menang.length.toLocaleString("id-ID")],
          ["Nilai menang", fmtRp(nilai(menang))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold text-slate-700">Per tahap</div>
        <div className="space-y-2">
          {perTahap.map((t) => (
            <div key={t.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[12px]">
              <span className="truncate text-slate-700">{t.label}</span>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-orange-500" style={{ width: `${(100 * t.total) / maxTotal}%` }} />
              </div>
              <span className="tabular-nums text-slate-500">{t.count} · {fmtRp(t.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold text-slate-700">Proyek bernilai terbesar</div>
        <ul className="divide-y divide-slate-100">
          {teratas.map((l) => {
            const days = hariSejak(l.last_contact);
            const stage = stages.find((s) => s.key === l.stage_key);
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{l.name}</div>
                  <div className="truncate text-slate-500">{stage?.label || l.stage_key}{l.next_action ? ` · ${l.next_action}` : ""}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums text-slate-900">{l.deal_value ? fmtRp(l.deal_value) : "Nilai belum diisi"}</div>
                  <div className={days === null || days > 7 ? "text-rose-600" : "text-slate-500"}>
                    {days === null ? "belum dihubungi" : days === 0 ? "hari ini" : `${days} hari lalu`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
