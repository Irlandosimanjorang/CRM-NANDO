import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import * as db from "../lib/db";

// Percakapan chat (dari webhook Cekat.ai) di detail lead. Tidak tampil bila lead tidak punya percakapan.
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "");

export default function LeadConversation({ leadId }) {
  const [data, setData] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!leadId) return undefined;
    db.getLeadConversation(leadId).then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [leadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [data]);

  if (!data || !data.conv) return null;
  const { conv, messages } = data;
  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><MessageCircle size={13} /> Percakapan {conv.platform ? `· ${conv.platform}` : ""}</div>
        <div className="text-[10px] text-slate-500">{messages.length} pesan{conv.last_inbound_at ? ` · terakhir masuk ${fmt(conv.last_inbound_at)}` : ""}</div>
      </div>
      {conv.campaign && <div className="mt-1 text-[11px] text-slate-600">Kampanye iklan: <b className="text-slate-800">{conv.campaign}</b></div>}
      <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-xl bg-white/70 p-2">
        {messages.length === 0 && <div className="py-4 text-center text-[11px] text-slate-400">Belum ada pesan tersimpan.</div>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-[12px] leading-5 ${m.direction === "out" ? "rounded-br-md bg-slate-800 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
              {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
              {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className={`block text-[11px] underline ${m.direction === "out" ? "text-sky-200" : "text-sky-700"}`}>Lampiran</a>}
              <div className={`mt-0.5 text-[9.5px] ${m.direction === "out" ? "text-slate-300" : "text-slate-400"}`}>{m.direction === "out" ? "Dibalas" : (m.sender_name || "Pelanggan")} · {fmt(m.sent_at)}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
