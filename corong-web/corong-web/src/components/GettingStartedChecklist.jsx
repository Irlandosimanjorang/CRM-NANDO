import { useState, useEffect } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import * as db from "../lib/db";

// Checklist onboarding di Dashboard - sebelumnya user baru cuma diarahin
// pilih industri (IndustryPicker), abis itu langsung diliatin dashboard
// KOSONG tanpa tuntunan lanjutan sama sekali (audit 9 Sep 2026, referensi
// pola umum CRM lain kayak HubSpot/Pipedrive yang selalu punya checklist
// "getting started" pas akun masih baru). Ilang otomatis begitu semua
// item kelar ATAU udah punya >=5 lead (dianggap gak "baru" lagi), dan bisa
// di-dismiss manual - status dismiss disimpen per browser (localStorage),
// bukan per akun, jadi cuma buat convenience bukan sumber kebenaran.
const DISMISS_KEY = "nexto_onboarding_dismissed";

export default function GettingStartedChecklist({ leads, myLevel, onGo }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch (_) { return false; }
  });
  const [telegramLinked, setTelegramLinked] = useState(null);
  const [calendarLinked, setCalendarLinked] = useState(null);
  const [teamCount, setTeamCount] = useState(null);

  const leadCount = leads?.length ?? 0;
  const showAtAll = !dismissed && leadCount < 5;

  useEffect(() => {
    if (!showAtAll) return;
    db.getTelegramLink().then((row) => setTelegramLinked(!!row)).catch(() => setTelegramLinked(false));
    if (myLevel >= 2) {
      db.getOrgMembers().then((rows) => setTeamCount(rows.length)).catch(() => setTeamCount(1));
      db.getGoogleCalendarLink().then((row) => setCalendarLinked(!!row)).catch(() => setCalendarLinked(false));
    }
  }, [showAtAll, myLevel]);

  if (!showAtAll) return null;

  const items = [
    { key: "industry", label: "Pilih industri bisnis", done: true },
    { key: "lead", label: "Tambah lead pertama", done: leadCount > 0, action: () => onGo?.("leads") },
  ];
  if (myLevel >= 2) {
    items.push({ key: "telegram", label: "Hubungkan Bot Telegram", done: telegramLinked === true, action: () => onGo?.("settings") });
    if (teamCount !== null) {
      items.push({ key: "team", label: "Undang anggota tim", done: teamCount > 1, action: () => onGo?.("settings") });
    }
    if (calendarLinked !== null) {
      items.push({ key: "calendar", label: "Hubungkan Google Calendar", done: calendarLinked === true, action: () => onGo?.("settings") });
    }
  }

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;
  const pct = Math.round((doneCount / items.length) * 100);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch (_) {}
    setDismissed(true);
  };

  return (
    <div className="relative rounded-3xl border border-orange-200 bg-orange-50/60 p-5">
      <button onClick={dismiss} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600" aria-label="Tutup checklist">
        <X size={16} />
      </button>
      <div className="flex items-center justify-between pr-6">
        <div className="text-sm font-bold text-slate-800">Mulai di sini</div>
        <div className="text-[11px] font-semibold text-orange-600">{doneCount}/{items.length} selesai</div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
        <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.action}
            disabled={item.done || !item.action}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition ${
              item.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-slate-800"
            }`}
          >
            {item.done ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
            ) : (
              <Circle size={15} className="shrink-0 text-slate-300" />
            )}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
