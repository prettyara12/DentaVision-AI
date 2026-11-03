-- Initial schema: docs/architecture.md §5. Every user table cascades from auth.users, so deleting an
-- account removes all of its rows (docs/security-privacy.md §3); Storage objects are removed by the server first.

-- ─── Tables ───────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'id' check (locale in ('id', 'en')),
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  -- Object path inside the private `scans` bucket. Pinned to the row's own prefix so a row can
  -- never point the server at another user's image when it signs a URL.
  image_path text not null,
  image_width int not null check (image_width > 0),
  image_height int not null check (image_height > 0),
  model_version text not null,
  detections jsonb not null check (jsonb_typeof(detections) = 'array'),
  heatmap_class_ids smallint[] not null
    check (0 <= all (heatmap_class_ids) and 30 >= all (heatmap_class_ids)), -- class ids 0..30 (class-catalog)
  insight jsonb,
  insight_locale text check (insight_locale in ('id', 'en')),
  insight_prompt_version text,
  source text not null check (source in ('upload', 'import')),
  constraint scans_image_path_own_prefix
    check (image_path = user_id::text || '/' || id::text || '/original.jpg')
);

create index scans_user_created_idx on public.scans (user_id, created_at desc);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scan_id uuid references public.scans on delete cascade, -- null = general chat
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chats_user_updated_idx on public.chats (user_id, updated_at desc);
create index chats_scan_idx on public.chats (scan_id);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.chats on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null check (length(content) <= 4000),
  created_at timestamptz not null default now()
);

create index chat_messages_chat_idx on public.chat_messages (chat_id, id);

create table public.usage_counters (
  subject text not null, -- 'u:{user_id}' or 'ip:{sha256(ip + salt)}'
  day date not null, -- WITA (Asia/Makassar) date, quotas reset at 00:00 WITA (PRD §7)
  kind text not null check (kind in ('scan', 'chat')),
  count int not null default 0,
  primary key (subject, day, kind)
);

-- ─── Row level security (docs/architecture.md §5.1) ───────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.usage_counters enable row level security;

-- profiles: rows come from the auth trigger; owners read and edit their own, never the id.
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

-- scans: owner reads, inserts, deletes. No update: the insight is written by the service role.
create policy "scans: owner reads" on public.scans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "scans: owner inserts" on public.scans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "scans: owner deletes" on public.scans
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke update on public.scans from anon, authenticated;

-- chats: owner only; a chat may only hang off the owner's own scan; only the title is editable.
create policy "chats: owner reads" on public.chats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chats: owner inserts" on public.chats
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      scan_id is null
      or exists (select 1 from public.scans s where s.id = scan_id and s.user_id = (select auth.uid()))
    )
  );
create policy "chats: owner updates" on public.chats
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chats: owner deletes" on public.chats
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke update on public.chats from anon, authenticated;
grant update (title) on public.chats to authenticated;

-- chat_messages: readable and appendable by the chat's owner; never edited; removed with the chat.
create policy "chat_messages: chat owner reads" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = (select auth.uid()))
  );
create policy "chat_messages: chat owner inserts" on public.chat_messages
  for insert to authenticated with check (
    exists (select 1 from public.chats c where c.id = chat_id and c.user_id = (select auth.uid()))
  );
revoke update, delete on public.chat_messages from anon, authenticated;

-- usage_counters: no policies and no grants; only consume_quota (service role) touches it.
revoke all on public.usage_counters from anon, authenticated;

-- ─── Functions & triggers ─────────────────────────────────────────────────────────────────

-- One unit of daily quota, atomically: the upsert row lock serialises concurrent calls, and the
-- conditional update means the count never passes `max`. Returns false once the limit is reached.
create function public.consume_quota(subject text, kind text, max int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with consumed as (
    insert into public.usage_counters as u (subject, day, kind, count)
    select consume_quota.subject, (now() at time zone 'Asia/Makassar')::date, consume_quota.kind, 1
    where consume_quota.max > 0
    on conflict (subject, day, kind) do update set count = u.count + 1
      where u.count < consume_quota.max
    returning 1
  )
  select exists (select 1 from consumed);
$$;

-- Supabase grants EXECUTE on new public functions to anon/authenticated by default; take it back.
revoke execute on function public.consume_quota(text, text, int) from public, anon, authenticated;
grant execute on function public.consume_quota(text, text, int) to service_role;

-- Every new auth user gets a profile; Google sign-in fills the name.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A new message moves its chat to the top of the history list.
create function public.touch_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;

revoke execute on function public.touch_chat() from public, anon, authenticated;

create trigger on_chat_message_created
  after insert on public.chat_messages
  for each row execute function public.touch_chat();

-- ─── Storage (docs/architecture.md §5.2) ──────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scans', 'scans', false, 5242880, array['image/jpeg', 'image/png']);

-- Only the canonical paths of docs/architecture.md §5.2, under the user's own prefix:
-- `{user_id}/{scan_id}/original.jpg` and `{user_id}/{scan_id}/heatmap-{0..30}.png`.
create function public.is_own_scan_object(name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select name ~ ('^' || (select auth.uid())::text
                 || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                 || '(original\.jpg|heatmap-([0-9]|[12][0-9]|30)\.png)$');
$$;

create policy "scans bucket: owner reads" on storage.objects
  for select to authenticated using (bucket_id = 'scans' and public.is_own_scan_object(name));
create policy "scans bucket: owner uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'scans' and public.is_own_scan_object(name));
create policy "scans bucket: owner deletes" on storage.objects
  for delete to authenticated using (bucket_id = 'scans' and public.is_own_scan_object(name));
