import { useState, useEffect } from "react";
import { X, Sparkles, MessageCircle, Mail, Copy, Loader2, Send } from "lucide-react";
import * as db from "../lib/db";
import { waLink } from "../lib/helpers";

// === BUG FIX (5 Sep 2026) ===
// Sebelumnya draft (waText/emailSubject/emailBody) CUMA disimpen di state React
// biasa - begitu browser/tab di-background terus di-"buang" dari memori sama
// OS/browser (lumrah kejadian, apalagi di HP/PWA), pas dibuka lagi itu BUKAN
// cuma komponen di-unmount, tapi SELURUH halaman reload dari nol. State apapun
// yang cuma di React langsung ilang permanen, gak peduli komponennya "selalu
// ke-mount" atau enggak - karena JS-nya sendiri restart total.
// Sekarang draft disimpen ke localStorage tiap kali berhasil di-generate/diedit,
// dan dibaca balik pas popup dibuka - kalau ketemu draft yang masih fresh
// (< 24 jam) buat lead yang sama, itu ditampilin LANGSUNG tanpa generate ulang
// (sekalian hemat biaya AI, gak dobel-generate draft yang sama).

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // buang draft yang lebih dari 24 jam, biar gak numpuk draft basi selamanya
const draftKey = (leadId) => `nexto-ai-draft-${leadId}`;

function loadSavedDraft(leadId) {
  try {
    const raw = localStorage.getItem(draftKey(leadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(draftKey(leadId));
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}
function saveDraft(leadId, data) {
  try { localStorage.setItem(draftKey(leadId), JSON.stringify({ ...data, savedAt: Date.now() })); } catch (_) {}
}
function clearDraft(leadId) {
  try { localStorage.removeItem(draftKey(leadId)); } catch (_) {}
}

// Popup ringan buat generate & langsung kirim draft follow-up (WA/Email) TANPA
// perlu buka LeadModal penuh - dipicu dari tombol di kolom tabel Leads/kartu,
// atau dari tombol "Handle Now" di kartu rekomendasi Dashboard (initialChannel
// diisi biar langsung auto-generate begitu dibuka, gak perlu klik 2x).
// AI cuma jalan pas user klik/buka salah satu channel di dalam sini (on-demand),
// KECUALI kalau ada draft tersimpan yang masih fresh buat lead ini (lihat fix di atas).
export default function AiDraftPopup({ lead, rect, onClose, onSent, initialChannel }) {
  const [channel, setChannel] = useState(null); // "whatsapp" | "email" | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waText, setWaText] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [restoredNotice, setRestoredNotice] = useState(false);

  const runDraft = async (ch) => {
    // Cek dulu SEBELUM manggil AI - kalau lead gak punya email tapi user
    // pencet "Email", jangan buang-buang panggilan AI buat draft yang gak
    // akan bisa dikirim ke mana-mana.
    if (ch === "email" && !lead.email) {
      setChannel("email"); setError("Lead ini belum punya alamat email tercatat.");
      return;
    }
    setBusy(true); setError(""); setChannel(ch); setEmailMsg(""); setRestoredNotice(false);
    try {
      const res = await db.draftFollowup(lead.id, ch);
      if (ch === "whatsapp") {
        setWaText(res.message || "");
        saveDraft(lead.id, { channel: ch, waText: res.message || "" });
      } else {
        setEmailSubject(res.subject || ""); setEmailBody(res.body || "");
        saveDraft(lead.id, { channel: ch, emailSubject: res.subject || "", emailBody: res.body || "" });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Begitu popup dibuka: cek dulu ada draft tersimpan yang masih fresh buat
  // lead ini gak (dari localStorage - ini yang bikin draft-nya SELAMAT walau
  // halaman reload total, bukan cuma pindah menu doang). Kalau ada, restore
  // langsung tanpa manggil AI lagi. Kalau gak ada DAN dibuka dari "Handle Now"
  // (bawa initialChannel), baru auto-generate dari nol.
  useEffect(() => {
    const saved = loadSavedDraft(lead.id);
    if (saved) {
      setChannel(saved.channel);
      if (saved.channel === "whatsapp") setWaText(saved.waText || "");
      else { setEmailSubject(saved.emailSubject || ""); setEmailBody(saved.emailBody || ""); }
      setRestoredNotice(true);
    } else if (initialChannel) {
      runDraft(initialChannel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpen tiap kali draft-nya diedit manual sama user (bukan cuma pas awal
  // di-generate) - biar edit-an gak ikut ilang kalau ke-reload sebelum sempet kirim.
  useEffect(() => {
    if (!channel) return;
    if (channel === "whatsapp" && waText) saveDraft(lead.id, { channel, waText });
  }, [waText]);
  useEffect(() => {
    if (!channel) return;
    if (channel === "email" && (emailSubject || emailBody)) saveDraft(lead.id, { channel, emailSubject, emailBody });
  }, [emailSubject, emailBody]);

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
      clearDraft(lead.id); // udah kekirim, draft-nya gak perlu disimpen lagi
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
          {restoredNotice && (
            <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mb-2.5">
              Draft sebelumnya dipulihkan (gak generate ulang).
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => runDraft("whatsapp")} disabled={busy} className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
              {busy && channel === "whatsapp" ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} WhatsApp
            </button>
            <button onClick={() => runDraft("email")} disabled={busy} className="text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
              {busy && channel === "email" ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Email
            </button>
          </div>
          <p className="text-[9px] text-slate-400 mt-1.5">Klik lagi kapan aja buat generate versi baru (nimpa draft yang tersimpan).</p>

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
