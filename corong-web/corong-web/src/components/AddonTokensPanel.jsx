import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import { fmtShort, isoDay, addDays, field, lbl } from "./EnterpriseInvoicePanel";

// Token add-on Generate Leads (8 Okt 2026, permintaan Nando) - khusus admin platform, di Command
// Center (kartu TOKEN ADD-ON). Admin memberi token ke satu pengguna (1 token = 1 pencarian
// tambahan) setelah mereka membeli paket token. Token dipakai SETELAH kuota bulanan pengguna
// habis, bisa diberi tanggal kedaluwarsa, dan dikembalikan kalau pencarian gagal. Pengguna
// hanya melihat saldo tokennya; hitungan kuota bulanan tetap tidak ditampilkan ke mereka.

const PLAN_LABEL = { enterprise: "Enterprise", professional: "Professional", standard: "Standard" };
const PRESETS = [5, 10, 20, 50];
const EXPIRY_PRESETS = [[30, "30 hari"], [90, "90 hari"], [365, "1 tahun"]];

function lotStatus(l, now) {
  if (l.tokens_left === 0 && /dicabut/.test(l.note || "")) return { label: "Dicabut", cls: "text-slate-400" };
  if (l.tokens_left === 0) return { label: "Habis", cls: "text-slate-400" };
  if (l.expires_at && new Date(l.expires_at).getTime() <= now) return { label: "Kedaluwarsa", cls: "text-rose-300" };
  return { label: "Aktif", cls: "text-emerald-300" };
}

