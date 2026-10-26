-- Private `scans` bucket, objects reachable only under the user's own prefix (docs/architecture.md §5.2).
begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

select ok((select not public from storage.buckets where id = 'scans'), 'the scans bucket is private');

insert into storage.objects (bucket_id, name) values
  ('scans', '22222222-2222-2222-2222-222222222222/bbbbbbbb-0000-0000-0000-000000000001/original.jpg');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('scans', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/original.jpg')
$$, 'a user uploads under their own prefix');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('scans', '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000001/original.jpg')
$$, '42501', null, 'a user cannot upload under another user''s prefix');
select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('scans', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/heatmap-30.png')
$$, 'a user uploads a heatmap under the canonical name');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('scans', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/notes.txt')
$$, '42501', null, 'any other file name under the own prefix is refused');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('scans', '11111111-1111-1111-1111-111111111111/not-a-scan-id/original.jpg')
$$, '42501', null, 'a path without a scan id is refused');
select is((select count(*)::int from storage.objects where bucket_id = 'scans'), 2,
          'a user lists only their own objects');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*)::int from storage.objects where bucket_id = 'scans'), 0,
          'anon lists no objects');

select * from finish();
rollback;
