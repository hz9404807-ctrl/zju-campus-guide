-- One verified Auth user owns up to five posting profiles. Ratings stay per Auth user.
-- Additive migration after email management. No existing foods/ratings are deleted.
begin;
create table public.food_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  slot smallint not null check(slot between 1 and 5),
  name text not null check(char_length(btrim(name)) between 1 and 24 and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  unique(user_id,slot), unique(id,user_id)
);
create unique index food_profiles_owner_name on public.food_profiles(user_id,lower(name));
alter table public.food_profiles enable row level security;
revoke all on public.food_profiles from public,anon,authenticated;
grant select on public.food_profiles to authenticated;
create policy profiles_owner_read on public.food_profiles for select to authenticated
using (user_id=(select auth.uid()) and (select campus_private.is_campus_member()));

alter table public.foods add column profile_id uuid;
alter table public.foods add constraint foods_profile_owner_fk
foreign key(profile_id,created_by) references public.food_profiles(id,user_id);
create index foods_profile_created on public.foods(profile_id,created_at desc);

create function public.ensure_default_food_profile() returns uuid
language plpgsql security definer set search_path='' as $$
declare v_profile uuid;
begin
  perform campus_private.require_campus_member();
  -- The same owner-row lock serializes default initialization and profile creation.
  perform 1 from auth.users where id=auth.uid() for update;
  select id into v_profile from public.food_profiles where user_id=auth.uid() and slot=1;
  if v_profile is null then
    insert into public.food_profiles(user_id,slot,name) values(auth.uid(),1,'默认档案') returning id into v_profile;
  end if;
  -- Only this caller's original/legacy publications are assigned; timestamps and ratings stay intact.
  update public.foods set profile_id=v_profile where created_by=auth.uid() and profile_id is null;
  return v_profile;
end;
$$;
create function public.create_food_profile(p_name text,p_expected_user uuid default auth.uid()) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_slot smallint; v_profile uuid; v_name text:=btrim(p_name);
begin
  -- Reject a request started before the browser switched to another account.
  if p_expected_user is distinct from auth.uid() then
    raise exception using errcode='42501',message='Authenticated account changed.';
  end if;
  perform public.ensure_default_food_profile();
  if v_name is null or char_length(v_name) not between 1 and 24 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode='23514',message='Invalid profile name.';
  end if;
  select s into v_slot from pg_catalog.generate_series(1,5) s
    where not exists(select 1 from public.food_profiles p where p.user_id=auth.uid() and p.slot=s) order by s limit 1;
  if v_slot is null then raise exception using errcode='P0001',message='PROFILE_LIMIT'; end if;
  insert into public.food_profiles(user_id,slot,name) values(auth.uid(),v_slot,v_name) returning id into v_profile;
  return v_profile;
end;
$$;
revoke all on function public.ensure_default_food_profile(),public.create_food_profile(text,uuid) from public,anon;
grant execute on function public.ensure_default_food_profile(),public.create_food_profile(text,uuid) to authenticated;

