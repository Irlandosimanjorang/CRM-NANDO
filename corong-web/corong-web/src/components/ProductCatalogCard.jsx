import React, { useEffect, useState } from "react";
import { getCatalogExample } from "../lib/industryTemplates";
import { Package, Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import * as db from "../lib/db";

// Katalog produk/layanan perusahaan (30 Sep 2026, permintaan Nando dari
// masukan calon klien) - dibaca AI "Ringkasan Kebutuhan" biar bisa
// rekomendasiin produk yang cocok sama kebutuhan prospek, bukan cuma nyimpulin
// kebutuhannya doang. Owner/manager yang ngisi, sales cuma liat.
//
// Simpan per kartu (30 Sep 2026, permintaan Nando) - tiap produk & profil
// punya tombol Simpan sendiri yang muncul pas ada perubahan, gantiin 1
// tombol "Simpan katalog" di bawah. Hapus produk langsung kesimpen.
const MAX_PRODUCTS = 8;
const EMPTY = { name: "", description: "", fit_for: "", price: "" };

const trimItem = (x) => ({ name: x.name.trim(), description: x.description.trim(), fit_for: x.fit_for.trim(), price: x.price.trim() });
const sameItem = (a, b) => !!a && !!b && JSON.stringify(trimItem(a)) === JSON.stringify(trimItem(b));

export default function ProductCatalogCard({ canManage, industry }) {
  const [profile, setProfile] = useState("");
  const [products, setProducts] = useState([]);
  // Versi yang terakhir tersimpan di database - buat nentuin kartu mana yang
  // punya perubahan belum disimpan.
  const [saved, setSaved] = useState({ profile: "", products: [] });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    db.getProductCatalog()
      .then((c) => {
        const list = Array.isArray(c.products) ? c.products : [];
        setProfile(c.company_profile || "");
        setProducts(list);
        setSaved({ profile: c.company_profile || "", products: list });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setItem = (i, k, v) => setProducts((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addItem = () => setProducts((p) => (p.length >= MAX_PRODUCTS ? p : [...p, { ...EMPTY }]));

  const flash = (text) => {
    setMsg(text);
    if (!text.startsWith("Gagal")) setTimeout(() => setMsg(""), 2500);
  };

  // Semua tombol Simpan (per kartu / profil) nyimpen isian yang lagi keliatan
  // sekaligus - 1 baris per org di database, jadi gak ada simpan parsial.
  const persist = async (nextProfile, nextProducts, key, okText) => {
    const clean = nextProducts.map(trimItem).filter((x) => x.name);
    setBusyKey(key);
    setMsg("");
    try {
      await db.saveProductCatalog(nextProfile.trim(), clean);
      setSaved({ profile: nextProfile.trim(), products: clean });
      setProfile(nextProfile.trim());
      // Kartu baru yang namanya masih kosong gak ikut kesimpen - tetep
      // ditampilin di paling bawah biar isiannya gak ilang.
      setProducts([...clean, ...nextProducts.filter((x) => !x.name.trim())]);
      flash(okText);
      return true;
    } catch (e) {
      flash("Gagal simpan: " + e.message);
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const saveItem = (i) => persist(profile, products, `item-${i}`, `"${products[i].name.trim()}" tersimpan`);
  const saveProfile = () => persist(profile, products, "profile", "Profil perusahaan tersimpan");
  const delItem = async (i) => {
    const removed = products[i];
    const next = products.filter((_, j) => j !== i);
    // Kartu baru yang belum pernah disimpan cukup diilangin dari layar.
    if (!removed.name.trim() && !saved.products[i]) { setProducts(next); return; }
    await persist(profile, next, `item-${i}`, removed.name.trim() ? `"${removed.name.trim()}" dihapus` : "Produk dihapus");
  };

  const profileDirty = profile.trim() !== saved.profile;
  const inp = "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-600";
  const saveBtn = "bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5";

  return (
    <div className="bg-white border border-slate-100 rounded-panel p-4">
      <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5"><Package size={15} className="text-orange-500" /> Produk & Layanan Perusahaan</h3>
      <p className="text-xs text-slate-500 mb-3">
        Dibaca AI di 4 fitur: <b className="font-semibold text-slate-600">Ringkasan Kebutuhan</b> (rekomendasi produk yang cocok ke tiap prospek), <b className="font-semibold text-slate-600">Draft Follow-up</b> (pesan WA/email nyebut produk yang relevan), <b className="font-semibold text-slate-600">Generate Leads</b> (mencari perusahaan yang membutuhkan produk Anda) dan <b className="font-semibold text-slate-600">Daily Digest</b> (saran harian menyebut produk yang tepat untuk ditawarkan). Semakin jelas "cocok untuk siapa", semakin tepat hasilnya.
        {!canManage && " Hanya owner/manager yang dapat mengubah."}
      </p>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-slate-400" />
      ) : (
        <>
          <label className="block text-xs font-medium text-slate-600 mb-1">Profil singkat perusahaan</label>
          <textarea
            className={inp + " min-h-[64px]"}
            maxLength={1000}
            disabled={!canManage}
            placeholder={getCatalogExample(industry)}
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          />
          {canManage && profileDirty && (
            <div className="mt-2 flex justify-end">
              <button onClick={saveProfile} disabled={!!busyKey} className={saveBtn}>
                {busyKey === "profile" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan profil
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {products.map((p, i) => {
              const isSaved = sameItem(p, saved.products[i]);
              const noName = !p.name.trim();
              return (
                <div key={i} className={`border rounded-2xl p-3 space-y-2 ${isSaved ? "border-slate-200" : "border-orange-200 bg-orange-50/30"}`}>
                  <div className="flex items-center gap-2">
                    <input className={inp} maxLength={80} disabled={!canManage} placeholder="Nama produk/layanan *" value={p.name} onChange={(e) => setItem(i, "name", e.target.value)} />
                    {canManage && (
                      <button onClick={() => delItem(i)} disabled={!!busyKey} className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors" title="Hapus produk" aria-label="Hapus produk"><Trash2 size={16} /></button>
                    )}
                  </div>
                  <textarea className={inp} rows={2} maxLength={300} disabled={!canManage} placeholder="Deskripsi singkat" value={p.description} onChange={(e) => setItem(i, "description", e.target.value)} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input className={inp + " sm:col-span-2"} maxLength={200} disabled={!canManage} placeholder="Cocok untuk siapa / masalah apa" value={p.fit_for} onChange={(e) => setItem(i, "fit_for", e.target.value)} />
                    <input className={inp} maxLength={60} disabled={!canManage} placeholder="Kisaran harga (opsional)" value={p.price} onChange={(e) => setItem(i, "price", e.target.value)} />
                  </div>
                  {canManage && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {isSaved ? (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> Tersimpan</span>
                      ) : (
                        <>
                          {noName && <span className="text-[11px] text-slate-400">Isi nama produk terlebih dahulu</span>}
                          <button onClick={() => saveItem(i)} disabled={!!busyKey || noName} className={saveBtn}>
                            {busyKey === `item-${i}` ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {products.length === 0 && (
              <p className="text-xs text-slate-400">Belum ada produk. {canManage ? "Tambahkan minimal 1 agar AI dapat memberikan rekomendasi." : ""}</p>
            )}
          </div>

          {canManage && (
            <div className="mt-3">
              <button onClick={addItem} disabled={products.length >= MAX_PRODUCTS} className="text-xs text-orange-600 disabled:opacity-40 flex items-center gap-1">
                <Plus size={13} /> tambah produk {products.length >= MAX_PRODUCTS && `(maks ${MAX_PRODUCTS})`}
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
