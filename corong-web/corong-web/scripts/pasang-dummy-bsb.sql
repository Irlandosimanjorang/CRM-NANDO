-- Pasang data dummy lengkap ke organisasi BSB (PT. Bangun Selaras Bersama) supaya owner bisa melihat hasil kerja.
-- Jalankan SEKALI di Supabase SQL Editor (project cewggulyfshnbebcpyui). Aman diulang: anggota dan chat tidak dobel.
-- Isi: 5 marketing dummy (Adi, Dian, Reza, Rika, Renika; email *.bsb.dummy@example.com, tidak bisa login),
--      plan Enterprise sementara 30 hari (limit 6 anggota) agar tab Team muncul, saklar Chat masuk, pembagian 20 lead dummy
--      ke 5 marketing, +10 lead dummy, riwayat tahap, catatan harian, dan 7 chat dummy (percakapan tersimpan di lead).
-- Hapus semuanya nanti: scripts/hapus-data-dummy.sql (ganti <ORG_ID> dengan id BSB di bawah). Tidak ada kunci webhook dibuat di sini.

do $$
declare
  o uuid := '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0';
  ow uuid := '9f8c841a-a163-40a2-ab23-a2106c6f8faa';
  nm text[] := array['Adi','Dian','Reza','Rika','Renika'];
  uid uuid[] := '{}'; u uuid; pers uuid; i int; r record; m record; msg jsonb;
  ord text[] := array['data_masuk','sph_terlayang','hot_progress','proyek_deal','deal_kontrak','proses_so','pengiriman'];
  idx int; k int; at_ts timestamptz; lid uuid; cid uuid; t0 timestamptz; n int;
  chats jsonb := '[
    {"k":"wa:6281299990001","n":"Hendra Wijaya","p":"+6281299990001","pl":"whatsapp","src":"Meta","c":"[DUMMY] Promo Jendela uPVC","d":3,"m":[["in","Halo kak, saya lihat iklan jendela uPVC. Harga per meter berapa ya?"],["out","Halo Pak Hendra, terima kasih sudah menghubungi BSB. Untuk jendela uPVC mulai Rp1,4 jt per meter. Untuk proyek apa pak?"],["in","Rumah 2 lantai di Bekasi, kira-kira 14 jendela dan 3 pintu."],["out","Baik pak. Boleh kirim denah atau ukuran? Kami siapkan SPH nya hari ini."],["in","Siap, saya kirim denah nanti sore ya."]]},
    {"k":"wa:6281299990002","n":"Sari Dewi","p":"+6281299990002","pl":"whatsapp","src":"Meta","c":"[DUMMY] Promo Jendela uPVC","d":2,"m":[["in","Selamat siang, mau tanya promo jendela, bisa survei ke Depok?"],["out","Selamat siang Bu Sari. Bisa, survei gratis area Jabodetabek. Kapan waktu yang cocok?"],["in","Hari Sabtu pagi bisa?"]]},
    {"k":"wa:6281299990003","n":"Agung Prasetyo","p":"+6281299990003","pl":"whatsapp","src":"Meta","c":"[DUMMY] Retargeting Rumah","d":2,"m":[["in","Kemarin saya sudah lihat katalog, mau order WPC untuk fasad rumah"],["out","Terima kasih pak Agung. WPC fasad tersedia 3 warna. Luas fasadnya berapa meter persegi?"],["in","Sekitar 40 m2. Tolong kirim penawaran lengkap sama estimasi pemasangan."],["out","Siap pak, penawaran kami kirim lewat WhatsApp ini hari ini."],["in","Oke, kalau cocok minggu depan langsung DP."]]},
    {"k":"tt:tt_88123","n":"tiktok_arief","p":"","pl":"tiktok","src":"TikTok","c":"[DUMMY] Video Showroom","d":1,"m":[["in","kak showroomnya di mana? mau liat langsung pintu alumunium"],["out","Halo kak! Showroom kami di Jakarta Timur, buka Senin-Sabtu 09.00-17.00."]]},
    {"k":"ig:ig_5521","n":"rina.interior","p":"","pl":"instagram","src":"Instagram","c":"[DUMMY] Reels Proyek","d":1,"m":[["in","kak ada katalog alumunium & uPVC buat proyek interior kantor?"],["out","Ada kak, kami kirim katalog PDF. Boleh minta nomor WhatsApp untuk kirim penawaran?"],["in","boleh, 0812-9999-0005"]]},
    {"k":"wa:6281299990006","n":"Budi Santoso","p":"+6281299990006","pl":"whatsapp","src":"WhatsApp","c":"","d":1,"m":[["in","Halo, saya dapat nomor ini dari teman. Bisa pasang kusen alumunium untuk ruko?"],["out","Halo pak Budi, bisa. Ruko berapa lantai dan lokasinya di mana?"]]},
    {"k":"wa:6281299990007","n":"PT. Karya Mandiri","p":"+6281299990007","pl":"whatsapp","src":"Meta","c":"[DUMMY] Promo Jendela uPVC","d":0,"m":[["in","Selamat pagi, kami kontraktor, butuh penawaran jendela uPVC 60 unit untuk proyek perumahan."],["out","Selamat pagi pak. Untuk volume 60 unit kami ada harga khusus kontraktor. Boleh minta detail ukuran dan jadwal pemasangan?"],["in","Detail kami kirim lewat email ya. Mohon penawaran paling lambat Jumat."],["out","Siap pak, kami tindak lanjuti."]]}
  ]'::jsonb;
