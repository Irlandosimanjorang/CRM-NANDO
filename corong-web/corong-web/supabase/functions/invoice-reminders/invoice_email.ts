// Template email invoice & pengingat jatuh tempo (2 Okt 2026).
// File ini IDENTIK di supabase/functions/admin-invoices dan
// supabase/functions/invoice-reminders - kalau diubah, salin ke keduanya.
// Layout pakai <table> + style inline supaya rapi di Gmail/Outlook.

export const PUBLIC_INVOICE_URL = "https://nexto.site/invoice?t=";
// Unduhan PDF langsung (fungsi invoice-pdf): berfungsi di semua HP dan browser dalam aplikasi.
export const PDF_INVOICE_URL = "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/invoice-pdf?t=";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
export const fmtTanggal = (iso) => new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

const PLAN_NAME = { enterprise: "Enterprise", professional: "Professional", standard: "Standard" };

const INTRO = {
  invoice: (n, due) => `Berikut kami sampaikan invoice <b>${n}</b> dengan jatuh tempo <b>${due}</b>.`,
  due_minus3: (n, due) => `Kami mengingatkan bahwa invoice <b>${n}</b> akan jatuh tempo pada <b>${due}</b>, tiga hari lagi.`,
  due_today: (n, due) => `Invoice <b>${n}</b> jatuh tempo hari ini, <b>${due}</b>.`,
  overdue_3: (n, due) => `Invoice <b>${n}</b> telah melewati jatuh tempo sejak <b>${due}</b>. Mohon pembayaran dapat segera dilakukan.`,
  overdue_7: (n, due) => `Invoice <b>${n}</b> telah melewati jatuh tempo sejak <b>${due}</b> dan belum kami terima pembayarannya. Mohon pembayaran dapat segera dilakukan.`,
  // Bukti pembayaran (invoice berstatus Lunas) - tanpa ajakan membayar.
  receipt: (n, _due, paid) => `Terima kasih. Pembayaran untuk invoice <b>${n}</b> telah kami terima${paid ? ` pada <b>${paid}</b>` : ""}. Invoice ini berstatus <b>LUNAS</b>.`,
};

export function invoiceSubject(kind, inv, seller) {
  const n = inv.number;
  if (kind === "invoice") return `Invoice ${n} dari ${seller?.name || "Nexto"}`;
  if (kind === "receipt") return `Pembayaran diterima: invoice ${n} (Lunas)`;
  if (kind === "due_minus3") return `Pengingat: invoice ${n} jatuh tempo ${fmtTanggal(inv.due_date)}`;
  if (kind === "due_today") return `Invoice ${n} jatuh tempo hari ini`;
  return `Invoice ${n} telah lewat jatuh tempo`;
}

