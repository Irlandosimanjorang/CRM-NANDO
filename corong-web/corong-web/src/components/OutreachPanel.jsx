import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import { field, lbl } from "./EnterpriseInvoicePanel";

// Email outreach (13 Okt 2026, permintaan Nando) - khusus admin platform, di Command Center (kartu EMAIL OUTREACH).
// Tempel daftar penerima, kirim email uji, lalu kirim ke semua dengan satu klik. Pengiriman lewat fungsi send-outreach
// (Resend): gambar Dashboard, Team, dan Report tampil langsung di badan email. Alamat yang sudah dikirimi dilewati.

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

// Satu baris = email, nama kontak, perusahaan (dipisah koma, titik koma, atau tab). Dua kolom dibaca sebagai email, perusahaan.
function parseList(text) {
  const rows = [];
  const invalid = [];
  const seen = new Set();
  let dup = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.split(/[,;\t]/).map((p) => p.trim());
    const emailIdx = parts.findIndex((p) => EMAIL_RE.test(p));
    if (emailIdx === -1) { if (!/^email/i.test(raw)) invalid.push(raw.slice(0, 60)); continue; }
    const email = parts[emailIdx].toLowerCase();
    const rest = parts.filter((_, i) => i !== emailIdx);
    const nama = rest.length >= 2 ? rest[0] : "";
    const perusahaan = rest.length >= 2 ? rest[1] : rest[0] || "";
    if (seen.has(email)) { dup += 1; continue; }
    seen.add(email);
    rows.push({ email, nama, perusahaan });
  }
  return { rows, invalid, dup };
}

