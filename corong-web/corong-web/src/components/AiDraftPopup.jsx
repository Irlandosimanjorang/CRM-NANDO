import { useState } from "react";
import { X, Sparkles, MessageCircle, Mail, Copy, Loader2, Send } from "lucide-react";
import * as db from "../lib/db";
import { waLink } from "../lib/helpers";

// Popup ringan buat generate & langsung kirim draft follow-up (WA/Email) TANPA
// perlu buka LeadModal penuh - dipicu dari tombol di kolom tabel Leads.
// AI cuma jalan pas user klik salah satu tombol channel di dalam sini (on-demand).
export default function AiDraftPopup({ lead, rect, onClose, onSent }) {
  const [channel, setChannel] = useState(null); // "whatsapp" | "email" | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waText, setWaText] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const runDraft = async (ch) => {
    setBusy(true); setError(""); setChannel(ch); setEmailMsg("");
    try {
      const res = await db.draftFollowup(lead.id, ch);
      if (ch === "whatsapp") setWaText(res.message || "");
      else { setEmailSubject(res.subject || ""); setEmailBody(res.body || ""); }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyWa = async () => {
    try { await navigator.clipboard.writeText(waText); setWaCopied(true); setTimeout(() => setWaCopied(false), 1800); } catch (_) {}
  };
  const openWa = () => {
    const base = waLink(lead.phone);
    if (!base) return;
    window.open(`${base}?text=${encodeURIComponent(waText)}`, "_blank");
  };

  const sendEmail = async () => {
    if (!lead.email) return;
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setEmailBusy(true); setEmailMsg("");
    try {
      await db.sendLeadEmail({ lead_id: lead.id, to_email: lead.email, to_name: lead.name, subject: emailSubject, body: emailBody });
      setEmailMsg("✅ Terkirim & kecatet di progress.");
      onSent && onSent();
    } catch (e) {
      setEmailMsg("Gagal: " + e.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const POPUP_W = 336;
  const left = Math.min(Math.max(rect.left - 40, 12), window.innerWidth - POPUP_W - 12);
  const top = Math.min(Math.max(rect.bottom + 8, 12), window.innerHeight - 420);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        style={{ left, top, width: POPUP_W, maxHeight: "min(480px, calc(100vh - 24px))" }}
      >
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-orange-50 to-white border-b border-slate-100 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1"><Sparkles size={11} /> Draft Follow-up (AI)</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5 truncate">{lead.name}</div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 400 }}>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => runDraft("whatsapp")} disabled={busy} className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
              {busy && channel === "whatsapp" ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} WhatsApp
            </button>
            <button onClick={() => runDraft("email")} disabled={busy} className="text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
              {busy && channel === "email" ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Email
            </button>
          </div>

          {error && <p className="text-[11px] text-rose-600 mt-2.5">Gagal: {error}</p>}

          {channel === "whatsapp" && waText && (
            <div className="mt-3 space-y-2">
              <textarea className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white min-h-[110px]" value={waText} onChange={(e) => setWaText(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyWa} className="text-xs border border-slate-300 rounded-lg py-2 hover:bg-slate-50 flex items-center justify-center gap-1.5"><Copy size={12} /> {waCopied ? "Tersalin!" : "Salin"}</button>
                <button onClick={openWa} disabled={!waLink(lead.phone)} className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg py-2 flex items-center justify-center gap-1.5"><MessageCircle size={12} /> Buka di WA</button>
              </div>
              {!waLink(lead.phone) && <p className="text-[10px] text-amber-700">Nomor telepon belum diisi/gak valid.</p>}
            </div>
          )}

          {channel === "email" && emailSubject && (
            <div className="mt-3 space-y-2">
              {!lead.email ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">Lead ini belum punya alamat email.</p>
              ) : (
                <>
                  <p className="text-[10px] text-slate-400">Kirim ke: <b>{lead.email}</b></p>
                  <input className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                  <textarea className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white min-h-[110px]" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                  <button onClick={sendEmail} disabled={emailBusy} className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
                    {emailBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {emailBusy ? "Mengirim…" : "Kirim Email"}
                  </button>
                  {emailMsg && <p className={`text-[11px] ${emailMsg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{emailMsg}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
