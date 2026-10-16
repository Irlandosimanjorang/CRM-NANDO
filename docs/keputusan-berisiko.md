# Keputusan berisiko yang harus dipantau

Dicatat 16 Okt 2026. Setiap item di bawah ini sengaja dibuat begitu. Jangan diubah tanpa membaca alasannya.

## 1. Cron daily-digest memakai anon JWT
- Job cron `corong-daily-digest` (jam 01:00 UTC) mengirim header `x-cron-secret` **dan** `Authorization: Bearer <anon key>`.
- Alasan: edge function `daily-digest` sekarang `verify_jwt = true`. Tanpa header Authorization, gateway menolak panggilan sebelum sampai ke kode.
- Kalau mengubah cron atau `verify_jwt`, cek dulu kedua hal ini bersama-sama.

## 2. Function yang dipanggil dari browser memakai verify_jwt = true
- `draft-followup`, `summarize-lead-needs`, `generate-leads`, `product-doc-extract`, `send-lead-email`, `admin-*`, dan lainnya.
- Function yang dijaga secret di dalam kode (`x-cron-secret`, `x-webhook-secret`) boleh `verify_jwt = false`.

## 3. Aturan izin yang sering diubah
- `ad_expenses` dan `ad_budgets`: marketing boleh mengisi miliknya sendiri, owner dan manager boleh semua. (Sempat dibuat hanya manager lalu dikembalikan.)
- `rencana`: hanya pemilik yang boleh menulis. Owner dan manager hanya melihat.
- `redeem_invite_code`: kode sekali pakai (`used_by` dicatat).
- `ad_expenses`, `ad_budgets`, `rencana`: jika ada perubahan izin lagi, catat di sini dan di migrasi.

## 4. Edge function yang belum punya sumber di repo
Function ini aktif di produksi tapi kodenya belum ada di repo: `track-visit`, `content-drafter`, `content-action`, `admin-trigger`, `sync-calendar-bulk`, `proactive-check`, `mcp-server`, `telegram-webhook`, `weekly-garbage-sweep`, `google-oauth-callback`. Sumbernya bisa ditarik dengan `get_edge_function`. Sampai dipindahkan, perubahan pada function ini hanya lewat deploy langsung.

## 5. Function stub yang sudah mati
- `proactive-check`, `content-drafter`, `telegram-webhook` hanya membalas 410. Hapus dari dashboard Supabase (MCP tidak bisa menghapus function).

## 6. Keamanan yang belum selesai
- Proteksi password yang bocor (Supabase Auth) belum aktif. Aktifkan di dashboard.
- `increment_share_count` bisa dipanggil akun login, dibatasi sekali per akun per post.
- Fungsi `SECURITY DEFINER` yang bisa dipanggil akun login sengaja dibiarkan karena dipakai aplikasi atau policy RLS.

## 7. Revenue dihitung di dua tempat
- Team (leaderboard, org dengan `project_deal`): jumlah `deal_value` lead di tahap menang.
- Report (Penjualan, Rekap): jumlah transaksi deal dan lead menang.
- Sudah disatukan untuk org `project_deal` (16 Okt 2026): omzet Team dan Report = nilai proyek lead di tahap menang. Transaksi deal tidak dipakai untuk omzet di org itu.
- Dashboard masih membaca transaksi deal (jumlah deal dan grafik). Belum diubah.