export default function AddonTokensPanel() {
  const today = isoDay(new Date());
  const [lots, setLots] = useState(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [tokens, setTokens] = useState(10);
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [lookup, setLookup] = useState(null); // null | { status: "checking" | ... }
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const [requests, setRequests] = useState([]); // permintaan token dari pengguna yang menunggu
  const [fromRequest, setFromRequest] = useState(null); // id permintaan yang sedang diproses lewat form

  const load = () => {
    setErr("");
    db.adminAddonTokens("list").then((r) => setLots(r.lots || [])).catch((e) => { setLots([]); setErr(e.message); });
    db.adminAddonTokens("requests").then((r) => setRequests(r.requests || [])).catch(() => setRequests([]));
  };
  useEffect(load, []);

  // Proses sebuah permintaan: isi form dengan email dan jumlahnya, admin tinggal memeriksa lalu "Beri token".
  const processRequest = (rq) => {
    setEmail(rq.email || ""); setTokens(rq.tokens); setNote(`Permintaan pengguna${rq.note ? `: ${rq.note}` : ""}`);
    setFromRequest(rq.id);
    document.getElementById("tok-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const dismissRequest = async (rq) => {
    if (!window.confirm(`Abaikan permintaan ${rq.tokens} token dari ${rq.email || "pengguna ini"}?`)) return;
    try { await db.adminAddonTokens("dismiss_request", { request_id: rq.id }); setRequests((cur) => cur.filter((x) => x.id !== rq.id)); }
    catch (e) { alert("Gagal mengabaikan: " + e.message); }
  };

  // Cek akun penerima saat email diketik (paket dan organisasi; peringatan kalau bukan Professional ke atas).
  useEffect(() => {
    const e = email.trim();
    if (!e) { setLookup(null); return undefined; }
    setLookup({ status: "checking" });
    const t = setTimeout(() => {
      db.adminAddonTokens("lookup", { email: e })
        .then((r) => setLookup(r.invalid ? { status: "invalid" } : r.found ? { status: "found", ...r } : { status: "notfound" }))
        .catch(() => setLookup(null));
    }, 600);
    return () => clearTimeout(t);
  }, [email]);

  const now = Date.now();
  const shown = useMemo(() => {
    const s = filter.trim().toLowerCase();
    return (lots || []).filter((l) => !s || `${l.email || ""} ${l.note || ""}`.toLowerCase().includes(s));
  }, [lots, filter]);
  const activeTotal = (lots || []).filter((l) => l.tokens_left > 0 && !(l.expires_at && new Date(l.expires_at).getTime() <= now)).reduce((n, l) => n + l.tokens_left, 0);

  const grant = async () => {
    const n = Math.floor(Number(tokens));
    if (!email.trim()) { alert("Isi email penerima terlebih dahulu."); return; }
    if (!(n >= 1)) { alert("Jumlah token minimal 1."); return; }
    const warn = lookup?.status === "found" && !lookup.can_generate
      ? `\n\nPerhatian: akun ini paket ${PLAN_LABEL[lookup.plan] || "Gratis"}. Generate Leads hanya untuk Professional ke atas, jadi token baru bisa dipakai setelah mereka upgrade.`
      : lookup?.status === "notfound" ? "\n\nPerhatian: belum ada akun Nexto dengan email ini." : "";
    if (!window.confirm(`Beri ${n} token pencarian Generate Leads ke ${email.trim()}${expiry ? `, berlaku sampai ${fmtShort(expiry)}` : ", tanpa batas waktu"}?${warn}`)) return;
    setBusy(true);
    try {
      const r = await db.adminAddonTokens("grant", { email: email.trim(), tokens: n, expires_at: expiry || undefined, note: note.trim(), request_id: fromRequest || undefined });
      setLots((cur) => [r.lot, ...(cur || [])]);
      if (fromRequest) { setRequests((cur) => cur.filter((x) => x.id !== fromRequest)); setFromRequest(null); }
      setNote("");
    } catch (e) {
      alert("Gagal memberi token: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (l) => {
    if (!window.confirm(`Cabut sisa ${l.tokens_left} token dari ${l.email || "pengguna ini"}? Token yang sudah terpakai tidak dikembalikan.`)) return;
    try {
      const r = await db.adminAddonTokens("revoke", { lot_id: l.id });
      setLots((cur) => (cur || []).map((x) => (x.id === l.id ? { ...x, tokens_left: r.lot.tokens_left, note: r.lot.note } : x)));
    } catch (e) {
      alert("Gagal mencabut token: " + e.message);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-slate-400">
        Beri token pencarian tambahan untuk Generate Leads ke satu pengguna setelah mereka membeli paket token. <b className="text-slate-300">1 token = 1 pencarian.</b> Token dipakai setelah kuota bulanan pengguna habis, dikembalikan kalau pencarian gagal, dan tidak melewati batas paket (Generate Leads tetap untuk Professional ke atas).
      </p>

      {requests.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5">
          <div className="border-b border-amber-500/30 px-4 py-2.5 text-[13px] font-semibold text-amber-200">Permintaan masuk ({requests.length})</div>
          <ul className="divide-y divide-slate-800">
            {requests.map((rq) => (
              <li key={rq.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]">
                <span className="min-w-0">
                  <span className="block truncate text-slate-100"><b>{rq.tokens} token</b> dari {rq.email || "pengguna"}{rq.org_name ? <span className="text-slate-400">, {rq.org_name}</span> : null}</span>
                  <span className="block truncate text-[11px] text-slate-500">{fmtShort(rq.created_at.slice(0, 10))}, paket {PLAN_LABEL[rq.plan] || "Gratis"}{rq.can_generate ? "" : " (belum bisa memakai Generate Leads)"}{rq.note ? `, "${rq.note}"` : ""}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => processRequest(rq)} className="rounded-md bg-violet-500 px-2.5 py-1 font-semibold text-white hover:bg-violet-400">Proses</button>
                  <button type="button" onClick={() => dismissRequest(rq)} className="rounded-md border border-slate-600 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800">Abaikan</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-slate-700 p-4">
          <div className="text-[13px] font-semibold text-slate-100">Beri token</div>
          <div>
            <label className={lbl} htmlFor="tok-email">Email penerima</label>
            <input id="tok-email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pengguna@perusahaan.com" autoComplete="off" />
            {lookup && (
              <p className={`mt-1 text-[11.5px] ${lookup.status === "found" ? (lookup.can_generate ? "text-emerald-300" : "text-amber-300") : lookup.status === "checking" ? "text-slate-500" : "text-amber-300"}`}>
                {lookup.status === "checking" ? "Memeriksa akun…"
                  : lookup.status === "invalid" ? "Format email belum valid."
                  : lookup.status === "notfound" ? "Belum ada akun Nexto dengan email ini."
                  : lookup.can_generate ? `Akun ditemukan: ${lookup.org_name || "tanpa organisasi"}, paket ${PLAN_LABEL[lookup.plan]}.`
                  : `Akun ditemukan, paket ${PLAN_LABEL[lookup.plan] || "Gratis"}. Generate Leads hanya untuk Professional ke atas.`}
              </p>
            )}
          </div>
          <div>
            <label className={lbl} htmlFor="tok-n">Jumlah token (pencarian)</label>
            <input id="tok-n" type="number" min="1" max="1000" className={field} value={tokens} onChange={(e) => setTokens(e.target.value)} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESETS.map((n) => (
                <button key={n} type="button" onClick={() => setTokens(n)} className={`rounded-md border px-2 py-0.5 text-[12px] font-semibold ${Number(tokens) === n ? "border-violet-400 bg-violet-500/20 text-violet-100" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl} htmlFor="tok-exp">Berlaku sampai (opsional)</label>
            <input id="tok-exp" type="date" min={addDays(today, 1)} className={field} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {EXPIRY_PRESETS.map(([d, l]) => (
                <button key={d} type="button" onClick={() => setExpiry(addDays(today, d))} className="rounded-md border border-slate-600 px-2 py-0.5 text-[12px] font-semibold text-slate-300 hover:bg-slate-800">{l}</button>
              ))}
              {expiry && <button type="button" onClick={() => setExpiry("")} className="text-[12px] text-slate-400 hover:text-slate-200">Tanpa batas</button>}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Kosong = tidak kedaluwarsa. Token yang paling cepat kedaluwarsa dipakai lebih dulu.</p>
          </div>
          <div>
            <label className={lbl} htmlFor="tok-note">Catatan (opsional)</label>
            <input id="tok-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: Paket 10 pencarian, INV/NXT/2026/10/0003" />
          </div>
          <button type="button" onClick={grant} disabled={busy} className="w-full rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{busy ? "Menyimpan…" : "Beri token"}</button>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
            <div className="text-[13px] font-semibold text-slate-100">Riwayat pemberian</div>
            <div className="text-[12px] text-slate-400">Token aktif seluruhnya: <span className="font-mono font-semibold text-violet-300">{activeTotal}</span></div>
          </div>
          <div className="border-b border-slate-800 px-4 py-2">
            <input className={field} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari email atau catatan" aria-label="Cari" />
          </div>
          {lots === null ? (
            <p className="px-4 py-4 text-[12px] text-slate-500">Memuat…</p>
          ) : err ? (
            <p className="px-4 py-4 text-[12px] text-rose-300">Gagal memuat: {err}</p>
          ) : shown.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-slate-500">{lots.length ? "Tidak ada yang cocok." : "Belum ada token yang diberikan."}</p>
          ) : (
            <div className="max-h-[420px] overflow-auto overscroll-contain">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead className="sticky top-0 bg-[#0b0f17] text-left text-[11px] text-slate-400">
                  <tr><th className="px-4 py-2 font-semibold">Penerima</th><th className="px-2 py-2 text-right font-semibold">Sisa / total</th><th className="px-2 py-2 font-semibold">Berlaku sampai</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-4 py-2 text-right font-semibold">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {shown.map((l) => {
                    const st = lotStatus(l, now);
                    return (
                      <tr key={l.id}>
                        <td className="max-w-[240px] px-4 py-2">
                          <div className="truncate text-slate-200" title={l.email || ""}>{l.email || "-"}</div>
                          <div className="truncate text-[11px] text-slate-500" title={l.note || ""}>{fmtShort(l.created_at.slice(0, 10))}{l.note ? `, ${l.note}` : ""}</div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{l.tokens_left} / {l.tokens_total}</td>
                        <td className="px-2 py-2 text-slate-400">{l.expires_at ? fmtShort(isoDay(new Date(l.expires_at))) : "Tanpa batas"}</td>
                        <td className={`px-2 py-2 font-semibold ${st.cls}`}>{st.label}</td>
                        <td className="px-4 py-2 text-right">
                          {l.tokens_left > 0 && <button type="button" onClick={() => revoke(l)} className="font-semibold text-rose-300 hover:text-rose-200">Cabut</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
