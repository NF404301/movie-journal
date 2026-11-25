-- Run in one transaction after verifying a backup of watch_entries.
lock table public.watch_entries in share row exclusive mode;
with source as (
  select owner_id, id, record,
    case when nullif(record->>'tmdbId','') is not null then
      'tmdb:' || coalesce(nullif(record->>'kind',''),'电影') || ':' || (record->>'tmdbId')
    else 'manual:' || id end as movie_id,
    array['title','kind','tmdbId','year','poster','overview','overviewLanguage','originalTitle','genres','runtime','aliases'] as keys
  from public.watch_entries
), split as (
  select s.*, (select jsonb_object_agg(k,record->k) from unnest(keys) k where record ? k)
    || jsonb_build_object('id',movie_id) as movie
  from source s
), grouped as (
  select *,first_value(movie) over (partition by owner_id,movie_id order by id) as primary_movie
  from split
)
insert into public.journal_archives(owner_id,archive)
select owner_id,jsonb_build_object('schema_version',2,'exported_at',now(),
  'movies',jsonb_agg(distinct primary_movie),
  'viewings',jsonb_agg((record-keys) || jsonb_build_object('movie_id',movie_id)
    || case when movie=primary_movie then '{}'::jsonb else jsonb_build_object('source_metadata',movie) end order by id))
from grouped group by owner_id;

do $$
begin
  if exists (
    with restored as (
      select a.owner_id,v->>'id' as id,
        (m || coalesce(v->'source_metadata','{}'::jsonb) || v) - array['source_metadata','movie_id'] as record
      from public.journal_archives a
      cross join lateral jsonb_array_elements(a.archive->'viewings') v
      join lateral jsonb_array_elements(a.archive->'movies') m on m->>'id'=v->>'movie_id'
    )
    select 1 from public.watch_entries w full join restored r using(owner_id,id)
    where w.record is distinct from r.record
  ) then raise exception 'Archive verification failed'; end if;
end $$;
-- Older tabs must refresh before saving after the cutover.
revoke insert,update,delete on public.watch_entries from authenticated;
