-- 17 Okt 2026: cabut EXECUTE dari fungsi fitur dokumen yang UI-nya sudah dihapus dan tidak dipanggil dari app.
-- Fungsi-fungsi ini SECURITY DEFINER tanpa pengecekan akses, jadi user login mana pun bisa memanggilnya langsung lewat RPC.
-- docs_plan_ok dan is_org_manager tidak dicabut karena masih dipakai policy RLS (doc_settings, documents).
-- Sudah diterapkan ke database lewat MCP.

revoke execute on function public.convert_quotation_to_invoice(uuid) from public, anon, authenticated;
revoke execute on function public.delete_document_payment(uuid) from public, anon, authenticated;
revoke execute on function public.issue_document(uuid) from public, anon, authenticated;
revoke execute on function public.record_document_payment(uuid, numeric, date, text, text) from public, anon, authenticated;
revoke execute on function public.set_quotation_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.void_document(uuid) from public, anon, authenticated;