begin
  perform set_config('nexto.bulk_move', 'on', true);

  -- 1. anggota dummy
  foreach i in array array[1,2,3,4,5] loop
    select id into u from auth.users where email = lower(nm[i]) || '.bsb.dummy@example.com';
    if u is null then
      u := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', lower(nm[i]) || '.bsb.dummy@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    end if;
    -- organisasi pribadi bawaan akun baru dibuang, lalu dimasukkan ke BSB sebagai sales_rep
    for pers in select mm.org_id from organization_members mm where mm.user_id = u and mm.org_id <> o loop
      delete from organization_members where org_id = pers and user_id = u;
      delete from stages where org_id = pers;
      delete from organizations where id = pers;
    end loop;
    insert into organization_members (org_id, user_id, role) select o, u, 'sales_rep' where not exists (select 1 from organization_members where org_id = o and user_id = u);
    update settings set community_display_name = nm[i] where user_id = u;
    uid := uid || u;
  end loop;

  -- 2. plan Enterprise sementara + saklar Chat masuk
  update organizations set plan = 'enterprise', member_limit = 6, plan_expires_at = now() + interval '30 days',
    features = features || '{"lead_webhook": true}'::jsonb where id = o;

  -- 3. bagi lead dummy yang ada ke 5 marketing (grup Mandala semuanya ke Dian), tambah 10 lead dummy
  if (select count(*) from leads where org_id = o and source = 'dummy' and name = 'PROYEK RUKO SUDIRMAN') = 0 then
    with ranked as (select id, group_holding, row_number() over (order by created_at, name) rn from leads where org_id = o and source = 'dummy')
    update leads l set assigned_to = case when rk.group_holding = 'MANDALA GROUP' then uid[2] else uid[((rk.rn - 1) % 5)::int + 1] end
    from ranked rk where l.id = rk.id;

    for r in select * from (values
      ('PROYEK RUKO SUDIRMAN','Kontraktor','Meta','proyek_deal',64000000,'I/10/2026/DMY/UPVC/101',2,8,'Bandung',1),
      ('RUMAH PAK AGUNG','Owner','TikTok','proyek_deal',38500000,'I/10/2026/DMY/UPVC/102',3,7,'Surabaya',1),
      ('GUDANG LOGISTIK PRIMA','Pabrik','Google','hot_progress',120000000,'I/10/2026/DMY/WPC/103',4,null,'Cikarang',1),
      ('CLUSTER BUMI ASRI','Kontraktor','Meta','sph_terlayang',56000000,'I/10/2026/DMY/UPVC/104',5,null,'Bekasi',2),
      ('KANTOR NOTARIS HARAPAN','Purchasing','Instagram','sph_terlayang',11500000,'I/10/2026/DMY/UPVC/105',6,null,'Jakarta Selatan',2),
      ('VILLA PUNCAK INDAH','Owner','Instagram','deal_kontrak',92000000,'I/10/2026/DMY/UPVC/106',1,6,'Bogor',3),
      ('TOKO MATERIAL SEJAHTERA','Purchasing','Database','data_masuk',0,'',7,null,'Tangerang',3),
      ('RUMAH KOST PAK DODI','Owner','Meta','data_masuk',0,'',8,null,'Depok',4),
      ('SEKOLAH CITRA BANGSA','Purchasing','Customer datang','no_deal',27000000,'I/10/2026/DMY/UPVC/107',2,null,'Bandung',4),
      ('RUMAH PAK LEO','Owner','TikTok','sph_terlayang',18800000,'I/10/2026/DMY/UPVC/108',6,null,'Malang',5)
    ) as t(name, tipe, sumber, stage, nilai, sph, dc, dd, kota, who) loop
      insert into leads (user_id, org_id, assigned_to, name, category, stage_key, company_type, key_person, phone, city, deal_value, deal_date, source, custom_field_1, custom_field_2, created_at, updated_at, last_contact)
      values (ow, o, uid[r.who], r.name, 'Lainnya', r.stage, r.tipe, 'PIC ' || split_part(r.name, ' ', 1), '0812-0000-' || (2000 + r.dc * 10 + r.who), r.kota, r.nilai,
              case when r.dd is null then null else make_date(2026, 10, r.dd) end, 'dummy', r.sph, r.sumber,
              make_timestamptz(2026, 10, r.dc, 9, 0, 0, 'Asia/Jakarta'), make_timestamptz(2026, 10, r.dc, 9, 0, 0, 'Asia/Jakarta'), make_date(2026, 10, r.dc));
    end loop;

    update deal_transactions t set user_id = l.assigned_to from leads l where l.id = t.lead_id and l.org_id = o and l.source = 'dummy';
    update progress_notes p set user_id = l.assigned_to from leads l where l.id = p.lead_id and l.org_id = o and l.source = 'dummy';

    -- riwayat pindah tahap (dasar timeline harian di Report dan hitungan deal di tab Team)
    delete from lead_stage_changes where org_id = o and lead_id in (select id from leads where org_id = o and source = 'dummy');
    for r in select id, name, stage_key, assigned_to, created_at, deal_date from leads where org_id = o and source = 'dummy' loop
      if r.stage_key = 'no_deal' then
        insert into lead_stage_changes (org_id, lead_id, lead_name, from_stage, to_stage, changed_by, changed_at) values
          (o, r.id, r.name, 'data_masuk', 'sph_terlayang', r.assigned_to, least(r.created_at + interval '1 day', now())),
          (o, r.id, r.name, 'sph_terlayang', 'no_deal', r.assigned_to, least(r.created_at + interval '3 days', now()));
      else
        idx := array_position(ord, r.stage_key);
        if idx is not null and idx > 1 then
          for k in 2..idx loop
            at_ts := least(r.created_at + make_interval(days => k - 1), now());
            if k = idx and r.deal_date is not null and k >= 4 then at_ts := make_timestamptz(extract(year from r.deal_date)::int, extract(month from r.deal_date)::int, extract(day from r.deal_date)::int, 12, 0, 0, 'Asia/Jakarta'); end if;
            insert into lead_stage_changes (org_id, lead_id, lead_name, from_stage, to_stage, changed_by, changed_at)
            values (o, r.id, r.name, ord[k - 1], ord[k], r.assigned_to, at_ts);
          end loop;
        end if;
      end if;
    end loop;

    -- catatan harian tiap marketing (aktivitas di tab Team)
    insert into progress_notes (user_id, org_id, lead_id, note_date, text, created_at)
    select x.assigned_to, o, x.id, make_date(2026, 10, d), 'Follow up lewat telepon dan WhatsApp, calon masih membandingkan harga.', make_timestamptz(2026, 10, d, 10 + (d % 5), 0, 0, 'Asia/Jakarta')
    from (select l.id, l.assigned_to, row_number() over (partition by l.assigned_to order by l.created_at) rn from leads l where l.org_id = o and l.source = 'dummy') x
    cross join generate_series(6, 8) d where x.rn <= 2;
  end if;

  -- 4. chat dummy: lead otomatis + percakapan tersimpan (bentuk sama dengan hasil webhook Cekat)
  n := 0;
  for m in select value as v from jsonb_array_elements(chats) loop
    continue when exists (select 1 from lead_conversations where org_id = o and contact_key = m.v->>'k');
    t0 := now() - make_interval(days => (m.v->>'d')::int, hours => 3);
    insert into leads (user_id, org_id, assigned_to, name, category, stage_key, phone, source, ad_campaign, next_action, last_contact, created_at, updated_at)
    values (ow, o, uid[(n % 5) + 1], upper(m.v->>'n'), 'Lainnya', 'data_masuk', m.v->>'p', m.v->>'src', m.v->>'c', 'Tindak lanjuti chat masuk',
            (t0 at time zone 'Asia/Jakarta')::date, t0, t0)
    returning id into lid;
    insert into progress_notes (user_id, org_id, lead_id, note_date, text, created_at)
    values (ow, o, lid, (t0 at time zone 'Asia/Jakarta')::date,
            'Chat masuk dari ' || (m.v->>'pl') || case when m.v->>'c' <> '' then ', kampanye ' || (m.v->>'c') else '' end || '. Pesan pertama: "' || left(m.v->'m'->0->>1, 200) || '"', t0);
    insert into lead_conversations (org_id, lead_id, platform, contact_key, contact_name, contact_phone, campaign, started_at, last_message_at, last_inbound_at, last_outbound_at)
    values (o, lid, m.v->>'pl', m.v->>'k', m.v->>'n', m.v->>'p', m.v->>'c', t0, t0 + make_interval(mins => jsonb_array_length(m.v->'m') * 4), t0, t0)
    returning id into cid;
    k := 0;
    for msg in select value from jsonb_array_elements(m.v->'m') loop
      insert into lead_messages (org_id, lead_id, conversation_id, direction, body, sender_name, sent_at)
      values (o, lid, cid, msg->>0, msg->>1, case when msg->>0 = 'in' then m.v->>'n' else 'AI Agent BSB' end, t0 + make_interval(mins => k * 4));
      k := k + 1;
    end loop;
    update lead_conversations c set last_message_at = (select max(sent_at) from lead_messages where conversation_id = cid),
      last_inbound_at = (select max(sent_at) from lead_messages where conversation_id = cid and direction = 'in'),
      last_outbound_at = (select max(sent_at) from lead_messages where conversation_id = cid and direction = 'out') where c.id = cid;
    n := n + 1;
  end loop;
end $$;

-- Ringkasan hasil (harus tampil 5 marketing dan 7 percakapan)
select s.community_display_name as marketing, count(l.id) as lead, count(*) filter (where l.stage_key in ('proyek_deal','deal_kontrak','proses_so','pengiriman')) as deal
from leads l join settings s on s.user_id = l.assigned_to
where l.org_id = '43a0f3e6-e4fd-4db1-ba75-26a6a8e8dbc0' group by 1 order by 2 desc;
