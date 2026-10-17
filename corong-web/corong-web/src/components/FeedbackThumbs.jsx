import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import * as db from "../lib/db";

// Tombol jempol like / dislike untuk hasil AI (digest, draft follow-up, ringkasan kebutuhan, dll).
// feature: nama fitur (mis. "advisor", "draft-followup"); refKey: ID unik hasil itu (mis. "2026-10-17:<lead_id>").
// Penilaian disimpan per user, jadi tiap user melatih AI untuk dirinya sendiri.
export default function FeedbackThumbs({ feature, refKey, snapshot = null, className = "" }) {
  const [rating, setRating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    db.getMyAiRating(feature, refKey).then((r) => alive && setRating(r)).catch(() => {});
    return () => { alive = false; };
  }, [feature, refKey]);

  const pick = async (value) => {
    if (busy || rating === value) return;
    setBusy(true); setErr("");
    try {
      await db.setAiRating(feature, refKey, value, snapshot);
      setRating(value);
    } catch (e) {
      setErr(e.message || "Gagal menyimpan penilaian");
    } finally { setBusy(false); }
  };

  const base = "inline-flex items-center justify-center rounded-lg p-1.5 transition-colors disabled:opacity-50";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => pick(1)}
        disabled={busy}
        aria-pressed={rating === 1}
        aria-label="Membantu"
        title="Membantu"
        className={`${base} ${rating === 1 ? "bg-emerald-50 text-emerald-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => pick(-1)}
        disabled={busy}
        aria-pressed={rating === -1}
        aria-label="Tidak membantu"
        title="Tidak membantu"
        className={`${base} ${rating === -1 ? "bg-rose-50 text-rose-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
      >
        <ThumbsDown size={14} />
      </button>
      {err && <span className="text-[10.5px] text-rose-600">{err}</span>}
    </span>
  );
}
