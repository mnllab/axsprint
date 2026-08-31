-- AX Sprint Control Tower v19 - communication update
-- Existing v18 users: run this once in Supabase Dashboard > SQL Editor.

create or replace function public.ax_portal_create_request(
  p_request_id text,
  p_from_institution text,
  p_to_institution text,
  p_title text,
  p_content text,
  p_requested_at text,
  p_due text,
  p_related_action text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_requests jsonb;
  v_exists boolean;
  v_request jsonb;
begin
  if p_from_institution not in ('정션메드','경복대학교','돌봄과 미래','에임랩') then
    raise exception 'invalid sender institution';
  end if;
  if p_to_institution not in ('정션메드','경복대학교','돌봄과 미래','에임랩') then
    raise exception 'invalid receiver institution';
  end if;
  if p_from_institution = p_to_institution then
    raise exception 'sender and receiver must differ';
  end if;
  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_content),'') = '' then
    raise exception 'title and content are required';
  end if;

  select state into v_state
  from public.ax_project_state
  where id='main'
  for update;

  if v_state is null then
    raise exception 'project state is not initialized';
  end if;

  select exists(
    select 1
    from jsonb_array_elements(coalesce(v_state->'requests','[]'::jsonb)) r
    where r->>'id'=p_request_id
  ) into v_exists;
  if v_exists then
    raise exception 'request id already exists';
  end if;

  v_request := jsonb_build_object(
    'id', p_request_id,
    'title', p_title,
    'from', p_from_institution,
    'to', p_to_institution,
    'content', p_content,
    'requestedAt', coalesce(nullif(p_requested_at,''),current_date::text),
    'due', coalesce(p_due,''),
    'status', '요청',
    'response', '',
    'responseDate', '',
    'confirmation', '',
    'relatedAction', coalesce(p_related_action,'')
  );

  v_requests := coalesce(v_state->'requests','[]'::jsonb) || jsonb_build_array(v_request);
  v_state := jsonb_set(v_state,'{requests}',v_requests,true);
  update public.ax_project_state set state=v_state, updated_at=now() where id='main';
  return true;
end;
$$;

revoke all on function public.ax_portal_create_request(text,text,text,text,text,text,text,text) from public;
grant execute on function public.ax_portal_create_request(text,text,text,text,text,text,text,text) to anon, authenticated;
