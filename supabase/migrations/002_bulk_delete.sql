create function public.delete_selected_entries(items jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) < 1 then
    raise exception 'Invalid selection';
  end if;
  delete from public.watch_entries e using jsonb_to_recordset(items) as s(id text, revision uuid)
    where e.owner_id = auth.uid() and e.id = s.id and e.revision = s.revision;
  get diagnostics affected = row_count;
  if affected <> jsonb_array_length(items) then raise exception 'Selection changed'; end if;
end;
$$;
revoke all on function public.delete_selected_entries(jsonb) from public, anon;
grant execute on function public.delete_selected_entries(jsonb) to authenticated;
