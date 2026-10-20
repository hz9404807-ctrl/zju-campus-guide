-- Incremental favorites rollout, after 202610130001_food_email_management.sql.
-- Does not require the deferred profile migration, alter food data or change Auth.
begin;

create function campus_private.valid_favorite_target(p_kind text, p_id text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_kind in ('guide', 'website') and p_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$'
    or p_kind = 'food' and p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false);
$$;
create function campus_private.valid_favorite_context(p_kind text, p_context jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item record;
begin
  if p_context is null or pg_catalog.jsonb_typeof(p_context) <> 'object'
    or pg_catalog.octet_length(p_context::text) > 512 then return false; end if;
  for item in select key, value from pg_catalog.jsonb_each(p_context) loop
    if pg_catalog.jsonb_typeof(item.value) <> 'string' then return false; end if;
    if item.key = 'route' and p_kind = 'guide' then
      if (item.value #>> '{}') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' then return false; end if;
    elsif item.key = 'campus' then
      if (item.value #>> '{}') !~ '^[A-Za-z0-9_一-鿿 -]{1,32}$' then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function campus_private.valid_favorite_target(text,text), campus_private.valid_favorite_context(text,jsonb) from public, anon, authenticated;

create table public.campus_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint campus_favorites_pk primary key (user_id, target_kind, target_id),
  constraint campus_favorites_target_valid check (campus_private.valid_favorite_target(target_kind,target_id)),
  constraint campus_favorites_context_valid check (campus_private.valid_favorite_context(target_kind,context))
);
create index campus_favorites_user_created_idx on public.campus_favorites(user_id,created_at desc);
alter table public.campus_favorites enable row level security;
revoke all on table public.campus_favorites from public, anon, authenticated;
grant select, delete on table public.campus_favorites to authenticated;
grant all on table public.campus_favorites to service_role;
create policy campus_favorites_read_own on public.campus_favorites for select to authenticated
using (user_id = (select auth.uid()) and (select campus_private.is_campus_member()));
create policy campus_favorites_delete_own on public.campus_favorites for delete to authenticated
using (user_id = (select auth.uid()) and (select campus_private.is_campus_member()));
-- Ordinary clients cannot write a supplied owner, alter timestamps or bypass the
-- target/context checks. Mutations below take identity solely from auth.uid().

create function public.list_my_campus_favorites()
returns table (target_kind text, target_id text, context jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform campus_private.require_campus_member();
  return query select f.target_kind, f.target_id, f.context, f.created_at
    from public.campus_favorites f where f.user_id = (select auth.uid())
    order by f.created_at desc, f.target_kind, f.target_id;
end;
$$;

create function public.save_my_campus_favorite(p_target_kind text, p_target_id text, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform campus_private.require_campus_member();
  if not campus_private.valid_favorite_target(p_target_kind,p_target_id)
    or not campus_private.valid_favorite_context(p_target_kind,p_context) then
    raise exception using errcode='23514',message='Invalid favorite target or context.';
  end if;
  if p_target_kind = 'food' then
    -- Lock the current public row against concurrent withdrawal until this save
    -- finishes. Future withdrawal keeps only this identifier, never a snapshot.
    perform 1 from public.foods f where f.id = p_target_id::uuid and f.deleted_at is null for share;
    if not found then raise exception using errcode='P0002',message='Food is not publicly available.'; end if;
  end if;
  insert into public.campus_favorites(user_id,target_kind,target_id,context)
    values(auth.uid(),p_target_kind,p_target_id,p_context)
    on conflict (user_id,target_kind,target_id) do update set context=excluded.context;
end;
$$;

create function public.remove_my_campus_favorite(p_target_kind text, p_target_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform campus_private.require_campus_member();
  if not campus_private.valid_favorite_target(p_target_kind,p_target_id) then
    raise exception using errcode='23514',message='Invalid favorite target.';
  end if;
  delete from public.campus_favorites f where f.user_id = (select auth.uid())
    and f.target_kind=p_target_kind and f.target_id=p_target_id;
end;
$$;
revoke all on function public.list_my_campus_favorites(), public.save_my_campus_favorite(text,text,jsonb), public.remove_my_campus_favorite(text,text) from public, anon, authenticated;
grant execute on function public.list_my_campus_favorites(), public.save_my_campus_favorite(text,text,jsonb), public.remove_my_campus_favorite(text,text) to authenticated;
comment on table public.campus_favorites is 'Private Auth-owner favorites. Stores configured target IDs and limited route/campus identifiers only, never food snapshots or arbitrary URLs.';
notify pgrst, 'reload schema';
commit;
