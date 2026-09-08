// Dipisah dari index.html (dulu inline <script>) - CSP script-src cuma
// izinin 'self' (gak ada 'unsafe-inline'), jadi script INLINE bakal keblokir
// begitu header CSP beneran aktif. File eksternal kayak gini tetep dianggap
// "self" (satu origin sama halamannya), jadi aman lolos CSP tanpa perlu
// ngelemahin policy-nya pake 'unsafe-inline'.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
