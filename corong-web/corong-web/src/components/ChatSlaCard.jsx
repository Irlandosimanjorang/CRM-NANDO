import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import * as db from "../lib/db";
import { PanelHeader } from "../ui";

// Chat masuk dari iklan yang belum dibalas (permintaan 9 Okt 2026). Percakapan dianggap menunggu bila pesan masuk terakhir
// lebih baru daripada balasan terakhir dan umurnya melewati batas yang dipilih. Tidak tampil bila organisasi belum punya percakapan.
const LIMITS = [[1, "1 jam"], [2, "2 jam"], [4, "4 jam"], [24, "1 hari"]];
const KEY = "nexto.chat_sla_hours";
const ago = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)} menit`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} jam` : `${Math.floor(h / 24)} hari`;
};

export default function ChatSlaCard({ leads = [], members = [], onOpenLead }) {
  const [rows, setRows] = useState(null);
  const [hours, setHours] = useState(() => { try { return Number(localStorage.getItem(KEY)) || 2; } catch { return 2; } });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    db.listChatWaiting().then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const waiting = useMemo(() => {
    const byId = new Map(leads.map((l) => [l.id, l]));
    return (rows || [])
      .filter((c) => c.last_inbound_at && (!c.last_outbound_at || new Date(c.last_inbound_at) > new Date(c.last_outbound_at)))
      .map((c) => ({ ...c, wait: now - new Date(c.last_inbound_at).getTime(), lead: byId.get(c.lead_id) }))
      .filter((c) => c.lead && !c.lead.deleted_at && c.wait >= hours * 3600000)
      .sort((a, b) => b.wait - a.wait);
  }, [rows, leads, hours, now]);

  if (rows === null || rows.length === 0) return null;
  const nameOf = (id) => members.find((m) => m.user_id === id)?.name || "Belum dibagi";
  const choose = (h) => { setHours(h); try { localStorage.setItem(KEY, String(h)); } catch { /* abaikan */ } };

  return (
    <section className="rounded-panel border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PanelHeader className="mb-0" title="Chat belum dibalas" meta={`Chat masuk dari iklan yang menunggu balasan lebih dari ${LIMITS.find(([h]) => h === hours)?.[1] || `${hours} jam`}`} />
        <div className="flex rounded-inner border border-slate-200 p-0.5 text-[12px]" role="group" aria-label="Batas waktu menunggu">
          {LIMITS.map(([h, label]) => (
            <button key={h} type="button" aria-pressed={hours === h} onClick={() => choose(h)} className={`rounded-[9px] px-3 py-1.5 font-semibold ${hours === h ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
      </div>
      {waiting.length === 0 ? (
        <p className="rounded-inner bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-800">Semua chat masuk sudah dibalas dalam batas waktu ini.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {waiting.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onOpenLead?.(c.lead)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50">
                <span className="flex min-w-0 items-center gap-2.5">
                  <MessageCircle size={15} className="shrink-0 text-rose-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{c.lead.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{[c.platform, c.campaign].filter(Boolean).join(" · ") || "Chat"} · dipegang {nameOf(c.lead.assigned_to || c.lead.user_id)}</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-rose-700">menunggu {ago(c.wait)}</span>
              </button>
            </li>
          ))}
          {waiting.length > 8 && <li className="pt-2 text-[11px] text-slate-500">+{waiting.length - 8} chat lagi</li>}
        </ul>
      )}
    </section>
  );
}
