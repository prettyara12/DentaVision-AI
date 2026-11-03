-- consume_quota (docs/architecture.md §5): service role only, never past `max`, per subject/day/kind.
begin;
select plan(12);

select ok(not has_function_privilege('anon', 'public.consume_quota(text, text, integer)', 'execute'),
          'anon cannot execute consume_quota');
select ok(not has_function_privilege('authenticated', 'public.consume_quota(text, text, integer)', 'execute'),
          'authenticated cannot execute consume_quota');
select ok(has_function_privilege('service_role', 'public.consume_quota(text, text, integer)', 'execute'),
          'service_role can execute consume_quota');

set local role authenticated;
select throws_ok($$select public.consume_quota('u:self', 'scan', 1000)$$, '42501', null,
                 'a signed-in user calling it directly is refused');
reset role;

set local role service_role;
select is(public.consume_quota('ip:test', 'scan', 2), true, 'first unit of a limit of 2 is granted');
select is(public.consume_quota('ip:test', 'scan', 2), true, 'second unit is granted');
select is(public.consume_quota('ip:test', 'scan', 2), false, 'third unit is refused');
select is(public.consume_quota('ip:test', 'chat', 2), true, 'chat quota is counted apart from scan quota');
select is(public.consume_quota('ip:other', 'scan', 2), true, 'another subject has its own count');
select is(public.consume_quota('ip:zero', 'scan', 0), false, 'a limit of 0 grants nothing');
select throws_ok($$select public.consume_quota('ip:test', 'insight', 2)$$, '23514', null,
                 'unknown kinds are rejected');
reset role;

select is(
  (select count from public.usage_counters
   where subject = 'ip:test' and kind = 'scan' and day = (now() at time zone 'Asia/Makassar')::date),
  2, 'the stored count stops at the limit, on today''s WITA date');

select * from finish();
rollback;
