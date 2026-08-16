# Corong — Web App (React + Supabase)

Migrasi Corong dari prototype browser-local ke web app beneran dengan database cloud (Supabase),
auth per-user, dan data yang aman (ga hilang lagi kalau cache kebersihan).

**Semua tab sudah jadi:** Dashboard, Leads (+ import Excel/CSV), Deal, Visit (+ tambah visit),
Kompetitor, Follow-up, AI Advisor (via Supabase Edge Function), Pengaturan (nama sales + tahap pipeline).

---

## 1. Bikin project Supabase
1. Daftar di https://supabase.com → **New project**.
2. Tunggu project selesai dibuat.

## 2. Bikin tabel
1. Buka **SQL Editor** → **New query**.
2. Copy seluruh isi `schema.sql`, paste, klik **Run** → pilih **"Run and enable RLS"**.

## 3. Ambil kunci API
Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.

Sekalian matikan **Authentication → Providers → Email → Confirm email** biar bisa langsung login
tanpa verifikasi (opsional, buat kecepatan testing).

## 4. Deploy AI Advisor (Edge Function) — biar API key aman + bisa dijadwalkan
AI Advisor manggil Claude API. Supaya API key-nya **ga nempel di browser** (aman), panggilannya
lewat Supabase Edge Function.

```bash
npm install -g supabase          # sekali saja
supabase login
supabase link --project-ref xxxxxxxx   # Project ID, ada di Project Settings → General
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
supabase functions deploy ai-advisor
```

Kalau langkah ini dilewati, tab AI Advisor akan menampilkan pesan error saat diklik "Jalankan
analisis" — tab lain tetap berfungsi normal.

> Mau dijadwalkan otomatis (tiap pagi tanpa buka app)? Supabase punya **Cron** (Database → Cron
> Jobs) yang bisa memanggil Edge Function ini terjadwal. Bisa disiapkan di fase berikutnya.

## 5. Jalanin di komputer (opsional, buat development)
```bash
npm install
cp .env.example .env
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev
```

## 6. Deploy ke Vercel (biar bisa dibuka dari HP, online 24 jam)
1. Push folder ini ke GitHub (bikin repo baru, upload semua file kecuali `node_modules`).
2. Buka https://vercel.com → **Add New → Project** → import repo tadi.
3. Di **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL` = Project URL kamu
   - `VITE_SUPABASE_ANON_KEY` = anon key kamu
4. Klik **Deploy**. Tunggu ~1 menit → dapat link `https://nama-project.vercel.app`.
5. Buka link itu di HP atau laptop mana saja → daftar akun → mulai pakai.

Setiap kali ada update kode, cukup push ke GitHub lagi — Vercel auto re-deploy.

---

## Pindahin data dari prototype (364 lead kamu)
Import ulang file Excel kamu lewat tombol **Import Excel / CSV** di tab Leads — importer-nya
sudah dibawa ke sini (dukung header Mandarin/Inggris/Indonesia).

---

## Struktur
```
schema.sql                       # skema database Supabase (jalankan sekali)
supabase/functions/ai-advisor/   # Edge Function AI Advisor (deploy manual)
src/lib/supabaseClient.js        # koneksi Supabase
src/lib/db.js                    # data layer (semua query CRUD)
src/lib/helpers.js               # util (format, mapping, dll)
src/Auth.jsx                     # login/daftar
src/App.jsx                      # shell + navigasi + load data
src/tabs/                        # Dashboard, Leads, Deal, Visit, Kompetitor, Followup, Advisor, Settings
src/components/                  # LeadModal, CompetitorModal
```

## Fase berikutnya
- **Telegram bot**: Edge Function baru yang menerima webhook Telegram → parser bahasa natural
  (logikanya sama seperti "Perintah cepat" di prototype) → tulis ke tabel `leads` yang sama.
- **AI Advisor terjadwal**: Supabase Cron Job memanggil `ai-advisor` tiap pagi otomatis.
- Deteksi & merge lead duplikat (opsional, buat kerapian data).
