# Hardening integrasi Nexto ↔ Journey

Dokumen ini mencatat kondisi integrasi antara project **CRM Nexto** (`cewggulyfshnbebcpyui`) dan **journey-order** (`dxorkakfzxxlumvyacdd`), serta langkah untuk mencabut akses `anon` dari function `journey_*` di Nexto.

## Peta panggilan

| Arah | Pengirim | Penerima (function) | Kunci yang dipakai | Role HTTP |
|---|---|---|---|---|
| Nexto → Journey | trigger `sync_proyek_deal_to_journey` | `nexto_upsert_order_journey` | `journey_sync_secret` + publishable key Journey | anon |
| Nexto → Journey | trigger `sync_drawing_ke_journey` | `nexto_set_drawing` | `journey_sync_secret` + publishable key Journey | anon |
| Journey → Nexto | trigger `kirim_dp_ke_nexto` (Journey) | `journey_tandai_dp` (Nexto) | `nexto_sync_secret` + kunci Nexto | **anon (sekarang)** |
| Journey → Nexto | (belum terverifikasi, kemungkinan frontend Journey) | `journey_terima_so`, `journey_set_spk_diterima` | `journey_so_secret` | authenticated / anon |

Secret dirotasi pada 2026-11-09 dan disimpan di Vault kedua project. Nilai secret tidak boleh masuk repo.

## Status

- [x] Secret `journey_so_secret` dan `journey_sync_secret` / `nexto_sync_secret` dirotasi dan diverifikasi.
- [x] `so_secret_untuk_nexto()` di Journey: grant `authenticated` tetap (dipakai frontend, belum bisa dipastikan).
- [x] `kirim_dp_ke_nexto()` di Journey: mendukung kunci `nexto_service_key`, dengan fallback ke publishable key.
- [ ] Simpan **service_role key Nexto** ke Vault Journey dengan nama `nexto_service_key`.
- [ ] Verifikasi sinkronisasi DP berjalan (cek `net._http_response` di Journey, status 2xx).
- [ ] Cabut `anon` dari `journey_set_spk_diterima`, `journey_tandai_dp`, `journey_terima_so` di Nexto.
- [ ] Cek frontend Journey: apakah memanggil function di atas. Jika ya, pastikan memakai JWT user (authenticated), bukan anon.

## Langkah pencabutan anon (setelah checklist di atas)

1. Di dashboard **journey-order**, buka Vault dan tambahkan secret `nexto_service_key` berisi service_role key project CRM Nexto. Jangan menempelkan nilai ini ke chat atau repo.
2. Di Journey, jalankan pemicu uji (ubah jenis penjualan lead DP di Nexto, atau panggil ulang trigger), lalu cek:
   ```sql
   select status_code, created, content
   from net._http_response
   order by created desc
   limit 5;
   ```
   Pastikan status 2xx dan `journey_tandai_dp` berhasil mengunci jenis penjualan di Nexto.
3. Di Nexto, cabut anon (cek dulu bahwa `service_role` masih punya EXECUTE):
   ```sql
   revoke execute on function public.journey_tandai_dp(text, text) from anon;
   revoke execute on function public.journey_set_spk_diterima(text, uuid, boolean) from anon;
   revoke execute on function public.journey_terima_so(text, uuid, text, text) from anon;
   ```
4. Uji ulang alur staff di Journey: DP, buka SPK, dan terima SO. Jika salah satu gagal, kembalikan grant dengan `grant execute ... to anon;`.
5. Setelah stabil, hapus fallback ke publishable key di `kirim_dp_ke_nexto`.

## Langkah lanjutan (opsional)

- `nexto_upsert_order_journey` dan `nexto_set_drawing` di Journey juga bisa diberi `anon` dicabut, dengan memindahkan trigger Nexto (`sync_proyek_deal_to_journey`, `sync_drawing_ke_journey`) ke service key Journey. Ini butuh service_role key Journey di Vault Nexto.
- Pertimbangkan memindahkan integrasi ke Edge Function dengan verifikasi HMAC, supaya secret tidak perlu berada di body request.
