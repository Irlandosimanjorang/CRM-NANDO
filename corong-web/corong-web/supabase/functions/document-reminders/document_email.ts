// Template email Quotation/Invoice client (7 Okt 2026). File ini IDENTIK di
// supabase/functions/document-send dan supabase/functions/document-reminders -
// kalau diubah, salin ke keduanya. Layout <table> + style inline agar rapi di
// Gmail/Outlook. Gambar (logo/tanda tangan) tidak dipakai di email karena
// disimpan sebagai data URI.

export const PUBLIC_DOC_URL = "https://nexto.site/dokumen?t=";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
export const fmtTanggal = (iso) => (iso ? new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#c2410c");

const INTRO = {
  quotation: (n, until) => `Berikut kami sampaikan quotation <b>${n}</b>, berlaku sampai <b>${until}</b>.`,
  invoice: (n, due) => `Berikut kami sampaikan invoice <b>${n}</b> dengan jatuh tempo <b>${due}</b>.`,
  due_minus3: (n, due) => `Kami mengingatkan bahwa invoice <b>${n}</b> akan jatuh tempo pada <b>${due}</b>, tiga hari lagi.`,
  due_today: (n, due) => `Invoice <b>${n}</b> jatuh tempo hari ini, <b>${due}</b>.`,
  overdue_3: (n, due) => `Invoice <b>${n}</b> telah melewati jatuh tempo sejak <b>${due}</b>. Mohon pembayaran dapat segera dilakukan.`,
  overdue_7: (n, due) => `Invoice <b>${n}</b> telah melewati jatuh tempo sejak <b>${due}</b> dan belum kami terima pembayarannya. Mohon pembayaran dapat segera dilakukan.`,
};

export function documentSubject(kind, doc, seller) {
  const from = seller?.name || "kami";
  if (kind === "quotation") return `Quotation ${doc.number} dari ${from}`;
  if (kind === "invoice") return `Invoice ${doc.number} dari ${from}`;
  if (kind === "due_minus3") return `Pengingat: invoice ${doc.number} jatuh tempo ${fmtTanggal(doc.due_date)}`;
  if (kind === "due_today") return `Invoice ${doc.number} jatuh tempo hari ini`;
  return `Invoice ${doc.number} telah lewat jatuh tempo`;
}

// kind: quotation | invoice | due_minus3 | due_today | overdue_3 | overdue_7
export function renderDocumentEmail(kind, doc, seller = {}, accent = "#c2410c", note = "") {
  const color = safeColor(accent);
  const isQuote = kind === "quotation";
  const cust = doc.customer || {};
  const total = Number(doc.total) || 0;
  const paid = Number(doc.amount_paid) || 0;
  const remaining = Math.max(0, total - paid);
  const link = PUBLIC_DOC_URL + doc.public_token;
  const greet = cust.contact ? `Yth. ${esc(cust.contact)},` : `Yth. ${esc(cust.name || "Bapak/Ibu")},`;
  const row = (k, v, strong = false) => `<tr><td style="padding:7px 0;color:#5b6475;font-size:13px;">${k}</td><td style="padding:7px 0;text-align:right;font-size:13px;color:#1c2230;${strong ? "font-weight:700;" : ""}">${v}</td></tr>`;
  const bank = !isQuote && seller.account
    ? [seller.bank && row("Bank", esc(seller.bank)), row("No. rekening", esc(seller.account), true), seller.holder && row("Atas nama", esc(seller.holder))].filter(Boolean).join("")
    : "";
  const sign = [seller.signName, seller.signTitle, seller.name].filter(Boolean).map(esc);
  const items = (doc.items || []).slice(0, 8);
  const more = (doc.items || []).length - items.length;
  const itemRows = items.map((it) => `<tr><td style="padding:6px 0;font-size:13px;color:#1c2230;">${esc(it.name)}</td><td style="padding:6px 0;text-align:right;font-size:12px;color:#5b6475;white-space:nowrap;">${esc(String(it.qty))}${it.unit ? " " + esc(it.unit) : ""}</td></tr>`).join("") + (more > 0 ? `<tr><td colspan="2" style="padding:6px 0;font-size:12px;color:#8a92a1;">dan ${more} item lainnya (lihat dokumen)</td></tr>` : "");
  const introFn = INTRO[kind] || INTRO.invoice;
  return `<!DOCTYPE html><html lang="id"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1c2230;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6eb;border-radius:6px;">
  <tr><td style="padding:20px 28px;border-bottom:3px solid ${color};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:16px;font-weight:700;color:#1c2230;">${esc(seller.name || "")}</td>
      <td style="text-align:right;font-size:12px;color:#5b6475;">${esc(doc.number)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:22px 28px 8px;font-size:14px;line-height:1.6;">
    <p style="margin:0 0 12px;">${greet}</p>
    <p style="margin:0 0 12px;">${introFn(esc(doc.number), fmtTanggal(doc.due_date))}</p>
    ${note ? `<p style="margin:0 0 12px;">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
  </td></tr>
  <tr><td style="padding:4px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e6eb;">
      ${row(isQuote ? "Ditujukan kepada" : "Ditagihkan kepada", esc(cust.name || ""))}
      ${row(isQuote ? "Tanggal quotation" : "Tanggal invoice", fmtTanggal(doc.issue_date))}
      ${row(isQuote ? "Berlaku sampai" : "Jatuh tempo", fmtTanggal(doc.due_date))}
      ${!isQuote && paid > 0 ? row("Sudah dibayar", rp(paid)) : ""}
      <tr><td style="padding:10px 0;border-top:2px solid #1c2230;font-size:15px;font-weight:700;">${!isQuote && paid > 0 ? "Sisa tagihan" : "Total"}</td><td style="padding:10px 0;border-top:2px solid #1c2230;text-align:right;font-size:15px;font-weight:700;color:${color};">${rp(!isQuote && paid > 0 ? remaining : total)}</td></tr>
    </table>
  </td></tr>
  ${itemRows ? `<tr><td style="padding:14px 28px 0;"><div style="font-size:13px;font-weight:700;margin-bottom:2px;">Rincian</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table></td></tr>` : ""}
  ${bank ? `<tr><td style="padding:16px 28px 0;">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Cara pembayaran</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bank}</table>
    <p style="margin:6px 0 0;font-size:12px;color:#5b6475;">Cantumkan nomor ${esc(doc.number)} pada berita transfer.</p>
  </td></tr>` : ""}
  <tr><td style="padding:22px 28px 6px;">
    <a href="${link}" target="_blank" style="display:inline-block;background:#1c2230;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:5px;">${isQuote ? "Lihat & unduh quotation" : "Lihat & unduh invoice"}</a>
  </td></tr>
  <tr><td style="padding:14px 28px 24px;font-size:13px;line-height:1.6;color:#5b6475;">
    Jika ada pertanyaan, silakan balas email ini.
    ${sign.length ? `<p style="margin:14px 0 0;color:#1c2230;">Hormat kami,<br>${sign.join("<br>")}</p>` : ""}
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a92a1;">Dokumen ini dibuat dan dikirim melalui Nexto atas nama ${esc(seller.name || "pengirim")}.</p>
</td></tr></table></body></html>`;
}

// Kirim lewat Resend. Balasan customer diarahkan ke email penerbit (reply_to),
// dan penerbit mendapat salinan (bcc).
export async function sendEmail({ apiKey, to, subject, html, replyTo, bcc, fromName }) {
  const name = String(fromName || "Nexto").replace(/[<>"\r\n]/g, "").slice(0, 60) || "Nexto";
  const payload: Record<string, unknown> = { from: `${name} via Nexto <noreply@nexto.site>`, to: [to], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  if (bcc && bcc.toLowerCase() !== to.toLowerCase()) payload.bcc = [bcc];
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Email gagal dikirim (${resp.status}): ${t.slice(0, 160)}`);
  }
  return true;
}
