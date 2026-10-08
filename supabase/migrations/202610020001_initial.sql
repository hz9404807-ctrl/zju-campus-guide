-- Campus Guide MVP. Apply once to a NEW Supabase project as its database owner.
-- PostgreSQL 15+ is required for security_invoker views.
-- No real campus content or sample ratings are inserted by this migration.
begin;

create schema if not exists campus_private;
revoke all on schema campus_private from public, anon, authenticated;
grant usage on schema campus_private to authenticated;

create function campus_private.valid_food_tags(p_tags text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.cardinality(p_tags) <= 5
    and coalesce(pg_catalog.array_ndims(p_tags) <= 1, true)
    and not exists (
      select 1 from pg_catalog.unnest(p_tags) as t(tag)
      where tag is null
        or pg_catalog.char_length(pg_catalog.btrim(tag)) not between 1 and 12
        or tag <> pg_catalog.btrim(tag)
    );
$$;
revoke all on function campus_private.valid_food_tags(text[]) from public, anon, authenticated;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  location text not null check (char_length(btrim(location)) between 1 and 120),
  area text not null check (area in ('campus', 'off_campus')),
  category text not null default '其他' check (char_length(btrim(category)) between 1 and 30),
  price numeric check (price is null or (price between 0 and 99999.99 and price = trunc(price, 2))),
  image_url text,
  description text not null default '' check (char_length(description) <= 200),
  tags text[] not null default '{}'::text[] check (campus_private.valid_food_tags(tags)),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint ratings_food_user_unique unique (food_id, user_id)
);

create index foods_area_created_at_idx on public.foods (area, created_at desc);
create index foods_created_by_idx on public.foods (created_by);
create index ratings_user_id_idx on public.ratings (user_id);

alter table public.foods enable row level security;
alter table public.ratings enable row level security;

-- Explicit grants matter as well as RLS: never inherit the project's broad
-- default table grants. Ordinary clients cannot create an unrated food directly.
revoke all on table public.foods, public.ratings from public, anon, authenticated;
grant select on table public.foods, public.ratings to anon, authenticated;
grant insert (food_id, user_id, rating) on public.ratings to authenticated;
grant all on table public.foods, public.ratings to service_role;

create policy foods_public_read on public.foods
for select to anon, authenticated using (true);

create policy ratings_public_read on public.ratings
for select to anon, authenticated using (true);

create policy ratings_insert_own on public.ratings
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- There are deliberately no foods INSERT policies or client UPDATE/DELETE
-- grants/policies. Food creation is exposed only through the atomic RPC below.
create view public.food_summaries
with (security_invoker = true)
as
select f.*,
  s.average_rating,
  coalesce(s.rating_count, 0)::integer as rating_count
from public.foods as f
left join (
  select food_id, round(avg(rating), 1) as average_rating, count(*)::integer as rating_count
  from public.ratings
  group by food_id
) as s on s.food_id = f.id;

revoke all on table public.food_summaries from public, anon, authenticated;
grant select on table public.food_summaries to anon, authenticated, service_role;

-- The privileged implementation lives outside the exposed public schema.
-- Every relation is schema-qualified; callers cannot provide an owner or SQL.
create function campus_private.create_food_with_rating(
  p_name text,
  p_location text,
  p_area text,
  p_category text,
  p_price numeric,
  p_image_url text,
  p_description text,
  p_tags text[],
  p_rating integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_food_id uuid;
  v_image_url text := nullif(pg_catalog.btrim(p_image_url), '');
  v_issuer text;
  v_storage_prefix text;
  v_object_path text;
begin
  if v_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = '需要有效的匿名用户身份才能发布。';
  end if;

  if p_rating is null or p_rating not between 1 and 5 then
    raise exception using errcode = '23514', message = '首次评分必须是 1 至 5 的整数。';
  end if;

  if v_image_url is not null then
    -- Supabase validates the signed access token before the Data API runs this
    -- function. Never derive the project origin from user_metadata or a caller
    -- argument. Only the default hosted Supabase issuer is supported in V1.
    v_issuer := auth.jwt() ->> 'iss';
    if v_issuer is null or v_issuer !~ '^https://[a-z0-9]+[.]supabase[.]co/auth/v1$' then
      raise exception using errcode = '23514', message = '无法核实图片所属项目，请使用默认 Supabase 项目地址。';
    end if;
    v_storage_prefix := pg_catalog.left(v_issuer, pg_catalog.char_length(v_issuer) - 8)
      || '/storage/v1/object/public/food-images/';
    if not pg_catalog.starts_with(v_image_url, v_storage_prefix) then
      raise exception using errcode = '23514', message = '图片必须来自本项目的 food-images 存储桶。';
    end if;
    v_object_path := pg_catalog.substr(v_image_url, pg_catalog.char_length(v_storage_prefix) + 1);
    if v_object_path !~ ('^' || v_user_id::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$')
      or not exists (
        select 1 from storage.objects as o
        where o.bucket_id = 'food-images' and o.name = v_object_path
          and o.owner_id = v_user_id::text
      ) then
      raise exception using errcode = '23514', message = '图片不存在或不属于当前匿名用户，请先完成上传。';
    end if;
  end if;

  insert into public.foods (
    name, location, area, category, price, image_url, description, tags, created_by
  ) values (
    pg_catalog.btrim(p_name), pg_catalog.btrim(p_location), p_area,
    coalesce(nullif(pg_catalog.btrim(p_category), ''), '其他'), p_price,
    v_image_url, coalesce(pg_catalog.btrim(p_description), ''),
    coalesce(p_tags, '{}'::text[]), v_user_id
  ) returning id into v_food_id;

  insert into public.ratings (food_id, user_id, rating)
  values (v_food_id, v_user_id, p_rating);

  return v_food_id;
end;
$$;

revoke all on function campus_private.create_food_with_rating(text, text, text, text, numeric, text, text, text[], integer)
from public, anon, authenticated;
grant execute on function campus_private.create_food_with_rating(text, text, text, text, numeric, text, text, text[], integer)
to authenticated;

-- Public API contract: the invoker wrapper never exposes an elevated definer
-- function directly through PostgREST. Keep campus_private out of Exposed schemas.
create function public.create_food_with_rating(
  p_name text,
  p_location text,
  p_area text,
  p_category text,
  p_price numeric,
  p_image_url text,
  p_description text,
  p_tags text[],
  p_rating integer
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select campus_private.create_food_with_rating(
    p_name, p_location, p_area, p_category, p_price,
    p_image_url, p_description, p_tags, p_rating
  );
$$;

revoke all on function public.create_food_with_rating(text, text, text, text, numeric, text, text, text[], integer)
from public, anon, authenticated;
grant execute on function public.create_food_with_rating(text, text, text, text, numeric, text, text, text[], integer)
to authenticated;

-- Bucket creation is supported by the Supabase SQL configuration workflow.
-- Never insert/update/delete storage.objects directly: upload actual files via
-- the Storage API, which also enforces the MIME type and 5 MiB size limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy food_images_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'food-images'
  and (select auth.uid()) is not null
  and owner_id = (select auth.uid()::text)
  and name ~ ('^' || (select auth.uid()::text)
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$')
);

-- A public bucket serves public URLs without a SELECT policy. No listing,
-- replacement (upsert), update, move or delete policy is granted to clients.
comment on function public.create_food_with_rating(text, text, text, text, numeric, text, text, text[], integer)
is 'Atomically creates one food and the current authenticated anonymous user''s first rating.';
comment on view public.food_summaries
is 'Public food fields with live database-calculated rating average and count; obeys underlying RLS.';

commit;
