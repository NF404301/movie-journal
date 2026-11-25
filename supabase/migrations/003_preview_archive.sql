create table public.journal_archives (
 owner_id uuid primary key default auth.uid() references auth.users(id),
 archive jsonb not null check (archive->>'schema_version' = '2' and jsonb_typeof(archive->'viewings')='array' and jsonb_typeof(archive->'movies')='array' and octet_length(archive::text)<=16000000),
 revision uuid not null default gen_random_uuid()
);
alter table public.journal_archives enable row level security;
revoke all on public.journal_archives from public,anon,authenticated;
grant select, insert, update on public.journal_archives to authenticated;
create policy owner_archive on public.journal_archives to authenticated
using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
