import React, { useEffect, useState } from "react";
import { Package, Plus, Trash2, Save, Loader2, CheckCircle2, Upload } from "lucide-react";
import * as db from "../lib/db";

// Katalog produk/layanan perusahaan (30 Sep 2026, permintaan Nando dari
// masukan calon klien) - dibaca AI "Ringkasan Kebutuhan" biar bisa
// rekomendasiin produk yang cocok sama kebutuhan prospek, bukan cuma nyimpulin
// kebutuhannya doang. Owner/manager yang ngisi, sales cuma liat.
const MAX_PRODUCTS = 20;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const EMPTY = { name: "", description: "", fit_for: "", price: "" };

export default function ProductCatalogCard({ canManage }) {
  const [profile, setProfile] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    db.getProductCatalog()
      .then((c) => { setProfile(c.company_profile || ""); setProducts(Array.isArray(c.products) ? c.products : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setItem = (i, k, v) => setProducts((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addItem = () => setProducts((p) => (p.length >= MAX_PRODUCTS ? p : [...p, { ...EMPTY }]));
  const delItem = (i) => setProducts((p) => p.filter((_, j) => j !== i));

  const [importing, setImporting] = useState(false);
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setMsg("Gagal: file kegedean (maks 4MB)."); return; }
    setImporting(true);
    setMsg("");
    try {
      const res = await db.extractProductCatalog(file);
      // Digabung ke isian yang udah ada (bukan ditimpa) - produk yang namanya
      // udah ada di-skip, profil cuma diisi kalau masih kosong.
      const existing = new Set(products.map((p) => p.name.trim().toLowerCase()));
      const fresh = (res.products || []).filter((p) => !existing.has(p.name.trim().toLowerCase()));
      const room = MAX_PRODUCTS - products.length;
      setProducts((p) => [...p, ...fresh.slice(0, room)]);
      if (!profile.trim() && res.company_profile) setProfile(res.company_profile);
      const added = Math.min(fresh.length, room);
      setMsg(added > 0
        ? `${added} produk diambil dari dokumen${fresh.length > room ? ` (${fresh.length - room} kelewat, katalog maks ${MAX_PRODUCTS})` : ""}. Cek & edit dulu, lalu klik Simpan katalog.`
        : "Gak ada produk baru yang ketemu di dokumen ini.");
    } catch (err) {
      setMsg("Gagal: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const save = async () => {
    const clean = products
      .map((x) => ({ name: x.name.trim(), description: x.description.trim(), fit_for: x.fit_for.trim(), price: x.price.trim() }))
      .filter((x) => x.name);
    setBusy(true);
    setMsg("");
    try {
      await db.saveProductCatalog(profile.trim(), clean);
      setProducts(clean);
      setMsg("Tersimpan");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg("Gagal simpan: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const inp = "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-600";

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] p-4">
      <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Package size={15} className="text-orange-500" /> Produk & Layanan Perusahaan</h3>
      <p className="text-xs text-slate-500 mb-3">
        Dipakai AI Ringkasan Kebutuhan buat rekomendasiin produk yang cocok ke tiap prospek. Makin jelas "cocok untuk siapa", makin tepat rekomendasinya.
        {!canManage && " Cuma owner/manager yang bisa ubah."}
      </p>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-slate-400" />
      ) : (
        <>
          {canManage && (
            <div className="mb-4 flex items-center gap-3 flex-wrap bg-orange-50/60 border border-orange-100 rounded-2xl px-3 py-2.5">
              <label className={`text-sm font-medium rounded-xl px-3 py-1.5 flex items-center gap-1.5 cursor-pointer ${importing ? "bg-orange-300 text-white pointer-events-none" : "bg-orange-600 hover:bg-orange-700 text-white"}`}>
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? "AI lagi baca dokumen..." : "Upload PDF / Word"}
                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={importFile} disabled={importing} />
              </label>
              <span className="text-xs text-slate-500">Company profile, brosur, atau price list - AI isiin form di bawah otomatis. Maks 4MB.</span>
            </div>
          )}
          <label className="block text-xs font-medium text-slate-600 mb-1">Profil singkat perusahaan</label>
          <textarea
            className={inp + " min-h-[64px]"}
            maxLength={1000}
            disabled={!canManage}
            placeholder="Misal: Konsultan HR & training untuk perusahaan 100+ karyawan di Jabodetabek."
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          />

          <div className="mt-4 space-y-3">
            {products.map((p, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input className={inp} maxLength={80} disabled={!canManage} placeholder="Nama produk/layanan *" value={p.name} onChange={(e) => setItem(i, "name", e.target.value)} />
                  {canManage && (
                    <button onClick={() => delItem(i)} className="text-slate-300 hover:text-rose-500 shrink-0" title="Hapus"><Trash2 size={15} /></button>
                  )}
                </div>
                <textarea className={inp} rows={2} maxLength={300} disabled={!canManage} placeholder="Deskripsi singkat" value={p.description} onChange={(e) => setItem(i, "description", e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input className={inp + " sm:col-span-2"} maxLength={200} disabled={!canManage} placeholder="Cocok untuk siapa / masalah apa" value={p.fit_for} onChange={(e) => setItem(i, "fit_for", e.target.value)} />
                  <input className={inp} maxLength={60} disabled={!canManage} placeholder="Kisaran harga (opsional)" value={p.price} onChange={(e) => setItem(i, "price", e.target.value)} />
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-xs text-slate-400">Belum ada produk. {canManage ? "Tambahin minimal 1 biar AI bisa kasih rekomendasi." : ""}</p>
            )}
          </div>

          {canManage && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button onClick={addItem} disabled={products.length >= MAX_PRODUCTS} className="text-xs text-orange-600 disabled:opacity-40 flex items-center gap-1">
                <Plus size={13} /> tambah produk {products.length >= MAX_PRODUCTS && `(maks ${MAX_PRODUCTS})`}
              </button>
              <button onClick={save} disabled={busy} className="ml-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-3.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan katalog
              </button>
            </div>
          )}
          {msg && (
            <p className={`text-xs mt-2 flex items-center gap-1 ${msg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>
              {!msg.startsWith("Gagal") && <CheckCircle2 size={13} />} {msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
