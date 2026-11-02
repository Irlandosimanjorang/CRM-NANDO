import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import { FORM_FIELDS, makeFormToken, hashFormToken, formUrl } from "../lib/customerForm";

const BUCKET = "customer-documents";
const FORM_DAYS = 30;

// Pop-up QR form customer untuk satu proyek deal (2 Nov 2026). Dibuka dari Data proyek di Lead Modal.
// QR berisi link form kosong. Customer mengisi dan upload KTP lewat halaman publik /isi.
export default function CustomerFormQrDialog({ leadId, orgId, onClose }) {
  const [latest, setLatest] = useState(null); // baris customer_forms terakhir untuk proyek ini
  const [qrUrl, setQrUrl] = useState(""); // dataURL QR, hanya ada setelah buat baru di sesi ini
  const [link, setLink] = useState("");
  const [answers, setAnswers] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadLatest = async () => {
    const { data, error: err } = await supabase
      .from("customer_forms")
      .select("id, status, created_at, expires_at, submitted_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (err) throw err;
    setLatest(data || null);
    if (data?.status === "terisi") {
      const [{ data: ans }, { data: fl }] = await Promise.all([
        supabase.from("customer_form_answers").select("*").eq("form_id", data.id).maybeSingle(),
        supabase.from("customer_form_files").select("id, storage_path, mime, size_bytes").eq("form_id", data.id).eq("kind", "ktp"),
      ]);
      setAnswers(ans || null);
      setFiles(fl || []);
    } else {
      setAnswers(null);
      setFiles([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadLatest()
      .catch((e) => setError(e.message || "Data form belum bisa dimuat."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const createNew = async () => {
    setBusy(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Sesi login tidak ditemukan. Muat ulang halaman.");
      // QR lama dibatalkan supaya link yang sudah tersebar tidak bisa dipakai lagi.
      if (latest?.status === "menunggu") {
        const { error: cancelErr } = await supabase.from("customer_forms").update({ status: "dibatalkan" }).eq("id", latest.id);
        if (cancelErr) throw cancelErr;
      }
      const token = makeFormToken();
      const tokenHash = await hashFormToken(token);
      const expiresAt = new Date(Date.now() + FORM_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: insErr } = await supabase.from("customer_forms").insert({
        org_id: orgId, lead_id: leadId, token_hash: tokenHash, created_by: uid, expires_at: expiresAt,
      });
      if (insErr) throw insErr;
      const url = formUrl(token);
      setLink(url);
      setQrUrl(await QRCode.toDataURL(url, { width: 280, margin: 1 }));
      await loadLatest();
    } catch (e) {
      setError(e.message || "QR belum bisa dibuat. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Link tidak bisa disalin otomatis. Salin dari kolom di atas.");
    }
  };

  const openKtp = async (file) => {
    setError("");
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 300);
    if (err || !data?.signedUrl) { setError("Foto KTP belum bisa dibuka."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const statusLabel = latest?.status === "terisi" ? "Sudah terisi" : latest?.status === "menunggu" ? "Menunggu customer" : "Belum ada";
  const statusTone = latest?.status === "terisi" ? "text-emerald-600" : "text-amber-600";

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">QR form customer</h3>
            <p className="mt-0.5 text-xs text-slate-500">Customer scan QR, mengisi data, dan mengunggah KTP tanpa login.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">Tutup</button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Memuat...</p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Status</span>
              <span className={`font-semibold ${statusTone}`}>{statusLabel}</span>
            </div>

            {qrUrl && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <img src={qrUrl} alt="QR form customer" className="h-[220px] w-[220px] rounded-xl border border-slate-200 bg-white p-2" />
                <div className="flex w-full gap-2">
                  <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600" onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={copyLink} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">{copied ? "Tersalin" : "Salin"}</button>
                </div>
                <a href={qrUrl} download="qr-form-customer.png" className="text-xs font-medium text-orange-600 hover:underline">Unduh QR (PNG)</a>
              </div>
            )}

            {latest?.status === "menunggu" && !qrUrl && (
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                QR yang sudah dibuat tidak bisa ditampilkan ulang. Buat QR baru untuk menampilkan link. QR lama otomatis dibatalkan.
              </p>
            )}

            {latest?.status === "terisi" && (
              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold text-slate-700">Data dari customer</div>
                {FORM_FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-[130px_1fr] gap-2 text-sm">
                    <span className="text-slate-500">{f.label}</span>
                    <span className="break-words text-slate-800">{answers?.[f.key] || "-"}</span>
                  </div>
                ))}
                <div className="pt-2">
                  {files.length === 0 && <p className="text-xs text-slate-500">Foto KTP tidak ditemukan.</p>}
                  {files.map((file) => (
                    <button key={file.id} type="button" onClick={() => openKtp(file)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-orange-400">
                      Lihat foto KTP
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={createNew} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Membuat..." : latest ? "Buat QR baru" : "Buat QR"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
