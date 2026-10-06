// Pengaturan merek dokumen (Quotation & Invoice): identitas penerbit, logo,
// tanda tangan & stempel, rekening, warna, penomoran, syarat bawaan, PPN.
// Disimpan per organisasi (tabel doc_settings) dan dipakai semua dokumen baru;
// dokumen yang sudah terbit memakai salinan (snapshot) saat diterbitkan.
import { useMemo, useRef, useState } from "react";
import { Upload, Trash2, Check } from "lucide-react";
import * as db from "../../lib/db";
import { Panel, PanelHeader, Pill } from "../../ui";
import { processSignatureFile, resizeImageToDataUrl, printHtml } from "../../lib/docKit";
import { DEFAULT_SETTINGS, buildDocumentHtml, addDaysISO, todayWIB } from "../../lib/documents";
import { field, lbl, btnPrimary, btnGhost, Spinner, DocPreview, errText } from "./shared";

const ACCENTS = ["#c2410c", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#334155"];

// Dokumen contoh untuk pratinjau pengaturan - bukan data nyata.
function sampleDoc(kind, s) {
  const today = todayWIB();
  return {
    kind, status: kind === "invoice" ? "unpaid" : "issued", number: `${kind === "invoice" ? s.invoice_prefix : s.quotation_prefix}/${today.slice(0, 4)}/${today.slice(5, 7)}/0001`.toUpperCase(),
    customer: { name: "PT Contoh Pelanggan", contact: "Ibu Sari", email: "sari@contoh.co.id", phone: "0812-0000-0000", address: "Jl. Contoh No. 10, Jakarta" },
    issue_date: today, due_date: addDaysISO(today, kind === "invoice" ? s.default_due_days : s.default_validity_days),
    items: [
      { code: "A-01", name: "Layanan contoh", desc: "Deskripsi singkat layanan", qty: 2, unit: "paket", price: 1500000, discount_pct: 0 },
      { code: "B-02", name: "Produk contoh", desc: "", qty: 10, unit: "pcs", price: 125000, discount_pct: 10 },
    ],
    discount_type: "amount", discount_value: 0, tax_on: !!s.default_tax_on, tax_rate: Number(s.default_tax_rate) || 0, tax_label: s.tax_label || "PPN",
    notes: "", terms: kind === "invoice" ? s.invoice_terms : s.quotation_terms, amount_paid: 0,
  };
}

function ImageSlot({ label, hint, value, onPick, onClear, disabled, busy }) {
  const ref = useRef(null);
  return (
    <div>
      <span className={lbl}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
          {value ? <img src={value} alt={label} className="max-h-14 max-w-[104px] object-contain" /> : <span className="text-[11px] text-slate-400">Belum ada</span>}
        </div>
        <div className="min-w-0">
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} className={btnGhost + " !px-3 !py-1.5 !text-[12px]"}>{busy ? <Spinner /> : <Upload size={13} />} {value ? "Ganti" : "Unggah"}</button>
            {value && <button type="button" disabled={disabled} onClick={onClear} className={btnGhost + " !px-3 !py-1.5 !text-[12px]"}><Trash2 size={13} /> Hapus</button>}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function BrandSettings({ settings, canManage, onSaved, onNotify, isEnterprise }) {
  const [s, setS] = useState({ ...DEFAULT_SETTINGS, ...(settings || {}), seller: { ...(settings?.seller || {}) } });
  const [saving, setSaving] = useState(false);
  const [busyImg, setBusyImg] = useState("");
  const [previewKind, setPreviewKind] = useState("invoice");
  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify({ ...DEFAULT_SETTINGS, ...(settings || {}), seller: { ...(settings?.seller || {}) } }), [s, settings]);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const setSeller = (k, v) => setS((p) => ({ ...p, seller: { ...p.seller, [k]: v } }));
  const html = useMemo(() => buildDocumentHtml(sampleDoc(previewKind, s), { seller: s.seller, accent: s.accent, footer: s.footer_text }), [s, previewKind]);

  const pickImage = async (key, file, mode) => {
    setBusyImg(key);
    try {
      const url = mode === "logo" ? await resizeImageToDataUrl(file) : await processSignatureFile(file, mode === "stamp" ? { maxW: 360, maxH: 360, keepColor: true } : {});
      setSeller(key, url);
    } catch (e) { onNotify?.(errText(e), "error"); } finally { setBusyImg(""); }
  };

  const save = async () => {
    if (!String(s.seller.name || "").trim()) { onNotify?.("Nama perusahaan penerbit wajib diisi.", "error"); return; }
    setSaving(true);
    try {
      const patch = {
        seller: s.seller, accent: s.accent, quotation_prefix: s.quotation_prefix.trim() || "QT", invoice_prefix: s.invoice_prefix.trim() || "INV",
        quotation_terms: s.quotation_terms, invoice_terms: s.invoice_terms, footer_text: s.footer_text, tax_label: s.tax_label.trim() || "PPN",
        default_tax_rate: Number(s.default_tax_rate) || 0, default_tax_on: !!s.default_tax_on,
        default_validity_days: Math.min(365, Math.max(1, parseInt(s.default_validity_days, 10) || 14)),
        default_due_days: Math.min(365, Math.max(0, parseInt(s.default_due_days, 10) || 0)),
      };
      const saved = await db.saveDocSettings(patch);
      onSaved(saved);
      onNotify?.("Pengaturan dokumen disimpan.", "success");
    } catch (e) { onNotify?.(errText(e), "error"); } finally { setSaving(false); }
  };

  const dis = !canManage;
  const ex = (p) => `${(p || "").toUpperCase()}/${todayWIB().slice(0, 4)}/${todayWIB().slice(5, 7)}/0001`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="grid gap-4">
        {dis && <div className="rounded-inner border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800">Hanya owner dan manager yang bisa mengubah pengaturan ini. Anda dapat melihat tampilannya.</div>}

        <Panel className="p-5">
          <PanelHeader title="Identitas penerbit" meta="Tampil di kepala dokumen dan email ke customer." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className={lbl}>Nama perusahaan *</span><input className={field} disabled={dis} maxLength={120} value={s.seller.name || ""} onChange={(e) => setSeller("name", e.target.value)} placeholder="PT Contoh Sejahtera" /></label>
            <label className="sm:col-span-2"><span className={lbl}>Alamat</span><textarea className={field} rows={2} disabled={dis} maxLength={300} value={s.seller.address || ""} onChange={(e) => setSeller("address", e.target.value)} /></label>
            <label><span className={lbl}>Email</span><input type="email" className={field} disabled={dis} maxLength={120} value={s.seller.email || ""} onChange={(e) => setSeller("email", e.target.value)} placeholder="finance@perusahaan.co.id" /></label>
            <label><span className={lbl}>Telepon</span><input className={field} disabled={dis} maxLength={40} value={s.seller.phone || ""} onChange={(e) => setSeller("phone", e.target.value)} /></label>
            <label><span className={lbl}>NPWP (opsional)</span><input className={field} disabled={dis} maxLength={30} value={s.seller.npwp || ""} onChange={(e) => setSeller("npwp", e.target.value)} /></label>
          </div>
          <div className="mt-4"><ImageSlot label="Logo" hint="PNG atau JPG, otomatis diperkecil. Logo berlatar transparan paling rapi." value={s.seller.logoImage} disabled={dis} busy={busyImg === "logoImage"} onPick={(f) => pickImage("logoImage", f, "logo")} onClear={() => setSeller("logoImage", "")} /></div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Tanda tangan dan stempel" meta="Foto dari HP bisa dipakai; latar kertas dihapus otomatis." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ImageSlot label="Tanda tangan" hint="Foto tanda tangan di kertas putih." value={s.seller.signImage} disabled={dis} busy={busyImg === "signImage"} onPick={(f) => pickImage("signImage", f, "sign")} onClear={() => setSeller("signImage", "")} />
            <ImageSlot label="Stempel" hint="Warna asli stempel dipertahankan." value={s.seller.stampImage} disabled={dis} busy={busyImg === "stampImage"} onPick={(f) => pickImage("stampImage", f, "stamp")} onClear={() => setSeller("stampImage", "")} />
            <label><span className={lbl}>Nama penanda tangan</span><input className={field} disabled={dis} maxLength={80} value={s.seller.signName || ""} onChange={(e) => setSeller("signName", e.target.value)} /></label>
            <label><span className={lbl}>Jabatan</span><input className={field} disabled={dis} maxLength={80} value={s.seller.signTitle || ""} onChange={(e) => setSeller("signTitle", e.target.value)} placeholder="Direktur" /></label>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Rekening pembayaran" meta="Tampil di invoice dan email invoice." />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label><span className={lbl}>Bank</span><input className={field} disabled={dis} maxLength={40} value={s.seller.bank || ""} onChange={(e) => setSeller("bank", e.target.value)} placeholder="BCA" /></label>
            <label><span className={lbl}>No. rekening</span><input className={field} disabled={dis} maxLength={40} inputMode="numeric" value={s.seller.account || ""} onChange={(e) => setSeller("account", e.target.value)} /></label>
            <label><span className={lbl}>Atas nama</span><input className={field} disabled={dis} maxLength={80} value={s.seller.holder || ""} onChange={(e) => setSeller("holder", e.target.value)} /></label>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Tampilan dan penomoran" />
          <div className="mt-4 grid gap-4">
            <div>
              <span className={lbl}>Warna aksen</span>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => (
                  <button key={c} type="button" disabled={dis} onClick={() => set("accent", c)} aria-label={`Warna ${c}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" style={{ background: c }}>
                    {s.accent.toLowerCase() === c ? <Check size={14} className="text-white" /> : null}
                  </button>
                ))}
                <input type="color" disabled={dis} value={s.accent} onChange={(e) => set("accent", e.target.value)} aria-label="Pilih warna lain" className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={lbl}>Awalan nomor quotation</span><input className={field} disabled={dis} maxLength={12} value={s.quotation_prefix} onChange={(e) => set("quotation_prefix", e.target.value.replace(/[^A-Za-z0-9/-]/g, ""))} /><span className="mt-1 block text-[11px] text-slate-500">Contoh: {ex(s.quotation_prefix || "QT")}</span></label>
              <label><span className={lbl}>Awalan nomor invoice</span><input className={field} disabled={dis} maxLength={12} value={s.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value.replace(/[^A-Za-z0-9/-]/g, ""))} /><span className="mt-1 block text-[11px] text-slate-500">Contoh: {ex(s.invoice_prefix || "INV")}</span></label>
            </div>
            <label><span className={lbl}>Teks kaki dokumen (opsional)</span><input className={field} disabled={dis} maxLength={160} value={s.footer_text} onChange={(e) => set("footer_text", e.target.value)} placeholder="Terima kasih atas kepercayaan Anda." /></label>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Nilai bawaan dokumen baru" meta="Bisa diubah di tiap dokumen." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label><span className={lbl}>Quotation berlaku (hari)</span><input type="number" min={1} max={365} className={field} disabled={dis} value={s.default_validity_days} onChange={(e) => set("default_validity_days", e.target.value)} /></label>
            <label><span className={lbl}>Jatuh tempo invoice (hari)</span><input type="number" min={0} max={365} className={field} disabled={dis} value={s.default_due_days} onChange={(e) => set("default_due_days", e.target.value)} /></label>
            <div className="sm:col-span-2 rounded-inner border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-800"><input type="checkbox" disabled={dis} checked={!!s.default_tax_on} onChange={(e) => set("default_tax_on", e.target.checked)} className="h-4 w-4 accent-orange-600" /> Kenakan pajak secara bawaan</label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label><span className={lbl}>Nama pajak</span><input className={field} disabled={dis} maxLength={20} value={s.tax_label} onChange={(e) => set("tax_label", e.target.value)} /></label>
                <label><span className={lbl}>Tarif (%)</span><input type="number" min={0} max={100} step="0.1" className={field} disabled={dis} value={s.default_tax_rate} onChange={(e) => set("default_tax_rate", e.target.value)} /></label>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Nexto hanya menghitung angka sesuai tarif yang Anda isi. Penentuan tarif dan kewajiban pajak mengikuti ketentuan perpajakan dan konsultan pajak Anda.</p>
            </div>
            <label className="sm:col-span-2"><span className={lbl}>Syarat dan ketentuan quotation</span><textarea className={field} rows={3} disabled={dis} maxLength={2000} value={s.quotation_terms} onChange={(e) => set("quotation_terms", e.target.value)} placeholder="Harga belum termasuk ongkos kirim. Penawaran berlaku sesuai tanggal di atas." /></label>
            <label className="sm:col-span-2"><span className={lbl}>Syarat dan ketentuan invoice</span><textarea className={field} rows={3} disabled={dis} maxLength={2000} value={s.invoice_terms} onChange={(e) => set("invoice_terms", e.target.value)} placeholder="Pembayaran paling lambat pada tanggal jatuh tempo." /></label>
          </div>
        </Panel>

        {canManage && (
          <div className="sticky bottom-24 z-10 flex items-center justify-end gap-3 rounded-panel border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-4">
            {dirty && <span className="text-[12px] text-slate-500">Ada perubahan yang belum disimpan.</span>}
            <button type="button" onClick={save} disabled={saving || !dirty} className={btnPrimary}>{saving && <Spinner />} Simpan pengaturan</button>
          </div>
        )}
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className="text-[12px] font-semibold text-slate-700">Pratinjau dengan data contoh</span>
            <div className="flex items-center gap-1.5">
              {["invoice", "quotation"].map((k) => (
                <button key={k} type="button" onClick={() => setPreviewKind(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${previewKind === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{k === "invoice" ? "Invoice" : "Quotation"}</button>
              ))}
            </div>
          </div>
          <DocPreview html={html} minHeight={700} />
          <div className="flex justify-end border-t border-slate-100 px-4 py-2.5">
            <button type="button" onClick={() => printHtml(html)} className={btnGhost + " !py-1.5 !text-[12px]"}>Cetak contoh</button>
          </div>
        </Panel>
        {isEnterprise && <div className="mt-2"><Pill tone="neutral">Katalog produk Enterprise tersedia saat membuat item</Pill></div>}
      </div>
    </div>
  );
}
