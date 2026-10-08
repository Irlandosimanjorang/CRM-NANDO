import { useCallback, useEffect, useState } from "react";
import { Copy, Check, RefreshCw, KeyRound, ChevronDown, ChevronRight } from "lucide-react";
import * as db from "../lib/db";

// Pengaturan owner: alamat webhook untuk chat masuk dari Cekat.ai (saklar lead_webhook, diatur admin).
// Kontak baru dari WhatsApp, Instagram, Messenger, atau TikTok DM otomatis menjadi lead dan percakapannya
// tersimpan di lead. Kartu ini menampilkan alamat webhook, cara memasangnya di Cekat, dan catatan data yang masuk.
const WEBHOOK_BASE = "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/chat-webhook";
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");

export default function ChatInboundCard() {
  const [channel, setChannel] = useState(null);
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const ch = await db.ensureChatChannel(false);
      setChannel(ch);
      setLogs(await db.getChatWebhookLog());
    } catch (e) { setErr(String(e?.message || e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const url = channel ? `${WEBHOOK_BASE}?k=${channel.secret}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) { /* salin manual */ }
  };
  const rotate = async () => {
    if (!window.confirm("Buat kunci baru? Alamat webhook yang lama langsung berhenti bekerja, dan alamat baru harus dipasang ulang di Cekat.")) return;
    setBusy(true);
    try { setChannel(await db.ensureChatChannel(true)); } catch (e) { setErr(String(e?.message || e)); }
    setBusy(false);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-panel p-4">
      <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><KeyRound size={15} className="text-emerald-600" /> Chat masuk dari iklan (Cekat.ai)</h3>
      <p className="text-xs text-slate-500 mb-3">Chat dari WhatsApp, Instagram, Messenger, dan TikTok yang dikumpulkan Cekat.ai otomatis menjadi lead di Nexto, lengkap dengan percakapannya dan kampanye iklan bila ada. Lead dibagi bergiliran ke tim marketing.</p>

      {err && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

      {channel && (
        <>
          <label className="text-[11px] font-semibold text-slate-500">Alamat webhook (rahasia, jangan dibagikan)</label>
          <div className="mt-1 flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700" aria-label="Alamat webhook" />
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Tersalin" : "Salin"}</button>
          </div>

          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>Di Cekat.ai buka <b>Setting</b>, lalu <b>Developer and API Setting</b>, lalu tab <b>Webhooks</b>.</li>
            <li>Isi <b>Custom Webhook URL</b> dengan alamat di atas.</li>
            <li>Centang peristiwa <b>Conversation Created</b>, <b>Message Received</b>, dan <b>Message Sent</b>. Pilih inbox yang menerima chat dari iklan Anda.</li>
            <li>Kirim satu chat percobaan. Dalam beberapa detik catatan di bawah akan bertambah dan lead baru muncul di tab Leads.</li>
          </ol>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] text-slate-500">Data terakhir masuk: <b className="text-slate-700">{fmtTime(channel.last_event_at)}</b></div>
            <div className="flex gap-1.5">
              <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"><RefreshCw size={12} /> Muat ulang</button>
              <button type="button" disabled={busy} onClick={rotate} className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-60">Buat kunci baru</button>
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
            {logs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Belum ada data masuk. Kirim chat percobaan lewat Cekat.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <li key={l.id} className="text-xs">
                    <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${l.ok ? "bg-emerald-500" : "bg-rose-500"}`} aria-label={l.ok ? "Berhasil" : "Gagal"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-slate-700">{l.note || l.event}</span>
                        <span className="block text-[11px] text-slate-400">{fmtTime(l.received_at)}{l.event ? ` · ${l.event}` : ""}</span>
                      </span>
                      {open === l.id ? <ChevronDown size={14} className="mt-0.5 text-slate-400" /> : <ChevronRight size={14} className="mt-0.5 text-slate-400" />}
                    </button>
                    {open === l.id && <pre className="max-h-56 overflow-auto bg-slate-50 px-3 py-2 text-[10.5px] leading-4 text-slate-600">{JSON.stringify(l.payload, null, 2)}</pre>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Isi data yang dikirim Cekat tampil di catatan ini. Kalau ada yang gagal terbaca (misalnya nomor atau nama kosong), kirim isinya ke tim Nexto supaya pembacaannya disesuaikan.</p>
        </>
      )}
    </div>
  );
}
