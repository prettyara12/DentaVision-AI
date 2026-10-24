-- Guard for every future migration: no table in `public` may exist without RLS.
begin;
select plan(1);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
