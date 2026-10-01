-- Penanda catatan "terlalu singkat" (2 Okt 2026). Diterapkan lewat migration
-- "team_activity_thin_notes". Aturan sama dengan src/lib/noteQuality.js.
create or replace function public.is_thin_note(p text)
returns boolean
language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select char_length(btrim(coalesce(p, ''))) < 15
      or lower(regexp_replace(btrim(coalesce(p, '')), '[[:punct:][:space:]]+$', '')) = any (array[
        'ok', 'oke', 'okay', 'follow up', 'followup', 'fu', 'f/u', 'sudah dihubungi', 'dihubungi',
        'sudah', 'belum', 'belum respon', 'belum ada respon', 'tidak ada respon', 'no respon',
        'no response', 'sudah wa', 'sudah telp', 'sudah telepon', 'call', 'visit', 'done', 'test', 'tes'
      ]);
$$;
-- get_team_activity: members juga mengembalikan
--   'notes_thin' = jumlah catatan anggota di rentang waktu yang is_thin_note(text).
