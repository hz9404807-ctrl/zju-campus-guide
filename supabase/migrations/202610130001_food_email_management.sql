-- Additive rollout. Apply after the initial migration; enable email-only creation
-- only after SMTP, email binding and the new frontend have been verified.
begin;
alter table public.foods add column updated_at timestamptz not null default now();
alter table public.foods add column deleted_at timestamptz;
create table campus_private.food_auth_settings (
  singleton boolean primary key default true check (singleton),
  require_email boolean not null default false
);
insert into campus_private.food_auth_settings(singleton) values (true);
revoke all on table campus_private.food_auth_settings from public, anon, authenticated;

-- Canonical verified identity, not client metadata or a supplied author ID.
create function campus_private.is_campus_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.role() = 'authenticated' and exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.is_anonymous is false and u.email_confirmed_at is not null
      and pg_catalog.lower(u.email) ~ '^[^[:space:]@]+@zju[.]edu[.]cn$'
  );
$$;
revoke all on function campus_private.is_campus_member() from public;
grant usage on schema campus_private to anon;
grant execute on function campus_private.is_campus_member() to anon, authenticated;

-- Cover creation, anonymous binding AND later email changes. Anonymous browsing
-- remains possible. Test this against Auth before enabling a production rollout.
create function campus_private.guard_campus_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from pg_catalog.unnest(array[new.email,new.email_change]) e
    where e is not null and e <> '' and pg_catalog.lower(e) !~ '^[^[:space:]@]+@zju[.]edu[.]cn$') then
    raise exception using errcode = '23514', message = 'Only zju.edu.cn email addresses are supported.';
  end if;
  return new;
end;
$$;
revoke all on function campus_private.guard_campus_email() from public, anon, authenticated;
create trigger campus_email_domain before insert or update of email,email_change on auth.users
for each row execute function campus_private.guard_campus_email();

create function campus_private.require_campus_member() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not campus_private.is_campus_member() then
    raise exception using errcode = '42501', message = 'A verified campus email is required.';
  end if;
end;
$$;
revoke all on function campus_private.require_campus_member() from public, anon, authenticated;

-- Only a verified owner can read their own removed record. Public readers cannot
-- obtain it by ID, summary view, direct foods API or the ratings API.
drop policy foods_public_read on public.foods;
create policy foods_public_read on public.foods for select to anon, authenticated
using (deleted_at is null or (created_by = (select auth.uid()) and (select campus_private.is_campus_member())));
drop policy ratings_public_read on public.ratings;
create policy ratings_public_read on public.ratings for select to anon, authenticated
using (exists(select 1 from public.foods f where f.id = food_id and f.deleted_at is null));
drop policy ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings for insert to authenticated
with check (user_id = (select auth.uid()) and exists(select 1 from public.foods f where f.id = food_id and f.deleted_at is null));

-- Preserve existing view columns in their original order, append management fields.
create or replace view public.food_summaries with (security_invoker = true) as
select f.id, f.name, f.location, f.area, f.category, f.price, f.image_url,
  f.description, f.tags, f.created_by, f.created_at,
  s.average_rating, coalesce(s.rating_count, 0)::integer as rating_count,
  f.updated_at, f.deleted_at
from public.foods f left join (
  select food_id, round(avg(rating), 1) as average_rating, count(*)::integer as rating_count
  from public.ratings group by food_id
) s on s.food_id = f.id;

-- Reuse the existing atomic insert/first-rating implementation. Only this guarded
-- wrapper is callable by ordinary clients; the private implementation is revoked.
revoke execute on function campus_private.create_food_with_rating(text,text,text,text,numeric,text,text,text[],integer) from authenticated;
create or replace function public.create_food_with_rating(
  p_name text, p_location text, p_area text, p_category text, p_price numeric,
  p_image_url text, p_description text, p_tags text[], p_rating integer
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select require_email from campus_private.food_auth_settings where singleton), true) then
    perform campus_private.require_campus_member();
  end if;
  return campus_private.create_food_with_rating(p_name,p_location,p_area,p_category,p_price,p_image_url,p_description,p_tags,p_rating);
end;
$$;

create function campus_private.validate_food_image(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_origin text := pg_catalog.regexp_replace(auth.jwt()->>'iss', '/auth/v1/?$', '');
  v_prefix text; v_path text;
begin
  if p_url is null then return; end if;
  if v_origin is null or v_origin !~ '^https://[^/]+$' then
    raise exception using errcode = '23514', message = 'Invalid image origin.';
  end if;
  v_prefix := v_origin || '/storage/v1/object/public/food-images/';
  if pg_catalog.left(p_url,pg_catalog.length(v_prefix)) <> v_prefix then
    raise exception using errcode = '23514', message = 'Invalid image URL.';
  end if;
  v_path := pg_catalog.substr(p_url,pg_catalog.length(v_prefix)+1);
  if v_path !~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$')
     or not exists(select 1 from storage.objects o where o.bucket_id='food-images' and o.name=v_path and o.owner_id=auth.uid()::text) then
    raise exception using errcode = '23514', message = 'Image is not owned by the caller.';
  end if;
end;
$$;
revoke all on function campus_private.validate_food_image(text) from public, anon, authenticated;

create function public.update_own_food(
  p_food_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_location text, p_area text, p_category text, p_price numeric,
  p_image_url text, p_description text, p_tags text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare v_food public.foods;
begin
  perform campus_private.require_campus_member();
  select * into v_food from public.foods where id=p_food_id and created_by=auth.uid() and deleted_at is null for update;
  if not found then raise exception using errcode='42501',message='Not an active publication owned by this user.'; end if;
  if p_expected_updated_at is null or v_food.updated_at <> p_expected_updated_at then
    raise exception using errcode='40001',message='Publication changed; reload before editing.';
  end if;
  perform campus_private.validate_food_image(p_image_url);
  update public.foods set name=p_name,location=p_location,area=p_area,category=p_category,
    price=p_price,image_url=p_image_url,description=coalesce(p_description,''),tags=coalesce(p_tags,'{}'),updated_at=clock_timestamp()
    where id=p_food_id;
end;
$$;
create function public.set_own_food_deleted(p_food_id uuid,p_expected_updated_at timestamptz,p_deleted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_food public.foods;
begin
  perform campus_private.require_campus_member();
  if p_deleted is null then raise exception using errcode='23514',message='Deletion state is required.'; end if;
  select * into v_food from public.foods where id=p_food_id and created_by=auth.uid() for update;
  if not found then raise exception using errcode='42501',message='Not the publication owner.'; end if;
  if p_expected_updated_at is null or v_food.updated_at <> p_expected_updated_at then
    raise exception using errcode='40001',message='Publication changed; reload before editing.';
  end if;
  update public.foods set deleted_at=case when p_deleted then clock_timestamp() else null end, updated_at=clock_timestamp() where id=p_food_id;
end;
$$;
revoke all on function public.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_own_food_deleted(uuid,timestamptz,boolean) from public, anon;
grant execute on function public.update_own_food(uuid,timestamptz,text,text,text,text,numeric,text,text,text[]),
  public.set_own_food_deleted(uuid,timestamptz,boolean) to authenticated;
-- No direct client UPDATE/DELETE grant, no permission to edit author or ratings.
notify pgrst, 'reload schema';
commit;
