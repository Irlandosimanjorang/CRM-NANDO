// Logika murni alert harian owner (tanpa AI, tanpa akses database) supaya mudah diuji.
// Batas yang bisa diubah ada di CONFIG.
export const CONFIG = {
  HIGH_VALUE: 50_000_000, // lead bernilai >= ini dianggap high-value
  FOLLOWUP_HOURS: 24, // high-value belum disentuh lebih dari ini = alert
  CHAT_WAIT_HOURS: 2, // chat masuk belum dibalas lebih dari ini = alert
  STUCK_DAYS: 14, // lead aktif tanpa progress lebih dari ini = stuck
  STUCK_MIN_PER_MEMBER: 3, // alert stuck baru muncul bila satu marketing punya sedikitnya segini
};

export type Lead = { id: string; name: string; stage_key: string; deal_value: number | null; last_contact: string | null; created_at: string; assigned_to: string | null; user_id: string | null };
export type Conv = { lead_id: string; platform: string; campaign: string; last_inbound_at: string | null; last_outbound_at: string | null };

export type Alert = { tone: "red" | "amber" | "green"; title: string; items: string[] };

const rp = (n: number) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const hoursSince = (iso: string | null, now: number) => (iso ? (now - new Date(iso).getTime()) / 3600000 : Infinity);

export function buildAlerts(input: {
  now: number;
  leads: Lead[];
  activeKeys: Set<string>; // tahap bertipe normal (belum menang/kalah)
  lastNote: Map<string, string>; // lead_id -> waktu catatan terakhir
  convs: Conv[];
  names: Map<string, string>; // user_id -> nama
  targets: { user_id: string; amount: number }[];
  achieved: Map<string, number>; // user_id -> omzet bulan ini
}): Alert[] {
  const { now, leads, activeKeys, lastNote, convs, names, targets, achieved } = input;
  const nameOf = (id: string | null) => (id && names.get(id)) || "Belum dibagi";
  const active = leads.filter((l) => activeKeys.has(l.stage_key));
  const touch = (l: Lead) => {
    const t = [lastNote.get(l.id), l.last_contact ? `${l.last_contact}T00:00:00+07:00` : null, l.created_at].filter(Boolean) as string[];
    return t.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  };
  const out: Alert[] = [];

  // 1. Chat masuk belum dibalas
  const byId = new Map(leads.map((l) => [l.id, l]));
  const waiting = convs
    .filter((c) => c.last_inbound_at && (!c.last_outbound_at || new Date(c.last_inbound_at) > new Date(c.last_outbound_at)) && hoursSince(c.last_inbound_at, now) >= CONFIG.CHAT_WAIT_HOURS && byId.has(c.lead_id))
    .sort((a, b) => new Date(a.last_inbound_at!).getTime() - new Date(b.last_inbound_at!).getTime());
  if (waiting.length) {
    out.push({
      tone: "red",
      title: `${waiting.length} chat belum dibalas lebih dari ${CONFIG.CHAT_WAIT_HOURS} jam`,
      items: waiting.slice(0, 5).map((c) => {
        const l = byId.get(c.lead_id)!;
        return `${l.name} (${nameOf(l.assigned_to || l.user_id)}), menunggu ${Math.round(hoursSince(c.last_inbound_at, now))} jam`;
      }),
    });
  }

  // 2. Lead high-value belum di-follow-up
  const hv = active
    .filter((l) => Number(l.deal_value) >= CONFIG.HIGH_VALUE && hoursSince(touch(l), now) >= CONFIG.FOLLOWUP_HOURS)
    .sort((a, b) => Number(b.deal_value) - Number(a.deal_value));
  if (hv.length) {
    out.push({
      tone: "red",
      title: `${hv.length} lead high-value belum di-follow-up lebih dari ${CONFIG.FOLLOWUP_HOURS} jam`,
      items: hv.slice(0, 5).map((l) => `${l.name} ${rp(Number(l.deal_value))} (${nameOf(l.assigned_to || l.user_id)}), terakhir disentuh ${Math.floor(hoursSince(touch(l), now) / 24)} hari lalu`),
    });
  }

  // 3. Lead stuck per marketing
  const stuckBy = new Map<string, number>();
  for (const l of active) {
    if (hoursSince(touch(l), now) >= CONFIG.STUCK_DAYS * 24) {
      const k = l.assigned_to || l.user_id || "";
      stuckBy.set(k, (stuckBy.get(k) || 0) + 1);
    }
  }
  const stuck = [...stuckBy.entries()].filter(([, n]) => n >= CONFIG.STUCK_MIN_PER_MEMBER).sort((a, b) => b[1] - a[1]);
  if (stuck.length) {
    out.push({ tone: "amber", title: `Lead stuck lebih dari ${CONFIG.STUCK_DAYS} hari`, items: stuck.map(([id, n]) => `${nameOf(id || null)} punya ${n} lead stuck`) });
  }

  // 4. Mencapai target bulan ini
  const hit = targets.filter((t) => t.amount > 0 && (achieved.get(t.user_id) || 0) >= t.amount);
  if (hit.length) {
    out.push({
      tone: "green",
      title: "Target bulan ini tercapai",
      items: hit.map((t) => `${nameOf(t.user_id)} mencapai ${Math.round(((achieved.get(t.user_id) || 0) / t.amount) * 100)}% dari target ${rp(t.amount)}`),
    });
  }
  return out;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const TONE = { red: ["#fff1f2", "#fecdd3", "#be123c"], amber: ["#fffbeb", "#fde68a", "#92400e"], green: ["#ecfdf5", "#a7f3d0", "#047857"] } as const;

export function renderHtml(orgName: string, dateLabel: string, alerts: Alert[]): string {
  const blocks = alerts
    .map((a) => {
      const [bg, bd, fg] = TONE[a.tone];
      return `<div style="background:${bg};border:1px solid ${bd};border-radius:12px;padding:12px 14px;margin-bottom:12px;"><div style="font-weight:700;font-size:14px;color:${fg};margin-bottom:6px;">${esc(a.title)}</div><ul style="margin:0;padding-left:18px;">${a.items.map((i) => `<li style="margin:0 0 3px;font-size:13px;color:#334155;">${esc(i)}</li>`).join("")}</ul></div>`;
    })
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;"><div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="font-weight:800;font-size:16px;color:#0f172a;">Perlu perhatian hari ini - ${esc(orgName)}</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">${esc(dateLabel)}</div>
    ${blocks}
    <a href="https://nexto.site" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:10px;">Buka Nexto</a>
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;">Alert otomatis tiap pagi untuk owner dan manager. Tidak dikirim bila tidak ada yang perlu diperhatikan.</p>
  </div></body></html>`;
}