export default function OutreachPanel() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);
  const [unsub, setUnsub] = useState("");
  const [q, setQ] = useState(null);
  const [pv, setPv] = useState(null);

  const load = () => db.adminOutreach("list").then(setInfo).catch((e) => setErr(e.message));
  const loadQ = () => db.adminOutreach("queue_list").then(setQ).catch((e) => setErr(e.message));
  useEffect(() => { load(); loadQ(); }, []);

  const parsed = useMemo(() => parseList(text), [text]);
  const room = info ? Math.max(0, info.daily_cap - info.sent_today) : 0;

  const run = async (kind, fn) => {
    setBusy(kind); setErr(""); setMsg("");
    try { await fn(); await load(); await loadQ(); } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const sendTest = () => run("test", async () => {
    const r = await db.adminOutreach("test", testTo.trim() ? { to: testTo.trim() } : {});
    setMsg(`Email uji terkirim ke ${r.to}. Periksa kotak masuknya (dan folder Spam).`);
  });

  const sendAll = () => run("send", async () => {
    const n = parsed.rows.length;
    if (n === 0) throw new Error("Tempel daftar penerima terlebih dahulu.");
    const ok = window.confirm(`Kirim email perkenalan ke ${n} alamat? Alamat yang sudah pernah dikirimi dilewati, dan maksimal ${info?.daily_cap || 40} email per hari. Pengiriman tidak bisa dibatalkan.`);
    if (!ok) return;
    const r = await db.adminOutreach("send", { recipients: parsed.rows });
    setResult(r);
    setMsg(`${r.sent} email terkirim.`);
  });

  const showPreview = () => run("preview", async () => { setPv(await db.adminOutreach("preview")); });
  const removeFromQueue = (email) => run("rm", async () => { await db.adminOutreach("queue_remove", { email }); });
  const sendQueue = () => run("sendq", async () => {
    const n = Math.min(q?.next?.length || 0, room);
    if (n === 0) throw new Error(room === 0 ? "Batas harian sudah tercapai. Lanjutkan besok." : "Antrean kosong.");
    const ok = window.confirm("Kirim email perkenalan ke " + n + " perusahaan di antrean? Pengiriman tidak bisa dibatalkan.");
    if (!ok) return;
    const r = await db.adminOutreach("send_queue");
    setResult(r);
    setMsg(r.sent + " email terkirim dari antrean.");
  });

  const markUnsub = () => run("unsub", async () => {
    await db.adminOutreach("unsubscribe", { email: unsub.trim() });
    setMsg(`${unsub.trim().toLowerCase()} ditandai berhenti dan tidak akan dikirimi lagi.`);
    setUnsub("");
  });

  return (
    <div className="space-y-4 text-slate-200">
      <p className="text-[12.5px] leading-relaxed text-slate-400">
        Kirim email perkenalan Nexto ke banyak perusahaan sekaligus. {info?.transport === "gmail" ? "Email keluar dari Gmail Anda sendiri dengan tiga gambar (Dashboard, Dashboard Tim, Report) sebagai lampiran, plus link demo." : "Email berisi gambar Dashboard, Dashboard Tim, dan Report di badan email, plus link demo."} Setiap penerima dikirimi satu kali, dan balasan masuk ke <b className="text-slate-300">{info?.reply_to || "Gmail Anda"}</b>.
      </p>

      {info && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-[12.5px]">
          <span>Hari ini <b className="text-slate-50">{info.sent_today}</b> dari {info.daily_cap}</span>
          <span>Total terkirim <b className="text-slate-50">{info.total_sent}</b></span>
          <span>Berhenti <b className="text-slate-50">{info.unsubscribed}</b></span>
          <span className="text-slate-400">Pengirim: {info.from} ({info.transport === "gmail" ? "Gmail, gambar sebagai lampiran" : "Resend, gambar di badan email"})</span>
        </div>
      )}

      <div className="rounded-xl border border-orange-500/40 bg-orange-500/5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-500/30 px-4 py-2.5">
          <span className="text-[13px] font-semibold text-orange-200">Antrean riset hari ini</span>
          {q && <span className="text-[12px] text-slate-300">Menunggu <b className="text-slate-50">{q.counts.queued}</b> (kecil {q.by_segmen.kecil}, menengah {q.by_segmen.menengah}, besar {q.by_segmen.besar}), terkirim {q.counts.sent}</span>}
        </div>
        {q && q.next.length === 0 && <p className="px-4 py-3 text-[12.5px] text-slate-400">Antrean kosong. Daftar perusahaan hasil riset akan muncul di sini.</p>}
        {q && q.next.length > 0 && (
          <ul className="max-h-64 divide-y divide-slate-800 overflow-y-auto">
            {q.next.map((r) => (
              <li key={r.email} className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]">
                <span className="min-w-0 truncate">
                  <b className="text-slate-100">{r.perusahaan}</b> <span className="text-slate-400">{r.segmen}{r.kota ? ", " + r.kota : ""}{r.industri ? ", " + r.industri : ""}</span>
                  <span className="block truncate text-slate-400">{r.email}{r.nama_kontak ? " (" + r.nama_kontak + ")" : ""}</span>
                </span>
                <button type="button" disabled={!!busy} onClick={() => removeFromQueue(r.email)} className="shrink-0 rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50">Keluarkan</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-orange-500/30 px-4 py-3">
          <button type="button" disabled={!!busy || !q || q.next.length === 0} onClick={showPreview} className="rounded-lg border border-slate-500 px-4 py-2 text-[13px] font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50">{busy === "preview" ? "Memuat..." : "Lihat email"}</button>
          <button type="button" disabled={!!busy || !q || q.next.length === 0 || room === 0} onClick={sendQueue} className="rounded-lg bg-orange-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-orange-400 disabled:opacity-50">{busy === "sendq" ? "Mengirim..." : "Kirim " + Math.min(q?.next?.length || 0, room) + " email dari antrean"}</button>
          {info && <span className="text-[12px] text-slate-400">Hari ini {info.sent_today} dari {info.daily_cap}</span>}
        </div>
      </div>

      {pv && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-[12px] text-slate-300">
            <span>Preview untuk {pv.to || "contoh"}. Dari <b className="text-slate-100">{pv.from}</b>. Subjek: <b className="text-slate-100">{pv.subject}</b>{pv.attachments.length > 0 ? ". Lampiran: " + pv.attachments.join(", ") : ""}</span>
            <button type="button" onClick={() => setPv(null)} className="rounded-md border border-slate-600 px-2 py-0.5 text-[11px] hover:bg-slate-800">Tutup</button>
          </div>
          <iframe title="Preview email" sandbox="" srcDoc={pv.html} className="h-[420px] w-full rounded-b-xl bg-white" />
        </div>
      )}

      <div>
        <label className={lbl}>Tempel manual (satu baris per perusahaan: email, nama kontak, perusahaan)</label>
        <textarea className={field + " min-h-[130px] font-mono text-[12px]"} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"budi@perusahaan.co.id, Budi Santoso, PT Maju Jaya\nhrd@contoh.com, , PT Contoh Abadi"} />
        <p className="mt-1 text-[11.5px] text-slate-400">
          {parsed.rows.length} alamat valid{parsed.dup > 0 ? `, ${parsed.dup} dobel dibuang` : ""}{parsed.invalid.length > 0 ? `, ${parsed.invalid.length} baris tidak terbaca` : ""}. Nama kontak boleh dikosongkan, sapaannya menjadi "Yth. Tim Sales (perusahaan)".
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className={lbl}>Kirim email uji ke (kosong = email Anda)</label>
          <input className={field} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="nandoban04@gmail.com" />
        </div>
        <button type="button" disabled={!!busy} onClick={sendTest} className="rounded-lg border border-slate-500 px-4 py-2 text-[13px] font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50">
          {busy === "test" ? "Mengirim..." : "Kirim email uji"}
        </button>
        <button type="button" disabled={!!busy || parsed.rows.length === 0} onClick={sendAll} className="rounded-lg bg-orange-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-orange-400 disabled:opacity-50">
          {busy === "send" ? "Mengirim..." : `Kirim ke ${parsed.rows.length} penerima`}
        </button>
      </div>
      {info && parsed.rows.length > room && <p className="text-[12px] text-amber-300">Sisa batas hari ini {room} email. Sisanya ({parsed.rows.length - room}) tidak terkirim hari ini; tempel ulang besok, alamat yang sudah terkirim otomatis dilewati.</p>}

      {info && info.transport !== "gmail" && <p className="text-[12px] text-slate-400">Untuk mengirim dari Gmail Anda sendiri: buat sandi aplikasi Google, lalu isi GMAIL_APP_PASSWORD di Secrets fungsi Supabase. Kartu ini otomatis beralih.</p>}

      {err && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{err}</p>}
      {msg && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-200">{msg}</p>}

      {result && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-[12.5px] space-y-1">
          <div><b className="text-emerald-300">{result.sent}</b> terkirim, <b className="text-slate-100">{result.skipped.length}</b> dilewati, <b className="text-rose-300">{result.failed.length}</b> gagal, <b className="text-amber-300">{result.deferred.length}</b> ditunda (batas harian)</div>
          {result.skipped.length > 0 && <div className="text-slate-400">Dilewati: {result.skipped.map((s) => `${s.email} (${s.alasan})`).join(", ")}</div>}
          {result.failed.length > 0 && <div className="text-rose-300">Gagal: {result.failed.map((f) => `${f.email} (${f.error})`).join(", ")}</div>}
          {result.invalid?.length > 0 && <div className="text-slate-400">Alamat tidak valid: {result.invalid.join(", ")}</div>}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className={lbl}>Tandai berhenti (penerima membalas "berhenti")</label>
          <input className={field} value={unsub} onChange={(e) => setUnsub(e.target.value)} placeholder="alamat@perusahaan.com" />
        </div>
        <button type="button" disabled={!!busy || !EMAIL_RE.test(unsub.trim())} onClick={markUnsub} className="rounded-lg border border-slate-500 px-4 py-2 text-[13px] font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50">Tandai berhenti</button>
      </div>

      {info?.recent?.length > 0 && (
        <div className="rounded-xl border border-slate-700">
          <div className="border-b border-slate-700 px-4 py-2 text-[12.5px] font-semibold text-slate-200">Pengiriman terakhir</div>
          <ul className="max-h-56 divide-y divide-slate-800 overflow-y-auto">
            {info.recent.map((r) => (
              <li key={r.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[12px]">
                <span className="min-w-0 truncate">{r.email}{r.perusahaan ? <span className="text-slate-400">, {r.perusahaan}</span> : null}</span>
                <span className={r.status === "sent" ? "text-emerald-300" : r.status === "failed" ? "text-rose-300" : "text-slate-400"}>
                  {r.status === "sent" ? "Terkirim" : r.status === "failed" ? "Gagal" : "Berhenti"} <span className="text-slate-500">{String(r.created_at).slice(0, 10)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
