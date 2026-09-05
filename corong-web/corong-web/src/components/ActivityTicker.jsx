import { FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { fmtRp, todayISO } from "../lib/helpers";

// ============================================================
// LIVE ACTIVITY TICKER (5 Sep 2026) - strip di paling atas Dashboard,
// nampilin aktivitas CRM TERBARU yang BENERAN kejadian (progress notes,
// lead baru, deal closed) - ditarik dari data yang UDAH DIMUAT Dashboard
// (leads + dealTransactions, gak ada query tambahan). Prinsipnya sama kayak
// aturan AI di seluruh codebase ini: JANGAN KARANG DATA - kalau org-nya
// masih sepi aktivitas, tampilin fallback yang jujur, bukan angka palsu.
// ============================================================

const ICON_BY_TYPE = { note: FileText, new: Sparkles, deal: CheckCircle2 };
const COLOR_BY_TYPE = { note: "text-sky-400", new: "text-orange-400", deal: "text-emerald-400" };

export function buildActivityFeed(leads, stages, dealTransactions) {
  const items = [];

  for (const lead of leads || []) {
    for (const note of lead.progress_notes || []) {
      if (!note.note_date) continue;
      const snippet = (note.text || "").trim();
      items.push({
        id: `note-${note.id}`,
        date: note.note_date,
        type: "note",
        text: `${lead.name} — ${snippet.slice(0, 55)}${snippet.length > 55 ? "…" : ""}`,
      });
    }
    if (lead.created_at) {
      items.push({
        id: `new-${lead.id}`,
        date: lead.created_at.slice(0, 10),
        type: "new",
        text: `Lead baru masuk: ${lead.name}`,
      });
    }
  }

  for (const tx of dealTransactions || []) {
    if (!tx.deal_date) continue;
    const leadName = (leads || []).find((l) => l.id === tx.lead_id)?.name || "Lead";
    items.push({
      id: `deal-${tx.id}`,
      date: tx.deal_date,
      type: "deal",
      text: `Deal closed: ${leadName}${tx.deal_value ? ` — ${fmtRp(tx.deal_value)}` : ""}`,
    });
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items.slice(0, 14);
}

function relativeDay(dateStr) {
  const days = Math.floor((new Date(todayISO()) - new Date(dateStr)) / 86400000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  return dateStr;
}

export default function ActivityTicker({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          Belum ada aktivitas tercatat — tambah progress note atau lead baru biar muncul di sini.
        </div>
      </div>
    );
  }

  // Digandain 2x biar loop scroll-nya keliatan sambung terus (seamless),
  // bukan lompat pas balik ke awal.
  const loopItems = [...items, ...items];
  const durationSec = Math.max(items.length * 3.5, 18);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-[0_10px_40px_-22px_rgba(249,115,22,0.5)]">
      {/* grid latar futuristik - gaya sama kayak section AI Engine di landing page */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(249,115,22,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,.35) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to right, black, transparent 92%)",
          WebkitMaskImage: "linear-gradient(to right, black, transparent 92%)",
        }}
      />
      {/* fade kiri-kanan biar tepi ticker gak keliatan kepotong kasar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-950 to-transparent" />

      <div className="relative flex items-center gap-3 px-3.5 py-2.5">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-400">Live</span>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max items-center gap-7 whitespace-nowrap"
            style={{ animation: `nexto-ticker-scroll ${durationSec}s linear infinite` }}
          >
            {loopItems.map((item, i) => {
              const Icon = ICON_BY_TYPE[item.type] || FileText;
              return (
                <div key={`${item.id}-${i}`} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <Icon size={12} className={COLOR_BY_TYPE[item.type] || "text-slate-400"} />
                  <span className="font-mono text-[10px] text-slate-500">{relativeDay(item.date)}</span>
                  <span className="truncate">{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nexto-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
