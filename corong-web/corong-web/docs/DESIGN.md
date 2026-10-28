# Aturan Desain Nexto

Dokumen ini jadi acuan semua halaman app. Tujuannya satu: Nexto kelihatan
seperti produk yang didesain dengan sengaja, bukan template dashboard.
Kalau ragu, pilih yang lebih tenang.

## 1. Warna (punya peran, bukan hiasan)

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `ink` | slate-900 `#0f172a` | Teks utama, angka besar, tombol sekunder gelap |
| `brand` | orange-500/600 `#f97316` / `#ea580c` | Aksi utama, penanda "punya Anda", data utama di grafik |
| `ai` | violet `#6d5dfc` | **Hanya** fitur AI (NEX AI, draft AI, ringkasan AI) |
| status | emerald / amber / rose | Bagus / perlu perhatian / bahaya. Tidak dipakai sebagai aksen |
| struktur | slate-100 s/d slate-400 | Garis, latar sekunder, teks bantu |

- Tidak ada gradasi dua warna (oranye→ungu dsb.) di bar, cincin, atau grafik.
  Area chart boleh memakai isian satu warna yang memudar.
- Uang masuk = emerald. Deal = emerald. Lead baru = brand.

## 2. Tipografi

- **Sora** (`font-display`): judul halaman, judul panel, angka besar.
  `h1`-`h3` otomatis Sora lewat `index.css`.
- **Plus Jakarta Sans** (`font-sans`, default): semua teks lain. Dibuat
  studio Indonesia (Tokotype), cocok dengan produk sales Indonesia.
- Angka yang dibandingkan antar baris selalu `tabular-nums`.
- Skala: 28/22 (judul halaman), 15 (judul panel), 13 (teks), 11 (bantu), 10 (keterangan grafik).
- Judul pakai huruf kapital biasa (sentence case). Label HURUF BESAR berjarak
  hanya untuk konteks di atas judul halaman, maksimal satu per halaman.

## 3. Permukaan

- `Panel` (radius 20px, border tipis, **tanpa bayangan**) untuk mengelompokkan isi.
- Di dalam panel, pisahkan bagian dengan garis (`divide-y` / `border-t`),
  bukan panel di dalam panel.
- Radius bertingkat: panel 20px (`rounded-panel`), elemen dalam 12px
  (`rounded-inner`), pill bulat penuh.
- Bayangan hanya untuk yang melayang: modal, dropdown, toast (`shadow-float`).
- Satu permukaan gelap per halaman sebagai titik fokus (mis. NEX AI di
  Dashboard, Denyut Team di tab Team).

## 4. Ikon

- Ikon mendampingi aksi atau status, bukan dekorasi judul.
  Tidak ada "ikon dalam kotak berwarna" di setiap judul panel.

## 5. Gerak

- Satu momen animasi per halaman (mis. angka utama menghitung naik).
- Animasi yang merespons aksi user (buka, simpan, pindah tahap) boleh.
- Selalu hormati `prefers-reduced-motion` (`motion-safe:`).

## 6. Teks

- Menyapa user dengan "Anda", bahasa baku, tanpa tanda seru ganda.
- Tombol menyebut hasilnya: "Simpan target", bukan "Submit".
- Keadaan kosong memberi arah: apa yang harus dilakukan agar data muncul.
- Tidak ada metrik palsu ("↑ aktif", "agenda"). Setiap angka kecil harus benar.

## 7. Komponen bersama (`src/ui`)

`Panel`, `PanelHeader`, `Stat`, `StatRow`, `Pill`, `Meter`, `EmptyState`.
Halaman baru wajib memakai komponen ini sebelum menulis class sendiri.
