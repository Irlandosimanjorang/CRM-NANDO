-- Checklist proyek deal (3 Nov 2026): SPH sudah ditandatangani customer, pemberkasan QR code, dan performa invoice.
-- Hanya centang. Tiap item tersimpan sebagai { "at": waktu, "by": user id }, dan kunci yang tidak ada berarti belum dicentang.
alter table public.leads add column if not exists proyek_checklist jsonb not null default '{}'::jsonb;
