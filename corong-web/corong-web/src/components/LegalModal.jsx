import { X, MessageCircle } from "lucide-react";

// === LEGAL PAGES (5 Sep 2026, direvisi 5 Sep 2026) ===
// Terms of Service & Privacy Policy - ditulis spesifik buat model bisnis
// Nexto beneran (bukan template generik): SaaS berlangganan 4 tier
// (Free/Standard/Professional/Enterprise), pembayaran via Mayar, DAN yang
// paling penting - Privacy Policy-nya secara eksplisit ngungkapin bahwa
// data CRM (nama lead, progress notes, dst) dikirim ke Anthropic (Claude)
// & OpenAI buat fitur-fitur AI. Ini WAJIB diungkapin secara jujur, bukan
// disembunyiin - user berhak tau data mereka diproses AI pihak ketiga.
//
// === REVISI (5 Sep 2026) - 3 celah yang disebut di komentar lama udah
// ditambal SEBISA yang bisa ditulis tanpa jadi pengacara beneran: ===
// 1. Refund - sekarang ada pengecualian eksplisit (double-charge, gagal
//    total sistem), bukan cuma "non-refundable" polos.
// 2. Force Majeure - section baru ditambahin di ToS.
// 3. UU PDP (UU No. 27/2022) - Privacy Policy sekarang eksplisit nyebut
//    dasar hukum pemrosesan, hak-hak subjek data SESUAI UU PDP (termasuk
//    hak komplain ke otoritas), transfer data lintas negara (server AI/
//    hosting ada di luar Indonesia), kewajiban notifikasi insiden data,
//    dan identitas pengendali data.
//
// PENTING - INI TETEP BUKAN PENGGANTI REVIEW PENGACARA/NOTARIS BENERAN.
// Terutama: (a) identitas "Pengendali Data" di bawah masih perorangan
// (Nando/Irlando Simanjorang) karena belum ada badan hukum (PT/CV) -
// WAJIB diupdate begitu badan hukum resmi berdiri; (b) klausul force
// majeure & yurisdiksi sengketa ini masih generik, idealnya direview buat
// disesuaikan sama kondisi bisnis riil; (c) kalau omzet udah signifikan,
// segera daftar PSE Lingkup Privat ke Komdigi (via OSS) - ini kewajiban
// legal terpisah dari isi dokumen ini, gak cukup cuma nulis ToS/Privacy.

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-[13px] font-bold text-slate-900 mb-2">{title}</h3>
      <div className="text-[12px] leading-6 text-slate-600 space-y-2">{children}</div>
    </div>
  );
}