// kind: invoice | receipt | due_minus3 | due_today | overdue_3 | overdue_7
export function renderInvoiceEmail(kind, inv, seller = {}, note = "", attached = false) {
  const d = inv.data || {};
  const due = fmtTanggal(inv.due_date);
  const isReceipt = kind === "receipt";
  const paidOn = inv.paid_at ? fmtTanggal(new Date(new Date(inv.paid_at).getTime() + 7 * 3600000).toISOString().slice(0, 10)) : "";
  const activeUntil = d.activation?.expires_at ? fmtTanggal(new Date(new Date(d.activation.expires_at).getTime() + 7 * 3600000).toISOString().slice(0, 10)) : "";
  const link = PUBLIC_INVOICE_URL + inv.public_token;
  const pdfLink = PDF_INVOICE_URL + inv.public_token;
  const greet = d.contact ? `Yth. ${esc(d.contact)},` : `Yth. ${esc(inv.company)},`;
  const row = (k, v, strong = false) => `<tr><td style="padding:7px 0;color:#5b6475;font-size:13px;">${k}</td><td style="padding:7px 0;text-align:right;font-size:13px;color:#1c2230;${strong ? "font-weight:700;" : ""}">${v}</td></tr>`;
  const bank = seller.account
    ? [seller.bank && row("Bank", esc(seller.bank)), row("No. rekening", esc(seller.account), true), seller.holder && row("Atas nama", esc(seller.holder))].filter(Boolean).join("")
    : "";
  const sign = [seller.signName, seller.signTitle, seller.name].filter(Boolean).map(esc);
  // Detail langganan (sama dengan bagian "Detail langganan" di invoice).
  const key = d.plan === "custom" ? d.activatePlan : d.plan;
  const team = key === "enterprise";
  const seats = Number(d.seats) || 1, months = Number(d.months) || 1;
  const sub = [
    row("Paket", PLAN_NAME[key] ? `Nexto ${PLAN_NAME[key]}` : esc(d.item || "Layanan Nexto")),
    row("Jumlah anggota", team ? `${seats} anggota tim (termasuk owner)` : `${seats} pengguna`),
    row("Durasi", `${months} bulan`),
    d.start && d.end ? row("Periode", `${fmtTanggal(d.start)} sampai ${fmtTanggal(d.end)}`) : "",
    row("Harga", `${rp(d.pricePerSeat)} per ${team ? "anggota" : "pengguna"}/bulan`),
    d.email ? row("Akun Nexto", esc(d.email)) : "",
  ].join("");
  return `<!DOCTYPE html><html lang="id"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1c2230;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6eb;border-radius:6px;">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #e3e6eb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="display:inline-block;background:#1c2230;padding:7px 11px;border-radius:4px;"><img src="https://nexto.site/nexto-logo.png" alt="Nexto" height="18" style="display:block;height:18px;"></span></td>
      <td style="text-align:right;font-size:12px;color:#5b6475;">${esc(inv.number)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;font-size:14px;line-height:1.6;">
    <p style="margin:0 0 12px;">${greet}</p>
    <p style="margin:0 0 12px;">${(INTRO[kind] || INTRO.invoice)(esc(inv.number), due, paidOn)}</p>
    ${note ? `<p style="margin:0 0 12px;">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
  </td></tr>
  <tr><td style="padding:4px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e6eb;">
      ${row("Ditagihkan kepada", esc(inv.company))}
      ${row("Layanan", esc(d.item || "Langganan Nexto"))}
      ${row("Tanggal invoice", fmtTanggal(inv.invoice_date))}
      ${isReceipt ? row("Tanggal pembayaran", paidOn || "-") + row("Status", `<span style="color:#15803d;font-weight:700;">Lunas</span>`) : row("Jatuh tempo", due)}
      <tr><td style="padding:10px 0;border-top:2px solid #1c2230;font-size:15px;font-weight:700;">${isReceipt ? "Total dibayar" : "Total tagihan"}</td><td style="padding:10px 0;border-top:2px solid #1c2230;text-align:right;font-size:15px;font-weight:700;color:${isReceipt ? "#15803d" : "#c2410c"};">${rp(inv.total)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Detail langganan</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sub}</table>
    <p style="margin:6px 0 0;font-size:12px;color:#5b6475;">${team ? "Anggota tim bergabung lewat kode undangan dari akun owner. " : ""}${isReceipt ? (activeUntil ? `Paket sudah aktif sampai <b style="color:#1c2230;">${activeUntil}</b>.` : "Paket akan segera kami aktifkan.") : "Akses aktif setelah pembayaran diterima."}</p>
  </td></tr>
  ${bank && !isReceipt ? `<tr><td style="padding:18px 28px 0;">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Cara pembayaran</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bank}</table>
    <p style="margin:6px 0 0;font-size:12px;color:#5b6475;">Cantumkan nomor ${esc(inv.number)} pada berita transfer.</p>
  </td></tr>` : ""}
  <tr><td style="padding:22px 28px 6px;">
    <a href="${link}" target="_blank" style="display:inline-block;background:#1c2230;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:5px;">${isReceipt ? "Lihat &amp; unduh invoice lunas" : "Lihat &amp; unduh invoice"}</a>
    <a href="${pdfLink}" style="display:inline-block;margin-left:14px;color:#1c2230;font-size:13px;font-weight:700;text-decoration:underline;">Unduh PDF</a>
  </td></tr>
  <tr><td style="padding:14px 28px 24px;font-size:13px;line-height:1.6;color:#5b6475;">
    ${isReceipt ? "Simpan email ini sebagai bukti pembayaran. Jika ada pertanyaan, silakan balas email ini." : kind === "invoice" ? "Jika ada pertanyaan, silakan balas email ini." : "Jika pembayaran sudah dilakukan, mohon abaikan email ini atau balas dengan bukti transfer."}
    ${attached ? `<p style="margin:10px 0 0;">Invoice dalam bentuk PDF juga terlampir pada email ini.</p>` : ""}
    ${sign.length ? `<p style="margin:14px 0 0;color:#1c2230;">Hormat kami,<br>${sign.join("<br>")}</p>` : ""}
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a92a1;">Email ini dikirim melalui Nexto.</p>
</td></tr></table></body></html>`;
}

// Kirim lewat Resend. Balasan klien diarahkan ke email penagih (reply_to),
// dan penagih mendapat salinan (bcc) supaya tahu email apa yang terkirim.
export async function sendEmail({ apiKey, to, subject, html, replyTo, bcc, attachments }) {
  const payload = { from: "Nexto <noreply@nexto.site>", to: [to], subject, html };
  if (attachments && attachments.length) payload.attachments = attachments; // [{ filename, content: base64 }]
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

// Lampiran PDF (7 Okt 2026): diambil dari fungsi invoice-pdf lewat HTTP, jadi
// pembuat PDF cukup ada di satu tempat. Gagal = email tetap terkirim tanpa lampiran.
export async function invoicePdfAttachment(inv) {
  const r = await fetch(PDF_INVOICE_URL + inv.public_token);
  if (!r.ok) throw new Error(`PDF ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { filename: `Invoice-${String(inv.number || "Nexto").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`, content: btoa(bin) };
}
