import { useEffect, useState } from "react";
import { getCheckinPhotoUrl } from "../lib/db";

// Foto check-in dari bucket privat. Mengambil link sementara dulu, lalu menampilkannya.
export default function CheckinPhoto({ value, className = "", alt = "" }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!value) { setSrc(null); return undefined; }
    getCheckinPhotoUrl(value).then((u) => { if (alive) setSrc(u); }).catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value]);
  if (!src) return <div className={`${className} bg-slate-200 animate-pulse`} aria-hidden="true" />;
  return <img src={src} alt={alt} className={className} />;
}
