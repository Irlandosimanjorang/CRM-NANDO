import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import { makeFormToken, hashFormToken, normalizeWa, warrantyUntil, publicCardUrl, serviceUrl, DEFAULT_WARRANTY_MONTHS } from "../lib/warrantyCard";

const inp = "mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
const todayIso = () => new Date().toISOString().slice(0, 10);

// Kartu garansi QR untuk satu proyek (3 Nov 2026). QR publik dicetak pada unit dan permanen.
// Link teknisi dibuat sekali; bisa diganti lewat "Buat ulang link teknisi".
export default function WarrantyCardDialog({ leadId, orgId, onClose }) {
  const [card, setCard] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrPublic, setQrPublic] = useState("");
  const [serviceLink, setServiceLink] = useState(""); // hanya ada setelah dibuat atau diganti di sesi ini
  const [qrService, setQrService] = useState("");
  const [copied, setCopied] = useState("");
  const [draft, setDraft] = useState({ product: "", installed_at: todayIso(), warranty_months: DEFAULT_WARRANTY_MONTHS, contact_wa: "" });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = async () => {
    const { data, error: err } = await supabase
      .from("warranty_cards")
      .select("id, public_token, product, installed_at, warranty_months, contact_wa, created_at")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (err) throw err;
    setCard(data || null);
    if (data) {
      setQrPublic(await QRCode.toDataURL(publicCardUrl(data.public_token), { width: 280, margin: 1 }));
      const { data: rows, error: logErr } = await supabase
        .from("warranty_service_logs")
        .select("id, service_date, problem, action_taken:action, technician_name, photo_paths")
        .eq("card_id", data.id)
        .order("service_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (logErr) throw logErr;
      setLogs(rows || []);
    }
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message || "Kartu garansi belum bisa dimuat."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const showServiceLink = async (token) => {
    setServiceLink(serviceUrl(token));
    setQrService(await QRCode.toDataURL(serviceUrl(token), { width: 220, margin: 1 }));
  };

  const createCard = async () => {
    setError("");
    const wa = normalizeWa(draft.contact_wa);
    if (!draft.product.trim()) return setError("Isi nama produk atau unit yang dipasang.");
    if (!draft.installed_at) return setError("Isi tanggal pemasangan.");
    if (!wa) return setError("Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890.");
    const months = Number(draft.warranty_months);
    if (!Number.isInteger(months) || months < 1 || months > 240) return setError("Masa garansi harus 1 sampai 240 bulan.");
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Sesi login tidak ditemukan. Muat ulang halaman.");
      const publicToken = makeFormToken();
      const serviceToken = makeFormToken();
      const { error: insErr } = await supabase.from("warranty_cards").insert({
        org_id: orgId, lead_id: leadId, public_token: publicToken,
        service_token_hash: await hashFormToken(serviceToken),
        product: draft.product.trim(), installed_at: draft.installed_at, warranty_months: months,
        contact_wa: wa, created_by: uid,
      });
      if (insErr) throw insErr;
      await load();
      await showServiceLink(serviceToken);
    } catch (e) {
      setError(e.message || "Kartu garansi belum bisa dibuat.");
    } finally {
      setBusy(false);
    }
  };

  const rotateServiceLink = async () => {
    if (!card) return;
    if (!window.confirm("Link teknisi lama tidak bisa dipakai lagi. Lanjutkan?")) return;
    setBusy(true);
    setError("");
    try {
      const serviceToken = makeFormToken();
      const { error: upErr } = await supabase.from("warranty_cards")
        .update({ service_token_hash: await hashFormToken(serviceToken) })
        .eq("id", card.id);
      if (upErr) throw upErr;
      await showServiceLink(serviceToken);
    } catch (e) {
      setError(e.message || "Link teknisi belum bisa diganti.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Link tidak bisa disalin otomatis. Salin dari kolom di atas.");
    }
  };

  const until = card ? warrantyUntil(card.installed_at, card.warranty_months) : "";
  const active = card && todayIso() <= until;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Kartu garansi QR</h3>
            <p className="mt-0.5 text-xs text-slate-500">QR ini dicetak pada unit. Scan menampilkan garansi, nomor WhatsApp, dan riwayat servis.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">Tutup</button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Memuat...</p>
        ) : !card ? (
          <div className="mt-4 space-y-3">
            <label className="block"><span className="text-xs font-medium text-slate-500">Nama produk / unit *</span>
              <input className={inp} value={draft.product} onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))} placeholder="Mis. Jendela UPVC 2 daun, lantai 2" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Tanggal pasang *</span>
                <input type="date" className={inp} value={draft.installed_at} onChange={(e) => setDraft((d) => ({ ...d, installed_at: e.target.value }))} />
              </label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Garansi (bulan) *</span>
                <input type="number" min={1} max={240} className={inp} value={draft.warranty_months} onChange={(e) => setDraft((d) => ({ ...d, warranty_months: e.target.value }))} />
              </label>
            </div>
            <label className="block"><span className="text-xs font-medium text-slate-500">Nomor WhatsApp layanan purna jual *</span>
              <input className={inp} inputMode="tel" value={draft.contact_wa} onChange={(e) => setDraft((d) => ({ ...d, contact_wa: e.target.value }))} placeholder="0812-3456-7890" />
            </label>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end pt-1">
              <button type="button" onClick={createCard} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Membuat..." : "Buat kartu garansi"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-500">Produk</div><div className="font-medium text-slate-800">{card.product}</div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-500">Garansi</div><div className={`font-semibold ${active ? "text-emerald-600" : "text-rose-600"}`}>{active ? "Aktif" : "Berakhir"} s.d. {until}</div></div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              {qrPublic && <img src={qrPublic} alt="QR kartu garansi" className="h-[220px] w-[220px] rounded-xl border border-slate-200 bg-white p-2" />}
              <a href={qrPublic} download="qr-kartu-garansi.png" className="text-xs font-medium text-orange-600 hover:underline">Unduh QR untuk dicetak (PNG)</a>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-700">Link teknisi</div>
              <p className="mt-0.5 text-[11px] text-slate-500">Teknisi membuka link ini untuk menambah riwayat servis. Link ini tidak ditampilkan lagi setelah dialog ditutup.</p>
              {serviceLink ? (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {qrService && <img src={qrService} alt="QR link teknisi" className="h-[160px] w-[160px] rounded-lg border border-slate-200 bg-white p-1.5" />}
                  <div className="flex w-full gap-2">
                    <input readOnly value={serviceLink} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600" />
                    <button type="button" onClick={() => copy(serviceLink, "service")} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">{copied === "service" ? "Tersalin" : "Salin"}</button>
                  </div>
                </div>
              ) : null}
              <button type="button" onClick={rotateServiceLink} disabled={busy} className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-orange-400 disabled:opacity-60">
                {serviceLink ? "Buat ulang link teknisi" : "Buat ulang link teknisi (link lama tidak berlaku)"}
              </button>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-700">Riwayat servis ({logs.length})</div>
              {logs.length === 0 && <p className="mt-2 text-xs text-slate-500">Belum ada servis tercatat.</p>}
              <ul className="mt-2 divide-y divide-slate-200">
                {logs.map((l) => (
                  <li key={l.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-800">{l.service_date}</span>
                      <span className="text-[11px] text-slate-500">{l.technician_name}</span>
                    </div>
                    <div className="text-slate-700"><span className="text-slate-500">Kerusakan:</span> {l.problem}</div>
                    <div className="text-slate-700"><span className="text-slate-500">Tindakan:</span> {l.action_taken}</div>
                    {l.photo_paths?.length > 0 && <div className="text-[11px] text-slate-500">{l.photo_paths.length} foto</div>}
                  </li>
                ))}
              </ul>
            </div>

            {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
