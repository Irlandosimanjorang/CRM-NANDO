import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
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
        name: m.display_name || `Anggota ${m.user_id.slice(0, 8)}`,
        leadCount: mine.length,
        winRate,
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={16} className="text-amber-500" />
        <div className="text-sm font-bold text-slate-800">Performa Tim</div>
        <div className="text-[10px] text-slate-400">bulan berjalan</div>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[12px] font-semibold text-slate-700">{r.name}</div>
                <div className="shrink-0 text-[12px] font-bold text-slate-800">{fmtRp(r.revenue)}</div>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {r.leadCount} lead{r.winRate !== null ? ` · ${r.winRate}% win rate` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
