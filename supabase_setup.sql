-- AX Sprint Control Tower v18 - Supabase setup
-- Run once in Supabase Dashboard > SQL Editor.
-- IMPORTANT: Do not publish this file in a public GitHub repository because it contains the administrator PIN.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.ax_app_config (
  id integer primary key check (id = 1),
  admin_pin text not null
);

insert into private.ax_app_config (id, admin_pin)
values (1, '0000')
on conflict (id) do update set admin_pin = excluded.admin_pin;

create table if not exists public.ax_project_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ax_project_state enable row level security;

drop policy if exists "AX public read" on public.ax_project_state;
create policy "AX public read"
on public.ax_project_state
for select
to anon, authenticated
using (id = 'main');

-- No direct INSERT/UPDATE/DELETE policy is created.
-- Administrator writes are only allowed through the PIN-checked RPC below.

create or replace function public.ax_verify_admin_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from private.ax_app_config
    where id = 1 and admin_pin = p_pin
  );
$$;

create or replace function public.ax_admin_save_state(p_pin text, p_state jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_now timestamptz := now();
begin
  if not public.ax_verify_admin_pin(p_pin) then
    raise exception 'invalid administrator pin' using errcode = '42501';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state payload';
  end if;

  insert into public.ax_project_state(id, state, updated_at)
  values ('main', p_state, v_now)
  on conflict (id) do update
    set state = excluded.state,
        updated_at = excluded.updated_at;

  return v_now;
end;
$$;

create or replace function public.ax_portal_reply_request(
  p_request_id text,
  p_institution text,
  p_response text,
  p_response_date text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_requests jsonb;
  v_found boolean := false;
begin
  if p_institution not in ('정션메드','경복대학교','돌봄과 미래','에임랩') then
    raise exception 'invalid institution';
  end if;
  if coalesce(trim(p_response),'') = '' then
    raise exception 'response is required';
  end if;

  select state into v_state
  from public.ax_project_state
  where id = 'main'
  for update;

  if v_state is null then
    raise exception 'project state is not initialized';
  end if;

  select
    coalesce(jsonb_agg(
      case
        when item->>'id' = p_request_id and item->>'to' = p_institution then
          item || jsonb_build_object(
            'response', p_response,
            'responseDate', coalesce(p_response_date, current_date::text),
            'status', '답변 완료'
          )
        else item
      end
    ), '[]'::jsonb),
    coalesce(bool_or(item->>'id' = p_request_id and item->>'to' = p_institution), false)
  into v_requests, v_found
  from jsonb_array_elements(coalesce(v_state->'requests','[]'::jsonb)) as item;

  if not v_found then
    raise exception 'request not found for institution';
  end if;

  v_state := jsonb_set(v_state, '{requests}', v_requests, true);
  update public.ax_project_state set state=v_state, updated_at=now() where id='main';
  return true;
end;
$$;

create or replace function public.ax_portal_add_memo(
  p_memo_id text,
  p_institution text,
  p_title text,
  p_text text,
  p_date text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_memos jsonb;
  v_exists boolean;
  v_memo jsonb;
begin
  if p_institution not in ('정션메드','경복대학교','돌봄과 미래','에임랩') then
    raise exception 'invalid institution';
  end if;
  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_text),'') = '' then
    raise exception 'title and text are required';
  end if;

  select state into v_state from public.ax_project_state where id='main' for update;
  if v_state is null then raise exception 'project state is not initialized'; end if;

  select exists(
    select 1 from jsonb_array_elements(coalesce(v_state->'memos','[]'::jsonb)) m
    where m->>'id'=p_memo_id
  ) into v_exists;
  if v_exists then raise exception 'memo id already exists'; end if;

  v_memo := jsonb_build_object(
    'id', p_memo_id,
    'title', p_title,
    'institution', p_institution,
    'relatedAction', '',
    'status', '진행',
    'messages', jsonb_build_array(jsonb_build_object(
      'authorInstitution', p_institution,
      'date', coalesce(p_date,current_date::text),
      'text', p_text
    ))
  );
  v_memos := coalesce(v_state->'memos','[]'::jsonb) || jsonb_build_array(v_memo);
  v_state := jsonb_set(v_state,'{memos}',v_memos,true);
  update public.ax_project_state set state=v_state, updated_at=now() where id='main';
  return true;
end;
$$;

create or replace function public.ax_portal_reply_memo(
  p_memo_id text,
  p_institution text,
  p_text text,
  p_date text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_memos jsonb;
  v_found boolean := false;
  v_message jsonb;
begin
  if p_institution not in ('정션메드','경복대학교','돌봄과 미래','에임랩') then
    raise exception 'invalid institution';
  end if;
  if coalesce(trim(p_text),'') = '' then raise exception 'text is required'; end if;

  select state into v_state from public.ax_project_state where id='main' for update;
  if v_state is null then raise exception 'project state is not initialized'; end if;

  v_message := jsonb_build_object(
    'authorInstitution', p_institution,
    'date', coalesce(p_date,current_date::text),
    'text', p_text
  );

  select
    coalesce(jsonb_agg(
      case
        when item->>'id'=p_memo_id and item->>'institution'=p_institution then
          jsonb_set(item,'{messages}',coalesce(item->'messages','[]'::jsonb) || jsonb_build_array(v_message),true)
        else item
      end
    ),'[]'::jsonb),
    coalesce(bool_or(item->>'id'=p_memo_id and item->>'institution'=p_institution),false)
  into v_memos, v_found
  from jsonb_array_elements(coalesce(v_state->'memos','[]'::jsonb)) as item;

  if not v_found then raise exception 'memo not found for institution'; end if;

  v_state := jsonb_set(v_state,'{memos}',v_memos,true);
  update public.ax_project_state set state=v_state, updated_at=now() where id='main';
  return true;
end;
$$;

revoke all on function public.ax_verify_admin_pin(text) from public;
revoke all on function public.ax_admin_save_state(text,jsonb) from public;
revoke all on function public.ax_portal_reply_request(text,text,text,text) from public;
revoke all on function public.ax_portal_add_memo(text,text,text,text,text) from public;
revoke all on function public.ax_portal_reply_memo(text,text,text,text) from public;

grant execute on function public.ax_verify_admin_pin(text) to anon, authenticated;
grant execute on function public.ax_admin_save_state(text,jsonb) to anon, authenticated;
grant execute on function public.ax_portal_reply_request(text,text,text,text) to anon, authenticated;
grant execute on function public.ax_portal_add_memo(text,text,text,text,text) to anon, authenticated;
grant execute on function public.ax_portal_reply_memo(text,text,text,text) to anon, authenticated;

grant select on public.ax_project_state to anon, authenticated;

commit;
