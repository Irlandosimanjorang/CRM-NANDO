import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trophy, Crown, X, ChevronRight, Percent, Pencil, Check, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";

// Laporan performa tim (leaderboard) - gap yang ketauan pas audit 9 Sep
// 2026: paket Enterprise dijual dengan "role-based visibility" & tim
// sampai 4 orang, tapi Owner/Manager gak punya cara liat siapa yang paling
// closing. Otomatis cuma nongol kalau org emang punya >1 anggota (org solo
// Standard/Professional gak akan pernah lolos cek ini, jadi gak perlu cek
// plan/role terpisah - member_limit org itu sendiri yang udah jadi
// gerbangnya).
//
// === FIX 2x (9 Sep 2026, abis ketauan pas dites Nando) ===
// 1. Win rate awalnya dihitung dari leads.outcome.result (field yang cuma
//    keisi kalau lead ditutup lewat form closing resmi) - beda metode sama
//    SISA app (daily-digest computeStats & Dashboard's PerformanceInsight)
//    yang selalu ngitung won/lost dari POSISI STAGE lead sekarang (stage
//    dengan type='won'/'lost'). Sekarang disamain: SELALU pake stage_key.
// 2. Revenue/deal awalnya di-filter "bulan berjalan" doang - buat tim yang
//    baru mulai / data historisnya tersebar di bulan lain, ini bikin semua
//    orang keliatan "Rp0 · 0 deal" padahal riwayat deal-nya beneran ada.
//    Sekarang all-time.
//
// === PREVIEW KLIK (9 Sep 2026) ===
// Tiap angka (lead/deal/visit) sekarang bisa diklik, munculin popup daftar
// itemnya - klik salah satu item buka lead aslinya (lewat onOpenLead yang
// udah ada, sama kayak tempat lain di Dashboard).
const RANK_STYLE = [
  { avatarBg: "bg-gradient-to-br from-amber-400 to-orange-500", badgeBg: "bg-amber-500" },
  { avatarBg: "bg-gradient-to-br from-slate-300 to-slate-400", badgeBg: "bg-slate-400" },
  { avatarBg: "bg-gradient-to-br from-orange-300 to-orange-400", badgeBg: "bg-orange-400" },
];
const DEFAULT_STYLE = { avatarBg: "bg-slate-200", badgeBg: "bg-slate-300" };

function initials(name, uid) {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const letters = parts.map((w) => w[0].toUpperCase()).join("");
    if (letters) return letters;
  }
  return uid.slice(0, 2).toUpperCase();
}