function TosContent() {
  return (
    <>
      <p className="text-[11px] text-slate-400 mb-5">Terakhir diperbarui: 5 September 2026</p>

      <Section title="1. Penerimaan Ketentuan">
        <p>Dengan mendaftar dan menggunakan Nexto ("Layanan"), kamu setuju terikat dengan Ketentuan Layanan ini. Kalau kamu tidak setuju, mohon untuk tidak menggunakan Layanan.</p>
      </Section>

      <Section title="2. Deskripsi Layanan">
        <p>Nexto adalah aplikasi Customer Relationship Management (CRM) berbasis cloud yang dilengkapi fitur kecerdasan buatan (AI) untuk membantu tim sales mengelola leads, deal, jadwal kunjungan, dan komunikasi pelanggan. Layanan tersedia dalam beberapa paket berlangganan: Free, Standard, Professional, dan Enterprise, dengan fitur yang berbeda-beda di tiap paket.</p>
      </Section>

      <Section title="3. Akun Pengguna">
        <p>Kamu bertanggung jawab menjaga kerahasiaan kredensial akun (email, password, dan kode 2FA jika diaktifkan). Nexto tidak bertanggung jawab atas kerugian akibat akses tidak sah ke akunmu yang disebabkan kelalaian menjaga kredensial tersebut.</p>
        <p>Kamu wajib memberikan informasi yang akurat saat mendaftar dan menjaga informasi tersebut tetap terkini.</p>
      </Section>

      <Section title="4. Paket Berlangganan & Pembayaran">
        <p>Paket Free dapat digunakan tanpa batas waktu dengan fitur terbatas. Paket berbayar (Standard, Professional, Enterprise) ditagih bulanan melalui mitra pembayaran pihak ketiga (Mayar).</p>
        <p>Perpanjangan langganan bersifat otomatis kecuali dibatalkan sebelum periode tagihan berikutnya. Kamu dapat membatalkan atau upgrade/downgrade paket kapan saja melalui tab Pengaturan.</p>
        <p>Sebagai aturan umum, pembayaran yang sudah dilakukan tidak dapat dikembalikan (non-refundable), termasuk untuk sisa periode berlangganan yang belum terpakai setelah pembatalan. Pengecualian: kami akan memberikan pengembalian dana penuh atau sebagian jika (a) kamu tertagih lebih dari satu kali untuk periode langganan yang sama akibat kesalahan sistem/pembayaran (double-charge), atau (b) Layanan berbayar yang kamu langgan tidak dapat diakses sama sekali (bukan gangguan sebagian/sementara) selama lebih dari 72 jam berturut-turut akibat kesalahan pada sisi kami. Permintaan pengembalian dana diajukan melalui WhatsApp support paling lambat 14 hari sejak kejadian.</p>
        <p>Harga dapat berubah sewaktu-waktu dengan pemberitahuan wajar (minimal 14 hari sebelumnya) sebelum perubahan berlaku bagi pelanggan aktif. Perubahan harga tidak berlaku surut untuk periode yang sudah dibayar.</p>
      </Section>

      <Section title="5. Fitur Kecerdasan Buatan (AI)">
        <p>Nexto menyediakan fitur berbasis AI (analisis lead, draft pesan follow-up, rekomendasi harian, asisten chat, dan sejenisnya) yang memproses data yang kamu masukkan ke dalam sistem. Rekomendasi dan konten yang dihasilkan AI bersifat <b>bantuan pengambilan keputusan</b>, bukan nasihat profesional (hukum, keuangan, atau bisnis) dan bisa saja tidak akurat.</p>
        <p>Kamu tetap bertanggung jawab penuh atas keputusan bisnis dan komunikasi yang dikirim ke pelanggan/lead kamu, termasuk yang dibantu disusun oleh AI.</p>
      </Section>

      <Section title="6. Kepemilikan Data">
        <p>Semua data yang kamu masukkan ke Nexto (data lead, catatan progress, data kompetitor, dsb.) tetap menjadi milikmu. Nexto tidak mengklaim kepemilikan atas data tersebut dan tidak menjual data kamu ke pihak ketiga manapun.</p>
      </Section>

      <Section title="7. Penggunaan yang Dilarang">
        <p>Kamu setuju untuk tidak: (a) menggunakan Layanan untuk aktivitas ilegal; (b) mencoba mengakses sistem atau data milik pengguna lain tanpa izin; (c) melakukan reverse engineering, scraping otomatis, atau membebani sistem secara berlebihan (abuse); (d) menggunakan fitur AI untuk menghasilkan konten yang menyesatkan, melecehkan, atau melanggar hukum.</p>
      </Section>

      <Section title="8. Batasan Tanggung Jawab">
        <p>Layanan disediakan "sebagaimana adanya" (as is). Nexto berupaya menjaga ketersediaan dan keakuratan Layanan, namun tidak menjamin Layanan bebas dari gangguan, error, atau kehilangan data. Nexto tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau kehilangan peluang bisnis akibat penggunaan (atau ketidaktersediaan) Layanan.</p>
      </Section>

      <Section title="9. Force Majeure">
        <p>Nexto tidak bertanggung jawab atas keterlambatan atau kegagalan menjalankan kewajiban dalam Ketentuan ini yang disebabkan oleh keadaan di luar kendali wajar kami, termasuk namun tidak terbatas pada: bencana alam, kebakaran, gangguan/pemadaman internet atau listrik berskala luas, perang, kerusuhan, pandemi, perubahan regulasi pemerintah, serta gangguan atau penghentian layanan dari penyedia infrastruktur pihak ketiga yang kami gunakan (termasuk namun tidak terbatas pada Supabase, Vercel, Anthropic, OpenAI, Mayar, atau Telegram) yang berada di luar kendali kami.</p>
      </Section>

      <Section title="10. Penghentian Layanan">
        <p>Kamu dapat menghentikan penggunaan Layanan kapan saja. Nexto berhak menangguhkan atau menghentikan akun yang melanggar Ketentuan Layanan ini, dengan pemberitahuan bila memungkinkan.</p>
      </Section>

      <Section title="11. Perubahan Ketentuan">
        <p>Ketentuan ini dapat diperbarui dari waktu ke waktu. Perubahan material akan diberitahukan melalui email atau notifikasi dalam aplikasi. Penggunaan Layanan setelah perubahan berlaku dianggap sebagai persetujuan atas ketentuan yang diperbarui.</p>
      </Section>

      <Section title="12. Hukum yang Berlaku & Penyelesaian Sengketa">
        <p>Ketentuan ini diatur dan ditafsirkan sesuai hukum Republik Indonesia. Setiap perselisihan yang timbul dari penggunaan Layanan akan diupayakan diselesaikan terlebih dahulu secara musyawarah untuk mufakat antara kamu dan Nexto. Apabila tidak tercapai kesepakatan dalam waktu 30 hari, perselisihan akan diselesaikan melalui Pengadilan Negeri sesuai domisili hukum penyelenggara Layanan di Indonesia.</p>
      </Section>

      <Section title="13. Kontak">
        <p>Pertanyaan mengenai Ketentuan Layanan ini dapat disampaikan melalui WhatsApp support Nexto (lihat tombol di bawah).</p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <p className="text-[11px] text-slate-400 mb-5">Terakhir diperbarui: 5 September 2026</p>

      <Section title="1. Data yang Kami Kumpulkan">
        <p><b>Data akun:</b> email, nama, jabatan, foto profil.</p>
        <p><b>Data CRM yang kamu input:</b> nama lead/perusahaan, kontak, catatan progress, data deal, data kompetitor.</p>
        <p><b>Data lokasi:</b> koordinat GPS, hanya jika kamu secara aktif menggunakan fitur check-in kunjungan.</p>
        <p><b>Data audio:</b> rekaman suara, hanya jika kamu menggunakan fitur voice note atau rekam meeting (diproses untuk transkripsi, tidak disimpan permanen dalam bentuk audio kecuali kamu simpan sendiri).</p>
        <p><b>Data Telegram:</b> jika kamu menghubungkan akun Telegram, kami menyimpan chat ID dan riwayat percakapan dengan asisten AI untuk keperluan fungsi bot.</p>
      </Section>

      <Section title="2. Bagaimana Data Digunakan">
        <p>Data kamu digunakan untuk: menyediakan fungsi inti CRM, menjalankan fitur AI (analisis, draft pesan, rekomendasi), mengirim notifikasi/email terkait akun, dan meningkatkan keandalan Layanan.</p>
      </Section>

      <Section title="3. Dasar Hukum Pemrosesan Data">
        <p>Sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi ("UU PDP"), kami memproses data pribadimu berdasarkan: (a) <b>persetujuanmu</b> saat mendaftar dan menyetujui Kebijakan Privasi ini; (b) <b>pelaksanaan kontrak</b> layanan berlangganan antara kamu dan Nexto; dan (c) <b>kepentingan sah</b> kami untuk menjaga keamanan sistem dan mencegah penyalahgunaan Layanan.</p>
      </Section>

      <Section title="4. Pemrosesan oleh AI Pihak Ketiga (Penting)">
        <p>Untuk menjalankan fitur AI, sebagian data CRM kamu (nama lead, catatan progress, konteks bisnis relevan) dikirim ke penyedia model AI pihak ketiga: <b>Anthropic (Claude)</b> dan <b>OpenAI</b> (untuk transkripsi suara dan embedding pencarian semantik). Data ini diproses sesuai kebijakan privasi masing-masing penyedia dan tidak digunakan oleh mereka untuk melatih model AI mereka berdasarkan perjanjian API komersial standar.</p>
        <p>Kami hanya mengirim data yang relevan untuk menghasilkan output yang diminta (misalnya draft follow-up untuk satu lead), bukan seluruh database kamu sekaligus.</p>
      </Section>

      <Section title="5. Layanan Pihak Ketiga Lain">
        <p>Kami menggunakan penyedia infrastruktur berikut yang turut memproses data kamu: <b>Supabase</b> (database & autentikasi), <b>Vercel</b> (hosting), <b>Resend</b> (pengiriman email), <b>Mayar</b> (pemrosesan pembayaran), <b>Telegram</b> (jika kamu menghubungkan bot), dan <b>Google Calendar</b> (jika kamu mengaktifkan sinkronisasi kalender, memerlukan izin OAuth terpisah dari kamu).</p>
      </Section>

      <Section title="6. Transfer Data ke Luar Negeri">
        <p>Sebagian penyedia layanan pada Bagian 4 dan 5 (termasuk Anthropic, OpenAI, Supabase, dan Vercel) memproses dan/atau menyimpan data pada server yang berlokasi di luar wilayah Indonesia (Amerika Serikat dan/atau negara lain). Dengan menggunakan Layanan, kamu memahami dan menyetujui bahwa data pribadimu dapat ditransfer dan diproses di luar Indonesia. Kami hanya bekerja sama dengan penyedia yang memiliki kebijakan privasi dan standar keamanan data yang memadai untuk perjanjian pemrosesan data komersial.</p>
      </Section>

      <Section title="7. Keamanan Data">
        <p>Kami menerapkan Row Level Security (RLS) sehingga data organisasimu terisolasi dari organisasi lain, autentikasi dua faktor (2FA) opsional, dan pencatatan audit log untuk aktivitas sensitif (hapus/ubah data penting). Namun, tidak ada sistem yang 100% bebas risiko - kamu tetap disarankan menjaga kerahasiaan kredensial akun.</p>
      </Section>

      <Section title="8. Pemberitahuan Insiden Keamanan Data">
        <p>Apabila terjadi insiden yang mengakibatkan kegagalan pelindungan data pribadimu (kebocoran data), kami akan menyampaikan pemberitahuan tertulis kepadamu selambat-lambatnya 3x24 jam sejak insiden diketahui, sesuai dengan yang diamanatkan UU PDP, termasuk sifat insiden dan langkah mitigasi yang kami lakukan. Kami juga akan melaporkan insiden tersebut kepada otoritas pengawas Pelindungan Data Pribadi sesuai ketentuan yang berlaku.</p>
      </Section>

      <Section title="9. Hak Kamu Atas Data">
        <p>Sesuai UU PDP, kamu berhak: (a) mengakses dan mendapatkan salinan data kamu (fitur export tersedia di tab Pengaturan); (b) meminta koreksi data yang tidak akurat atau tidak lengkap; (c) meminta penghapusan dan/atau pemusnahan data pribadimu (hubungi support); (d) menarik kembali persetujuan yang pernah diberikan; (e) mengajukan keberatan atas keputusan yang semata-mata didasarkan pada pemrosesan otomatis (termasuk rekomendasi AI) yang menimbulkan akibat hukum atau berdampak signifikan bagimu; (f) menggugat dan menerima ganti rugi atas pelanggaran pemrosesan data pribadimu sesuai ketentuan perundang-undangan; dan (g) mengajukan pengaduan kepada otoritas pengawas Pelindungan Data Pribadi yang berwenang di Indonesia. Beberapa data dapat kami simpan lebih lama jika diwajibkan hukum (misalnya catatan transaksi pembayaran).</p>
      </Section>

      <Section title="10. Retensi Data">
        <p>Data disimpan selama akunmu aktif. Data yang dihapus (lead, kompetitor) masuk ke recycle bin untuk periode tertentu sebelum terhapus permanen. Jika akun dihentikan/dihapus, data akan dihapus dari sistem produksi dalam waktu wajar, kecuali disyaratkan hukum untuk disimpan lebih lama.</p>
      </Section>

      <Section title="11. Cookie & Local Storage">
        <p>Kami menggunakan penyimpanan lokal browser (local storage) untuk menyimpan preferensi tampilan dan status sesi - bukan untuk melacak aktivitas kamu di situs lain atau untuk periklanan.</p>
      </Section>

      <Section title="12. Anak di Bawah Umur">
        <p>Layanan ini ditujukan untuk penggunaan bisnis oleh individu berusia 18 tahun ke atas. Kami tidak secara sadar mengumpulkan data dari anak di bawah umur.</p>
      </Section>

      <Section title="13. Identitas Pengendali Data">
        <p>Pengendali data pribadi (Data Controller) untuk Layanan ini adalah penyelenggara Nexto, yang dapat dihubungi melalui kontak pada Bagian 14 di bawah untuk segala pertanyaan atau permohonan terkait data pribadimu sebagaimana diatur UU PDP.</p>
      </Section>

      <Section title="14. Perubahan Kebijakan">
        <p>Kebijakan Privasi ini dapat diperbarui dari waktu ke waktu. Perubahan material akan diberitahukan melalui email atau notifikasi dalam aplikasi.</p>
      </Section>

      <Section title="15. Kontak">
        <p>Pertanyaan mengenai privasi dan data kamu, termasuk permohonan terkait hak-hak pada Bagian 9, dapat disampaikan melalui WhatsApp support Nexto (lihat tombol di bawah).</p>
      </Section>
    </>
  );
}

export default function LegalModal({ type, onClose, supportWaNumber }) {
  const isTos = type === "tos";

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between rounded-t-[28px] border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-[16px] font-bold text-slate-900">{isTos ? "Ketentuan Layanan" : "Kebijakan Privasi"}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {isTos ? <TosContent /> : <PrivacyContent />}
        </div>

        <div className="rounded-b-[28px] border-t border-slate-100 bg-slate-50 px-6 py-4">
          <a
            href={`https://wa.me/${supportWaNumber}?text=${encodeURIComponent(`Halo, saya ada pertanyaan soal ${isTos ? "Ketentuan Layanan" : "Kebijakan Privasi"} Nexto.`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <MessageCircle size={14} />
            Ada pertanyaan? Chat support di WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
