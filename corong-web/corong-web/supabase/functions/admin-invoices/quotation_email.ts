// Email quotation (penawaran harga) langganan Nexto (8 Okt 2026). Hanya ada di
// admin-invoices. Memakai sendEmail dari invoice_email.ts (file bersama).
// Layout <table> + style inline supaya rapi di Gmail/Outlook.

export const PDF_QUOTATION_URL = "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/invoice-pdf?k=q&t=";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const tgl = (iso) => new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const PLAN_NAME = { enterprise: "Enterprise", professional: "Professional", standard: "Standard" };

export const quotationSubject = (q, seller) => `Penawaran harga ${q.number} dari ${seller?.name || "Nexto"}`;

export function renderQuotationEmail(q, seller = {}, note = "", attached = false) {
  const d = q.data || {};
  const pdfLink = PDF_QUOTATION_URL + q.public_token;
  const greet = d.contact ? `Yth. ${esc(d.contact)},` : `Yth. ${esc(q.company)},`;
  const row = (k, v, strong = false) => `<tr><td style="padding:7px 0;color:#5b6475;font-size:13px;">${k}</td><td style="padding:7px 0;text-align:right;font-size:13px;color:#1c2230;${strong ? "font-weight:700;" : ""}">${v}</td></tr>`;
  const key = d.plan === "custom" ? d.activatePlan : d.plan;
  const team = key === "enterprise";
  const seats = Number(d.seats) || 1, months = Number(d.months) || 1;
  const free = team ? Math.max(0, Math.floor(Number(d.freeSeats) || 0)) : 0;
  const sign = [seller.signName, seller.signTitle, seller.name].filter(Boolean).map(esc);
  return `<!DOCTYPE html><html lang="id"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1c2230;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6eb;border-radius:6px;">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #e3e6eb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="display:inline-block;background:#1c2230;padding:7px 11px;border-radius:4px;"><img src="https://nexto.site/nexto-logo.png" alt="Nexto" height="18" style="display:block;height:18px;"></span></td>
      <td style="text-align:right;font-size:12px;color:#5b6475;">${esc(q.number)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;font-size:14px;line-height:1.6;">
    <p style="margin:0 0 12px;">${greet}</p>
    <p style="margin:0 0 12px;">Terima kasih atas ketertarikan Anda pada Nexto. Berikut penawaran harga <b>${esc(q.number)}</b>, berlaku sampai <b>${tgl(q.due_date)}</b>.</p>
    ${note ? `<p style="margin:0 0 12px;">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
  </td></tr>
  <tr><td style="padding:4px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e6eb;">
      ${row("Ditujukan kepada", esc(q.company))}
      ${row("Paket", PLAN_NAME[key] ? `Nexto ${PLAN_NAME[key]}` : esc(d.item || "Layanan Nexto"))}
      ${row("Jumlah", team ? (free ? `${seats} anggota tim + ${free} kursi owner/manager (gratis)` : `${seats} anggota tim (termasuk owner)`) : `${seats} pengguna`)}
      ${row("Durasi", `${months} bulan`)}
      ${row("Harga", `${rp(d.pricePerSeat)} per ${team ? "anggota" : "pengguna"}/bulan`)}
      ${row("Tanggal penawaran", tgl(q.invoice_date))}
      ${row("Berlaku sampai", tgl(q.due_date))}
      <tr><td style="padding:10px 0;border-top:2px solid #1c2230;font-size:15px;font-weight:700;">Total penawaran</td><td style="padding:10px 0;border-top:2px solid #1c2230;text-align:right;font-size:15px;font-weight:700;color:#c2410c;">${rp(q.total)}</td></tr>
    </table>
    <p style="margin:6px 0 0;font-size:12px;color:#5b6475;">Jika penawaran ini Anda setujui, kami akan menerbitkan invoice untuk pembayaran. Paket aktif setelah pembayaran diterima.</p>
  </td></tr>
  <tr><td style="padding:22px 28px 6px;">
    <a href="${pdfLink}" style="display:inline-block;background:#1c2230;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:5px;">Unduh penawaran (PDF)</a>
  </td></tr>
  <tr><td style="padding:14px 28px 24px;font-size:13px;line-height:1.6;color:#5b6475;">
    Jika ada pertanyaan atau Anda ingin menyesuaikan jumlah anggota dan periode, silakan balas email ini.
    ${attached ? `<p style="margin:10px 0 0;">Penawaran dalam bentuk PDF juga terlampir pada email ini.</p>` : ""}
    ${sign.length ? `<p style="margin:14px 0 0;color:#1c2230;">Hormat kami,<br>${sign.join("<br>")}</p>` : ""}
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a92a1;">Email ini dikirim melalui Nexto.</p>
</td></tr></table></body></html>`;
}

export async function quotationPdfAttachment(q) {
  const r = await fetch(PDF_QUOTATION_URL + q.public_token);
  if (!r.ok) throw new Error(`PDF ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { filename: `Quotation-${String(q.number || "Nexto").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`, content: btoa(bin) };
}
