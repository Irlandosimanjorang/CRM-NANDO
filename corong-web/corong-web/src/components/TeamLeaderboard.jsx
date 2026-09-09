import { useState, useEffect } from "react";
import { Trophy, Crown } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";

// Laporan performa tim (leaderboard) - gap yang ketauan pas audit 9 Sep
// 2026: paket Enterprise dijual dengan "role-based visibility" & tim
// sampai 4 orang, tapi Owner/Manager gak punya cara liat siapa yang paling
// closing bulan ini. Otomatis cuma nongol kalau org emang punya >1 anggota
// (org solo Standard/Professional gak akan pernah lolos cek ini, jadi gak
// perlu cek plan/role terpisah - member_limit org itu sendiri yang udah
// jadi gerbangnya). Dihitung dari `leads` yang UDAH di-load App.jsx -
// Owner/Manager RLS-nya emang udah nampilin SEMUA lead org (bukan cuma
// punya sendiri), jadi gak perlu query/RPC baru.
//
// Redesign 9 Sep 2026 - versi pertama polos banget (nomor bulat + progress
// bar) dan progress bar-nya keliatan rusak/kosong pas org baru belum ada
// deal_value sama sekali (semua Rp0, bar-nya jadi garis abu-abu doang).
// Sekarang: avatar inisial per anggota, medali beda warna top-3, dan
// progress bar CUMA ditampilin kalau emang ada revenue beneran (kalau
// nihil semua, disembunyiin daripada nampilin bar kosong yang aneh).
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

export default function TeamLeaderboard({ leads }) {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    db.getOrgMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  if (!members || members.length <= 1) return null;

  const rows = members
    .map((m) => {
      const mine = (leads || []).filter((l) => l.assigned_to === m.user_id && !l.deleted_at);
      const won = mine.filter((l) => l.outcome?.result === "won");
      const lost = mine.filter((l) => l.outcome?.result === "lost");
      const closed = won.length + lost.length;
      const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;
      const revenue = won.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
      return {
        key: m.user_id,
        uid: m.user_id,
        name: m.display_name || `Anggota ${m.user_id.slice(0, 8)}`,
        leadCount: mine.length,
        winRate,
        revenue,
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
          <div className="text-[10.5px] text-slate-400">Peringkat berdasarkan revenue closing bulan berjalan</div>
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
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>{r.leadCount} lead</span>
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
    </div>
  );
}
