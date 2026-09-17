import { Lock } from "lucide-react";
import { LEVEL_LABEL, LEVEL_PRICE, MAYAR_PAYMENT_LINK } from "../lib/plans";

// Overlay generic buat ngunci konten yang butuh tier lebih tinggi - dipindah
// dari App.jsx ke sini (10 Sep 2026) biar bisa dipake ulang di tab lain
// (Settings) dengan cara yang lebih presisi, bukan cuma nutup SATU tab utuh.
//
// BUG FIX: pesannya dulu HARDCODE selalu "Professional" di semua tempat,
// padahal tab Pengaturan sebenernya cuma butuh Standard buat kebuka - user
// Free ditawarin upgrade ke tier yang lebih MAHAL dari yang seharusnya buat
// fitur itu. Sekarang labelnya dinamis ngikutin `minLevel` yang beneran
// dibutuhin (1 = Standard, 2 = Professional), lewat LEVEL_LABEL/LEVEL_PRICE.
//
// BUG FIX (17 Sep 2026, ketauan Nando manual): overlay klik + `inert` di
// bawah bikin SELURUH children non-interaktif - termasuk tombol "Upgrade"
// yang KEBETULAN ada di dalam konten yang dikunci (misal kartu Akun di tab
// Pengaturan). Efeknya user Free gak bisa klik satu-satunya jalan keluar
// dari lock ini - malah cuma dapet alert generik terus-terusan. Sekarang
// banner-nya sendiri (di LUAR zona overlay/inert) bawa link Upgrade yang
// BENERAN jalan, jadi selalu ada jalan keluar yang gak kena block.
export default function PreviewLock({ locked, minLevel = 2, children }) {
  if (!locked) return children;
  const tierLabel = LEVEL_LABEL[minLevel] || "Professional";
  const tierPrice = LEVEL_PRICE[minLevel] || "Rp269rb/bulan";
  return (
    <div>
      {/* Banner + link Upgrade SENGAJA di LUAR div overlay/inert di bawah -
          dulu overlay-nya `absolute inset-0 top-11` nebak tinggi banner pake
          angka tetap (44px), jadi kalau banner ini ngebungkus jadi 2 baris
          (misal di HP layar sempit, teks + tombol gak muat 1 baris), overlay
          bisa nutupin sebagian banner-nya sendiri termasuk tombol Upgrade.
          Sekarang overlay cuma bungkus `children` doang di div terpisah,
          gak perlu nebak-nebak tinggi apapun lagi. */}
      <div className="mb-3 bg-slate-800 text-white text-xs rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2"><Lock size={13} className="shrink-0" /> Mode lihat-lihat doang - upgrade ke {tierLabel} buat bisa nambah/ubah data di sini.</span>
        <a
          href={MAYAR_PAYMENT_LINK}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-white text-slate-900 rounded-full px-2.5 py-1 hover:bg-slate-100 transition-colors"
        >
          Upgrade ke {tierLabel} →
        </a>
      </div>
      <div className="relative">
        <div
          onClick={() => alert(`Ini fitur ${tierLabel} bro - upgrade dulu (${tierPrice}) buat bisa pake fiturnya.`)}
          className="absolute inset-0 z-20 cursor-pointer"
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
    </div>
  );
}
