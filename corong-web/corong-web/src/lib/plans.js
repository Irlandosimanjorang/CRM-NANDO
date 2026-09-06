// Satu-satunya sumber kebenaran buat link pembayaran Mayar & mapping tier/plan.
// Sebelum ini, konstanta yang sama didefinisikan sendiri-sendiri di App.jsx
// dan Settings.jsx - pernah kejadian nilainya beda-beda dan bikin bug (link
// Mayar basi di satu file, up-to-date di file lain). Jangan duplikat lagi -
// import dari sini.
//
// AWAS: slug di URL ini ikut berubah kalau nama produknya diganti di Mayar
// Dashboard (udah kejadian sekali - link lama /m/premium-12306 jadi 404
// gara-gara produknya di-rename jadi "NEXTO CRM - AI Sales Operating
// System"). Kalau nanti nama produk di Mayar diganti LAGI, link ini WAJIB
// diupdate manual di sini, kalau enggak tombol "Bayar" di seluruh app bakal
// ngarahin ke halaman 404.
export const MAYAR_PAYMENT_LINK = "https://crmnexto.myr.id/m/nexto-crm-ai-sales-operating-system";

export const TIER_LABEL = { standard: "Standard", premium: "Professional", enterprise: "Enterprise" };

export const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
