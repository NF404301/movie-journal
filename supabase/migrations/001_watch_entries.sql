begin;
create table public.watch_entries (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  record jsonb not null,
  revision uuid not null default gen_random_uuid(),
  primary key (owner_id, id),
  check (jsonb_typeof(record) = 'object' and record ?& array['id','title','date']
    and record->>'id' = id and jsonb_typeof(record->'title') = 'string'
    and jsonb_typeof(record->'date') = 'string')
);
alter table public.watch_entries enable row level security;
revoke all on public.watch_entries from public, anon, authenticated;
grant select, insert, update, delete on public.watch_entries to authenticated;
create policy own_entries on public.watch_entries for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;
