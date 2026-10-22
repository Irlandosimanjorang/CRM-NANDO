-- Foto check-in: bucket checkin-photos dibuat privat. Baca foto hanya untuk anggota org yang sama
-- dengan pengunggah (folder pertama path = user id pengunggah). Akses publik dicabut.
drop policy if exists checkin_photo_read_public on storage.objects;

create policy checkin_photo_read_org on storage.objects
  for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and exists (
      select 1
      from public.organization_members me
      join public.organization_members uploader
        on uploader.org_id = me.org_id
      where me.user_id = auth.uid()
        and uploader.user_id::text = (storage.foldername(name))[1]
    )
  );

update storage.buckets set public = false where id = 'checkin-photos';
