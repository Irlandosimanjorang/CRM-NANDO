-- Simpan tahap pipeline dalam satu transaksi (13 Okt 2026). Sebelumnya klien menghapus semua tahap lalu memasukkan
-- ulang dalam dua panggilan terpisah: kalau insert gagal di tengah, organisasi bisa kehilangan seluruh tahapnya.
-- Fungsi ini hanya bisa dipanggil owner dari organisasi tersebut.
create or replace function public.save_org_stages(p_org_id uuid, p_stages jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.organizations o where o.id = p_org_id and o.owner_user_id = auth.uid()) then
    raise exception 'Hanya owner yang bisa mengubah tahap pipeline.';
  end if;
  if jsonb_typeof(p_stages) is distinct from 'array' or jsonb_array_length(p_stages) = 0 then
    raise exception 'Pipeline harus punya minimal satu tahap.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_stages) s where coalesce(s->>'type', '') not in ('normal', 'won', 'lost') or coalesce(s->>'key', '') = '') then
    raise exception 'Setiap tahap harus punya kunci dan tipe normal, won, atau lost.';
  end if;

  delete from public.stages where org_id = p_org_id;
  insert into public.stages (user_id, org_id, key, label, hex, type, position)
  select auth.uid(), p_org_id, s->>'key', s->>'label', s->>'hex', s->>'type', (ord - 1)::int
  from jsonb_array_elements(p_stages) with ordinality as t(s, ord);
end;
$$;

revoke all on function public.save_org_stages(uuid, jsonb) from public, anon;
grant execute on function public.save_org_stages(uuid, jsonb) to authenticated;