create function campus_private.require_food_profile(p_profile_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_campus_member();
  if p_profile_id is null or not exists(select 1 from public.food_profiles where id=p_profile_id and user_id=auth.uid()) then
    raise exception using errcode='42501',message='Not the profile owner.';
  end if;
end;
$$;
create function campus_private.require_profile_food(p_profile_id uuid,p_food_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_food_profile(p_profile_id);
  perform 1 from public.foods where id=p_food_id and created_by=auth.uid() and profile_id=p_profile_id for update;
  if not found then raise exception using errcode='42501',message='Publication belongs to another profile.'; end if;
end;
$$;
create function campus_private.require_legacy_food(p_food_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_campus_member();
  perform 1 from public.foods f where f.id=p_food_id and f.created_by=auth.uid()
    and (f.profile_id is null or exists(select 1 from public.food_profiles p where p.id=f.profile_id and p.user_id=auth.uid() and p.slot=1)) for update;
  if not found then raise exception using errcode='42501',message='Use the publication profile to manage this food.'; end if;
end;
$$;
revoke all on function campus_private.require_food_profile(uuid),
  campus_private.require_profile_food(uuid,uuid),campus_private.require_legacy_food(uuid) from public,anon,authenticated;

-- Move existing management implementations to private schema so old and new RPCs share the same validation.
alter function public.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]) set schema campus_private;
alter function public.set_own_food_deleted(uuid,timestamptz,boolean) set schema campus_private;
revoke all on function campus_private.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  campus_private.set_own_food_deleted(uuid,timestamptz,boolean) from public,anon,authenticated;

create function public.update_own_food(
  p_food_id uuid,p_expected_updated_at timestamptz,p_name text,p_location text,p_area text,p_category text,
  p_price numeric,p_image_url text,p_description text,p_tags text[]
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_legacy_food(p_food_id);
  perform campus_private.update_own_food(p_food_id,p_expected_updated_at,p_name,p_location,p_area,p_category,p_price,p_image_url,p_description,p_tags);
end;
$$;
create function public.set_own_food_deleted(p_food_id uuid,p_expected_updated_at timestamptz,p_deleted boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_legacy_food(p_food_id);
  perform campus_private.set_own_food_deleted(p_food_id,p_expected_updated_at,p_deleted);
end;
$$;

create or replace function public.create_food_with_rating(
  p_name text,p_location text,p_area text,p_category text,p_price numeric,
  p_image_url text,p_description text,p_tags text[],p_rating integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_profile uuid; v_food uuid;
begin
  if campus_private.is_campus_member() then v_profile:=public.ensure_default_food_profile();
  elsif coalesce((select require_email from campus_private.food_auth_settings where singleton),true) then
    perform campus_private.require_campus_member();
  end if;
  v_food:=campus_private.create_food_with_rating(p_name,p_location,p_area,p_category,p_price,p_image_url,p_description,p_tags,p_rating);
  if v_profile is not null then update public.foods set profile_id=v_profile where id=v_food; end if;
  return v_food;
end;
$$;

create function public.create_food_in_profile(
  p_profile_id uuid,p_name text,p_location text,p_area text,p_category text,p_price numeric,
  p_image_url text,p_description text,p_tags text[],p_rating integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_food uuid;
begin
  perform campus_private.require_food_profile(p_profile_id);
  v_food:=campus_private.create_food_with_rating(p_name,p_location,p_area,p_category,p_price,p_image_url,p_description,p_tags,p_rating);
  update public.foods set profile_id=p_profile_id where id=v_food;
  return v_food;
end;
$$;
create function public.update_profile_food(
  p_profile_id uuid,p_food_id uuid,p_expected_updated_at timestamptz,p_name text,p_location text,p_area text,p_category text,
  p_price numeric,p_image_url text,p_description text,p_tags text[]
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_profile_food(p_profile_id,p_food_id);
  perform campus_private.update_own_food(p_food_id,p_expected_updated_at,p_name,p_location,p_area,p_category,p_price,p_image_url,p_description,p_tags);
end;
$$;
create function public.set_profile_food_deleted(p_profile_id uuid,p_food_id uuid,p_expected_updated_at timestamptz,p_deleted boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform campus_private.require_profile_food(p_profile_id,p_food_id);
  perform campus_private.set_own_food_deleted(p_food_id,p_expected_updated_at,p_deleted);
end;
$$;
revoke all on function public.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_own_food_deleted(uuid,timestamptz,boolean),
  public.create_food_in_profile(uuid,text,text,text,text,numeric,text,text,text[],integer),
  public.update_profile_food(uuid,uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_profile_food_deleted(uuid,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_own_food_deleted(uuid,timestamptz,boolean),
  public.create_food_in_profile(uuid,text,text,text,text,numeric,text,text,text[],integer),
  public.update_profile_food(uuid,uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_profile_food_deleted(uuid,uuid,timestamptz,boolean) to authenticated;

create or replace view public.food_summaries with (security_invoker=true) as
select f.id,f.name,f.location,f.area,f.category,f.price,f.image_url,f.description,f.tags,f.created_by,f.created_at,
  s.average_rating,coalesce(s.rating_count,0)::integer as rating_count,f.updated_at,f.deleted_at,f.profile_id
from public.foods f left join (
  select food_id,round(avg(rating),1) as average_rating,count(*)::integer as rating_count from public.ratings group by food_id
) s on s.food_id=f.id;
notify pgrst,'reload schema';
commit;