// Popup daftar item (lead/deal/visit) - klik 1 baris buka lead aslinya kalau
// masih ketemu (bisa aja udah kehapus/gak punya lead_id, di situ dibiarin
// gak bisa diklik daripada nge-crash).
function StatPreviewModal({ title, items, onOpenItem, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-bold text-slate-800">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-slate-400">Belum ada data.</div>
          ) : (
            items.map((it) => {
              const clickable = !!it.leadId;
              const Tag = clickable ? "button" : "div";
              return (
                <Tag
                  key={it.id}
                  onClick={clickable ? () => onOpenItem(it) : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition ${
                    clickable ? "hover:bg-slate-50" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-slate-700">{it.primary}</div>
                    {it.secondary && <div className="mt-0.5 truncate text-[11px] text-slate-400">{it.secondary}</div>}
                  </div>
                  {clickable && <ChevronRight size={15} className="shrink-0 text-slate-300" />}
                </Tag>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TeamLeaderboard({ leads, stages, dealTransactions, onOpenLead, canManage }) {
  const [members, setMembers] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [preview, setPreview] = useState(null); // { title, items }
  // Sistem komisi (18 Sep 2026, permintaan Nando) - map user_id -> rate %,
  // cuma di-fetch/ditampilin kalau canManage (owner/manager) - sales_rep gak
  // perlu liat rate komisi anggota lain di sini (RLS juga udah negakin ini
  // di server, ini cuma nyocokin biar gak fetch data yang gak dipake).
  const [commissions, setCommissions] = useState({});
  const [editingRate, setEditingRate] = useState(null); // user_id yang lagi diedit
  const [rateInput, setRateInput] = useState("");
  const [rateBusy, setRateBusy] = useState(false);

  useEffect(() => {
    db.getOrgMembers().then(setMembers).catch(() => setMembers([]));
    db.getCheckins().then(setCheckins).catch(() => setCheckins([]));
    if (canManage) {
      db.getMemberCommissions()
        .then((rows) => setCommissions(Object.fromEntries(rows.map((r) => [r.user_id, Number(r.commission_rate_pct)]))))
        .catch(() => setCommissions({}));
    }
  }, [canManage]);

  const startEditRate = (uid, current) => { setEditingRate(uid); setRateInput(current != null ? String(current) : ""); };
  const saveRate = async (uid) => {
    const pct = Math.min(100, Math.max(0, Number(rateInput) || 0));
    setRateBusy(true);
    try {
      await db.setMemberCommissionRate(uid, pct);
      setCommissions((prev) => ({ ...prev, [uid]: pct }));
      setEditingRate(null);
    } catch (e) { alert("Gagal simpan rate komisi: " + e.message); }
    finally { setRateBusy(false); }
  };

  if (!members || members.length <= 1) return null;

  // Sama persis kayak PerformanceInsight & daily-digest: won/lost ditentuin
  // dari stage TEMPAT LEAD ITU SEKARANG BERADA, bukan field outcome.
  const wonKeys = (stages || []).filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = (stages || []).filter((s) => s.type === "lost").map((s) => s.key);

  const openLeadById = (leadId) => {
    const lead = (leads || []).find((l) => l.id === leadId);
    if (lead) { onOpenLead?.(lead); setPreview(null); }
  };

  const rows = members
    .map((m) => {
      const mine = (leads || []).filter((l) => l.assigned_to === m.user_id && !l.deleted_at);
      const won = mine.filter((l) => wonKeys.includes(l.stage_key));
      const lost = mine.filter((l) => lostKeys.includes(l.stage_key));
      const closed = won.length + lost.length;
      const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;

      const myDeals = (dealTransactions || []).filter((t) => t.user_id === m.user_id);
      const revenue = myDeals.reduce((sum, t) => sum + (Number(t.deal_value) || 0), 0);
      const myCheckins = checkins.filter((c) => c.user_id === m.user_id);
      const commissionRate = commissions[m.user_id] ?? 0;
      const commissionAmount = revenue * (commissionRate / 100);

      return {
        key: m.user_id,
        uid: m.user_id,
        name: m.display_name || `Anggota ${m.user_id.slice(0, 8)}`,
        leadCount: mine.length,
        dealCount: myDeals.length,
        visitCount: myCheckins.length,
        winRate,
        revenue,
        commissionRate,
        commissionAmount,
        leadItems: mine.map((l) => ({ id: l.id, leadId: l.id, primary: l.name, secondary: l.category || l.city || "" })),
        dealItems: myDeals.map((t) => ({ id: t.id, leadId: t.lead_id, primary: t.lead_name || "Deal", secondary: [fmtRp(t.deal_value), t.deal_date].filter(Boolean).join(" · ") })),
        visitItems: myCheckins.map((c) => ({ id: c.id, leadId: c.lead_id, primary: c.lead_name || "Kunjungan", secondary: c.checked_in_at ? new Date(c.checked_in_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "" })),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = Math.max(0, ...rows.map((r) => r.revenue));
  const hasAnyRevenue = maxRevenue > 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Trophy size={17} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">Performa Tim</div>
          <div className="text-[10.5px] text-slate-400">Peringkat berdasarkan total revenue closing</div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((r, i) => {
          const style = RANK_STYLE[i] || DEFAULT_STYLE;
          return (
            <div key={r.key} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
              <div className="relative shrink-0">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white ${style.avatarBg}`}>
                  {i === 0 ? <Crown size={17} /> : initials(r.name.startsWith("Anggota ") ? null : r.name, r.uid)}
                </div>
                <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white ${style.badgeBg}`}>
                  {i + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{r.name}</div>
                  <div className={`shrink-0 text-[13px] font-bold ${r.revenue > 0 ? "text-slate-800" : "text-slate-300"}`}>{fmtRp(r.revenue)}</div>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
                  <button onClick={() => setPreview({ title: `Lead - ${r.name}`, items: r.leadItems })} className="underline decoration-dotted underline-offset-2 hover:text-slate-600">
                    {r.leadCount} lead
                  </button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setPreview({ title: `Deal - ${r.name}`, items: r.dealItems })} className="underline decoration-dotted underline-offset-2 hover:text-slate-600">
                    {r.dealCount} deal
                  </button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setPreview({ title: `Kunjungan - ${r.name}`, items: r.visitItems })} className="underline decoration-dotted underline-offset-2 hover:text-slate-600">
                    {r.visitCount} visit
                  </button>
                  {r.winRate !== null && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{r.winRate}% win rate</span>
                    </>
                  )}
                </div>
                {hasAnyRevenue && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                      style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sistem Komisi (18 Sep 2026, permintaan Nando) - cuma keliatan buat
          owner/manager (canManage). Rate % per anggota, komisi dihitung dari
          total revenue all-time (sama basis waktu kayak leaderboard di atas)
          dikali rate. Ini LAPORAN doang - status pembayaran komisinya tetep
          ditangani manual di luar Nexto (transfer bank dll), sesuai keputusan
          Nando biar gak over-engineer fitur yang belum tentu kepake detail.
          Rate 0% (default) berarti belum diatur - komisinya Rp0 sampe owner/
          manager set rate-nya. */}
      {canManage && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Percent size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Komisi Tim</div>
              <div className="text-[10.5px] text-slate-400">% dari total revenue closing (all-time) - atur rate tiap anggota</div>
            </div>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-slate-700">{r.name}</div>
                  <div className="text-[10.5px] text-slate-400">Revenue {fmtRp(r.revenue)}</div>
                </div>
                {editingRate === r.uid ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      autoFocus
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRate(r.uid)}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-[12.5px] focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-[12px] text-slate-400">%</span>
                    <button onClick={() => saveRate(r.uid)} disabled={rateBusy} className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">
                      {rateBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEditRate(r.uid, r.commissionRate)} className="flex shrink-0 items-center gap-3 text-right hover:opacity-70">
                    <div>
                      <div className="text-[13px] font-bold text-slate-800">{fmtRp(r.commissionAmount)}</div>
                      <div className="text-[10.5px] text-slate-400">{r.commissionRate}% rate</div>
                    </div>
                    <Pencil size={13} className="text-slate-300" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-emerald-800">Total komisi tim</span>
            <span className="text-[13px] font-bold text-emerald-800">{fmtRp(rows.reduce((sum, r) => sum + r.commissionAmount, 0))}</span>
          </div>
        </div>
      )}

      {preview && (
        <StatPreviewModal
          title={preview.title}
          items={preview.items}
          onOpenItem={(it) => openLeadById(it.leadId)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
