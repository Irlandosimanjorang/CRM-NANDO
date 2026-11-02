// Halaman teknisi (3 Nov 2026): nexto.site/servis?t=<token servis>. Tanpa login.
// Teknisi menambah riwayat servis setelah perbaikan. Riwayat tidak bisa diubah atau dihapus dari halaman ini.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const inp = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10";
const MAX_PHOTOS = 5;
const todayIso = () => new Date().toISOString().slice(0, 10);

async function callCard(action, extra = {}, token) {
  const { data, error } = await supabase.functions.invoke("warranty-card", { body: { action, s: token, ...extra } });
  if (error) {
    let msg = null;
    try { msg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(msg || "Terjadi kendala. Silakan coba lagi.");
  }
  return data;
}

export default function WarrantyService() {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [info, setInfo] = useState({ loading: true, error: "", data: null });
  const [form, setForm] = useState({ service_date: todayIso(), problem: "", action_taken: "", technician_name: "" });
  const [photos, setPhotos] = useState([]); // { name, path }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  const reload = () => callCard("tech_get", {}, token);

  useEffect(() => {
    document.title = "Catat Servis - Nexto";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    reload()
      .then((data) => setInfo({ loading: false, error: "", data }))
      .catch((e) => setInfo({ loading: false, error: e.message, data: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPhoto = async (file) => {
    setMessage("");
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) { setMessage(`Maksimal ${MAX_PHOTOS} foto per entri.`); return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("action", "tech_upload");
      body.append("s", token);
      body.append("file", file);
      const { data, error } = await supabase.functions.invoke("warranty-card", { body });
      if (error) {
        let msg = null;
        try { msg = (await error.context.json())?.error; } catch (_) {}
        throw new Error(msg || "Foto belum terkirim.");
      }
      setPhotos((p) => [...p, { name: file.name, path: data.path }]);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await callCard("tech_add", { ...form, photo_paths: photos.map((p) => p.path) }, token);
      setSaved(true);
      setForm({ service_date: todayIso(), problem: "", action_taken: "", technician_name: form.technician_name });
      setPhotos([]);
      setInfo({ loading: false, error: "", data: await reload() });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">{children}</div>
    </div>
  );

  if (info.loading) return shell(<p className="text-sm text-slate-500">Memuat...</p>);
  if (info.error) return shell(<div className="rounded-2xl bg-white p-5 text-sm text-rose-600 shadow-sm">{info.error}</div>);

  const d = info.data;
  return shell(
    <>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="text-xs text-slate-500">{d.org_name}</div>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Catat servis: {d.product || "unit"}</h1>
        <p className="mt-1 text-sm text-slate-600">Isi setelah perbaikan selesai. Riwayat ini akan terlihat oleh customer lewat QR di unit.</p>
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Riwayat servis tersimpan.</p>}
        <label className="block"><span className="text-sm font-medium text-slate-700">Tanggal servis *</span>
          <input type="date" required className={inp} value={form.service_date} onChange={(e) => setForm((f) => ({ ...f, service_date: e.target.value }))} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Nama teknisi *</span>
          <input required maxLength={120} className={inp} value={form.technician_name} onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Kerusakan yang ditemukan *</span>
          <textarea required rows={3} maxLength={1000} className={inp} value={form.problem} onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Tindakan perbaikan *</span>
          <textarea required rows={3} maxLength={1000} className={inp} value={form.action_taken} onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))} />
        </label>

        <div>
          <span className="text-sm font-medium text-slate-700">Foto (opsional, maks {MAX_PHOTOS})</span>
          <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center hover:border-orange-400">
            <span className="text-sm font-medium text-slate-700">Tambah foto</span>
            <span className="text-xs text-slate-500">JPG, PNG, atau WEBP, maksimal 5 MB per foto</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} disabled={busy} />
          </label>
          {photos.length > 0 && <p className="mt-2 text-xs text-slate-500">{photos.length} foto siap dikirim.</p>}
        </div>

        {message && <p className="text-sm text-rose-600">{message}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Menyimpan..." : "Simpan riwayat servis"}
        </button>
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Riwayat sebelumnya ({d.logs.length})</h2>
        {d.logs.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada servis tercatat.</p>}
        <ul className="mt-3 space-y-3">
          {d.logs.map((l) => (
            <li key={l.id} className="border-l-2 border-slate-200 pl-3 text-sm">
              <div className="text-xs text-slate-500">{l.service_date} · {l.technician_name}</div>
              <div className="text-slate-800">{l.problem}</div>
              <div className="text-slate-600">{l.action}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
