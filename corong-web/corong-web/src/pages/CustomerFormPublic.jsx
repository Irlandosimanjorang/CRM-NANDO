// Halaman form customer (2 Nov 2026): nexto.site/isi?t=<token>. Dibuka dari QR proyek deal, tanpa login.
// Data dan KTP dikirim lewat edge function customer-form. Isian harus sama dengan FORM_FIELDS.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FORM_FIELDS } from "../lib/customerForm";

const inp = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10";

async function callForm(action, extra = {}) {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const { data, error } = await supabase.functions.invoke("customer-form", { body: { action, token, ...extra } });
  if (error) {
    let msg = null;
    try { msg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(msg || "Terjadi kendala. Silakan coba lagi.");
  }
  return data;
}

export default function CustomerFormPublic() {
  const [info, setInfo] = useState({ loading: true, error: "", data: null });
  const [values, setValues] = useState({});
  const [ktp, setKtp] = useState(null);
  const [ktpName, setKtpName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Formulir Data - Nexto";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    callForm("get")
      .then((data) => {
        setInfo({ loading: false, error: "", data });
        if (data.status === "terisi") setDone(true);
      })
      .catch((e) => setInfo({ loading: false, error: e.message, data: null }));
  }, []);

  const pickKtp = async (file) => {
    setMessage("");
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("action", "upload");
      body.append("token", new URLSearchParams(window.location.search).get("t") || "");
      body.append("file", file);
      const { data, error } = await supabase.functions.invoke("customer-form", { body });
      if (error) {
        let msg = null;
        try { msg = (await error.context.json())?.error; } catch (_) {}
        throw new Error(msg || "Foto KTP belum terkirim.");
      }
      setKtp(file);
      setKtpName(data?.name || file.name);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!ktp) { setMessage("Unggah foto KTP terlebih dahulu."); return; }
    if (!consent) { setMessage("Centang persetujuan pemrosesan data untuk melanjutkan."); return; }
    setBusy(true);
    try {
      await callForm("submit", { ...values, consent: true });
      setDone(true);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-sm sm:p-7">{children}</div>
    </div>
  );

  if (info.loading) return shell(<p className="text-sm text-slate-500">Memuat formulir...</p>);
  if (info.error) return shell(<p className="text-sm text-rose-600">{info.error}</p>);
  if (done) {
    return shell(
      <div className="text-center">
        <h1 className="text-lg font-semibold text-slate-900">Data Anda sudah terkirim</h1>
        <p className="mt-2 text-sm text-slate-600">Terima kasih. Tim {info.data.org_name || "kami"} akan menghubungi Anda untuk langkah berikutnya.</p>
      </div>
    );
  }

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Formulir data {info.data.org_name}</h1>
        <p className="mt-1 text-sm text-slate-600">Isi data di bawah ini dan unggah foto KTP Anda. Tanda * wajib diisi.</p>
      </div>

      {FORM_FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="text-sm font-medium text-slate-700">{f.label}{f.required ? " *" : ""}</span>
          {f.textarea ? (
            <textarea rows={3} maxLength={f.max} className={inp} value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          ) : (
            <input
              maxLength={f.max}
              inputMode={f.inputMode}
              required={f.required}
              className={inp}
              value={values[f.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          )}
        </label>
      ))}

      <div>
        <span className="text-sm font-medium text-slate-700">Foto KTP *</span>
        <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-orange-400">
          <span className="text-sm font-medium text-slate-700">{ktpName || "Pilih foto KTP"}</span>
          <span className="text-xs text-slate-500">JPG, PNG, WEBP, atau PDF, maksimal 5 MB</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" onChange={(e) => pickKtp(e.target.files?.[0])} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-600" />
        <span>Saya menyetujui data pribadi dan foto KTP saya diproses oleh {info.data.org_name} untuk keperluan proyek ini.</span>
      </label>

      {message && <p className="text-sm text-rose-600">{message}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Mengirim..." : "Kirim data"}
      </button>
    </form>
  );
}
