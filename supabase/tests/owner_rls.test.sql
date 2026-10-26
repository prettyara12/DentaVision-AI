-- RLS per table (docs/architecture.md §5.1), the profile trigger, and cascade on account delete.
-- Synthetic users only: A = 1111…, B = 2222….
begin;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test', '{"full_name": "Pasien A"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test', '{}');

-- B's data, written as the table owner (like the service role would).
insert into public.scans (id, user_id, image_path, image_width, image_height, model_version, detections, heatmap_class_ids, source)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222/bbbbbbbb-0000-0000-0000-000000000001/original.jpg',
        2000, 1000, 'test', '[]', '{}', 'upload');
insert into public.chats (id, user_id, scan_id, title)
values ('bbbbbbbb-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-0000-0000-0000-000000000001', 'B chat');
insert into public.chat_messages (chat_id, role, content)
values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'user', 'B question');

-- ─── profiles ─────────────────────────────────────────────────────────────────────────────
select is((select count(*)::int from public.profiles), 2, 'the auth trigger creates a profile per user');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
          'Pasien A', 'the profile takes the name from sign-up metadata');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'profiles: a user sees only their own');
select lives_ok($$update public.profiles set display_name = 'A baru', locale = 'en'$$, 'profiles: owner edits name and locale');
select throws_ok($$update public.profiles set id = '33333333-3333-3333-3333-333333333333'$$, '42501', null, 'profiles: id is not editable');
select throws_ok($$insert into public.profiles (id) values ('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'profiles: users cannot insert');

-- ─── scans ────────────────────────────────────────────────────────────────────────────────
select lives_ok($$
  insert into public.scans (id, user_id, image_path, image_width, image_height, model_version, detections, heatmap_class_ids, source)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/original.jpg',
          2000, 1000, 'test', '[]', '{0}', 'upload')
$$, 'scans: owner inserts a scan');
select throws_ok($$
  insert into public.scans (id, user_id, image_path, image_width, image_height, model_version, detections, heatmap_class_ids, source)
  values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
          '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000002/original.jpg',
          2000, 1000, 'test', '[]', '{}', 'upload')
$$, '42501', null, 'scans: cannot insert a scan for another user');
select throws_ok($$
  insert into public.scans (id, user_id, image_path, image_width, image_height, model_version, detections, heatmap_class_ids, source)
  values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222/bbbbbbbb-0000-0000-0000-000000000001/original.jpg',
          2000, 1000, 'test', '[]', '{}', 'upload')
$$, '23514', null, 'scans: image_path must sit under the row''s own prefix');
select is((select count(*)::int from public.scans), 1, 'scans: a user sees only their own');
select throws_ok($$update public.scans set model_version = 'x'$$, '42501', null, 'scans: users cannot update (insight is written by the service role)');
select lives_ok($$delete from public.scans where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, 'scans: deleting another user''s scan runs');

-- ─── chats ────────────────────────────────────────────────────────────────────────────────
select lives_ok($$
  insert into public.chats (id, user_id, scan_id, title) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'A scan chat'),
    ('aaaaaaaa-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', null, 'A general chat')
$$, 'chats: owner creates a scan chat and a general chat');
select throws_ok($$
  insert into public.chats (user_id, scan_id, title)
  values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'hijack')
$$, '42501', null, 'chats: cannot attach a chat to another user''s scan');
select is((select count(*)::int from public.chats), 2, 'chats: a user sees only their own');
select lives_ok($$update public.chats set title = 'Renamed' where id = 'aaaaaaaa-0000-0000-0000-0000000000c2'$$, 'chats: owner renames');
select throws_ok($$update public.chats set scan_id = null$$, '42501', null, 'chats: only the title is editable');

-- ─── chat_messages ────────────────────────────────────────────────────────────────────────
select lives_ok($$
  insert into public.chat_messages (chat_id, role, content) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'user', 'Apa itu karies?')
$$, 'chat_messages: chat owner appends');
select throws_ok($$
  insert into public.chat_messages (chat_id, role, content) values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'user', 'injected')
$$, '42501', null, 'chat_messages: cannot write into another user''s chat');
select is((select count(*)::int from public.chat_messages), 1, 'chat_messages: a user sees only messages of their own chats');
select throws_ok($$update public.chat_messages set content = 'edited'$$, '42501', null, 'chat_messages: messages are never edited');
select throws_ok($$
  insert into public.chat_messages (chat_id, role, content) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'user', repeat('x', 4001))
$$, '23514', null, 'chat_messages: content is capped at 4000 characters');

-- ─── usage_counters & anon ────────────────────────────────────────────────────────────────
select throws_ok($$select * from public.usage_counters$$, '42501', null, 'usage_counters: closed to authenticated users');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*)::int from public.scans) + (select count(*)::int from public.chats)
          + (select count(*)::int from public.profiles), 0, 'anon sees no user data');
select throws_ok($$select * from public.usage_counters$$, '42501', null, 'usage_counters: closed to anon');

-- ─── checks as the table owner ────────────────────────────────────────────────────────────
reset role;
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
          'A baru', 'the owner''s profile edit was applied');
select ok(exists (select 1 from public.scans where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
          'B''s scan survives A''s delete attempt');

-- A new message moves its chat to the top of the list.
update public.chats set updated_at = '2000-01-01' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
insert into public.chat_messages (chat_id, role, content) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'model', 'Jawaban');
select ok((select updated_at > '2000-01-01' from public.chats where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'),
          'a new message bumps chats.updated_at');

-- ─── cascade on account delete (docs/security-privacy.md §3) ──────────────────────────────
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.scans where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.chats where user_id = '11111111-1111-1111-1111-111111111111'),
  0, 'deleting the account removes its profile, scans, and chats');
select is((select count(*)::int from public.chat_messages where chat_id in
            ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2')),
          0, 'and the messages of those chats');
select is((select count(*)::int from public.chat_messages), 1, 'other users'' data stays');

select * from finish();
rollback;
