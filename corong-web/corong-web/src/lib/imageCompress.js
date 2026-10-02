// Kompres foto sebelum diunggah (2 Okt 2026, audit kamera/foto). Foto dari
// kamera bawaan HP bisa 5-10 MB (12 MP) - lambat diunggah di sinyal lapangan
// dan bisa melewati batas bucket (8 MB check-in/komunitas, 5 MB avatar).
// Di sini sisi terpanjang diperkecil dan disimpan ulang sebagai JPEG.
//
// File dibaca lewat FileReader (data: URL), bukan blob: URL, supaya tetap
// aman terhadap CSP img-src production.
const SKIP_TYPES = ["image/gif"]; // GIF animasi dibiarkan apa adanya

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImage(file, { maxSide = 1600, quality = 0.85 } = {}) {
  if (!file || SKIP_TYPES.includes(file.type)) return file;
  let img;
  try {
    img = await loadImage(await readAsDataUrl(file));
  } catch (_) {
    if (/hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "")) {
      throw new Error("Foto HEIC (format bawaan iPhone) belum didukung di perangkat ini. Gunakan foto JPG atau PNG.");
    }
    throw new Error("Foto tidak dapat dibaca. Gunakan foto JPG atau PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  // Sudah kecil & sudah JPEG: tidak perlu diproses ulang.
  if (scale === 1 && file.type === "image/jpeg" && file.size <= 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // PNG transparan -> latar putih di JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;
  // Kalau hasilnya justru lebih besar (jarang), pakai file asli.
  if (blob.size >= file.size && file.type === "image/jpeg") return file;
  const base = (file.name || "foto").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
