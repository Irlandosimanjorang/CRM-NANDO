import { Lock } from "lucide-react";
import { LEVEL_LABEL, LEVEL_PRICE } from "../lib/plans";

// Overlay generic buat ngunci konten yang butuh tier lebih tinggi - dipindah
// dari App.jsx ke sini (10 Sep 2026) biar bisa dipake ulang di tab lain
// (Settings) dengan cara yang lebih presisi, bukan cuma nutup SATU tab utuh.
//
// BUG FIX: pesannya dulu HARDCODE selalu "Professional" di semua tempat,
// padahal tab Pengaturan sebenernya cuma butuh Standard buat kebuka - user
// Free ditawarin upgrade ke tier yang lebih MAHAL dari yang seharusnya buat
// fitur itu. Sekarang labelnya dinamis ngikutin `minLevel` yang beneran
// dibutuhin (1 = Standard, 2 = Professional), lewat LEVEL_LABEL/LEVEL_PRICE.
export default function PreviewLock({ locked, minLevel = 2, children }) {
  if (!locked) return children;
  const tierLabel = LEVEL_LABEL[minLevel] || "Professional";
  const tierPrice = LEVEL_PRICE[minLevel] || "Rp269rb/bulan";
  return (
    <div className="relative">
      <div className="mb-3 bg-slate-800 text-white text-xs rounded-2xl px-4 py-2.5 flex items-center gap-2">
        <Lock size={13} className="shrink-0" /> Mode lihat-lihat doang - upgrade ke {tierLabel} buat bisa nambah/ubah data di sini.
      </div>
      <div
        onClick={() => alert(`Ini fitur ${tierLabel} bro - upgrade dulu (${tierPrice}) buat bisa pake fiturnya.`)}
        className="absolute inset-0 top-11 z-20 cursor-pointer"
      />
      {/* GATE FIX (audit 16 Sep 2026): overlay di atas cuma nangkep KLIK
          MOUSE - konten asli di `children` sebelumnya tetep hidup & bisa
          di-Tab+Enter pake keyboard, nembus overlay ini sepenuhnya (ketauan
          di tombol Generate Leads). `inert` (atribut HTML native, didukung
          browser modern) matiin SELURUH interaktivitas subtree ini - gak
          bisa di-fokus/di-Tab/diklik/dipencet Enter sama sekali, bukan cuma
          "kelihatan kekunci" doang lewat CSS. */}
      <div inert="">{children}</div>
    </div>
  );
}
