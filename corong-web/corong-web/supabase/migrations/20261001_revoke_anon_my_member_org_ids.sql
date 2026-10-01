-- Samakan dengan my_org_ids(): tidak perlu bisa dipanggil tanpa login.
revoke execute on function public.my_member_org_ids() from anon, public;
