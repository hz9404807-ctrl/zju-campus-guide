-- Embedded/local PostgreSQL only. All identities and content below are fixtures.
begin;
create function pg_temp.check_personal(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', msg; end if; end;
$$;
create function pg_temp.expect_personal(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE % for %', expected, statement;
end;
$$;

insert into auth.users(id, is_anonymous, email, email_confirmed_at) values
  ('30000000-0000-4000-8000-000000000001', false, 'personal-a@zju.edu.cn', now()),
  ('30000000-0000-4000-8000-000000000002', false, 'personal-b@zju.edu.cn', now()),
  ('30000000-0000-4000-8000-000000000003', true, null, null),
  ('30000000-0000-4000-8000-000000000004', false, 'personal-pending@zju.edu.cn', null),
  ('30000000-0000-4000-8000-000000000005', false, 'personal-empty@zju.edu.cn', now());
-- A legacy foreign-domain Auth row tests the canonical guard independently of the
-- email-domain trigger. Only this local fixture setup disables it, then restores it.
alter table auth.users disable trigger campus_email_domain;
insert into auth.users(id, is_anonymous, email, email_confirmed_at) values
  ('30000000-0000-4000-8000-000000000006', false, 'personal-external@example.invalid', now());
alter table auth.users enable trigger campus_email_domain;

insert into public.foods(id, name, location, area, image_url, created_by, deleted_at) values
  ('40000000-0000-4000-8000-000000000001', '在架美食', '在架地点', 'campus',
    'https://fixture.invalid/active.png', '30000000-0000-4000-8000-000000000002', null),
  ('40000000-0000-4000-8000-000000000002', '他人撤下美食', '他人撤下地点', 'campus',
    'https://fixture.invalid/other-removed.png', '30000000-0000-4000-8000-000000000002', now()),
  ('40000000-0000-4000-8000-000000000003', '本人撤下美食', '本人撤下地点', 'campus',
    'https://fixture.invalid/own-removed.png', '30000000-0000-4000-8000-000000000001', now());
insert into public.ratings(id, food_id, user_id, rating, created_at) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 4, '2026-10-10T01:00:00Z'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 2, '2026-10-11T01:00:00Z'),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 5, '2026-10-12T01:00:00Z'),
  ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 1, '2026-10-13T01:00:00Z');

select pg_temp.check_personal(
  (select prosecdef and proconfig @> array['search_path=""'] and pronargs = 0
   from pg_catalog.pg_proc where oid = 'public.list_my_food_ratings()'::regprocedure),
  'history is a zero-argument security-definer function with an empty search_path');
select pg_temp.check_personal(
  has_function_privilege('authenticated', 'public.list_my_food_ratings()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_my_food_ratings()', 'EXECUTE')
    and not exists (
      select 1 from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
      where p.oid = 'public.list_my_food_ratings()'::regprocedure
        and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'only authenticated clients receive execute, with no PUBLIC or anon grant');
select pg_temp.check_personal(
  not has_table_privilege('authenticated', 'auth.users', 'SELECT')
    and not has_table_privilege('anon', 'auth.users', 'SELECT'),
  'personal history does not expose the Auth table');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.check_personal((select count(*) = 3 from public.list_my_food_ratings()),
  'account A receives only its three ratings, including withdrawn history');
select pg_temp.check_personal(
  (select rating = 4 and created_at = '2026-10-10T01:00:00Z' and food_name = '在架美食'
    and food_location = '在架地点' and food_image_url = 'https://fixture.invalid/active.png'
   from public.list_my_food_ratings() where food_id = '40000000-0000-4000-8000-000000000001'),
  'active food includes the caller rating and original timestamp with public details');
select pg_temp.check_personal(
  (select count(*) = 2 and bool_and(food_name is null and food_location is null and food_image_url is null)
   from public.list_my_food_ratings() where food_id in
     ('40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003')),
  'all withdrawn details are redacted, including the caller own withdrawn food');
select pg_temp.check_personal(
  (select array_agg(food_id) = array[
    '40000000-0000-4000-8000-000000000003'::uuid,
    '40000000-0000-4000-8000-000000000002'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid] from public.list_my_food_ratings()),
  'rating history is returned newest first');
select pg_temp.expect_personal(
  $s$select public.list_my_food_ratings('30000000-0000-4000-8000-000000000002'::uuid)$s$,
  '42883');
select pg_temp.expect_personal($s$select * from auth.users$s$, '42501');
select pg_temp.check_personal(
  (select count(*) = 2 from public.ratings where food_id = '40000000-0000-4000-8000-000000000001'),
  'existing public rating-read policy remains unchanged');
select pg_temp.expect_personal(
  $s$insert into public.ratings(food_id, user_id, rating)
     values('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 3)$s$,
  '42501');

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.check_personal(
  (select count(*) = 1 and min(rating) = 1 and min(created_at) = '2026-10-13T01:00:00Z'
   from public.list_my_food_ratings()),
  'switching to B returns B rating and never any A history');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select pg_temp.check_personal((select count(*) = 0 from public.list_my_food_ratings()),
  'a verified account with no ratings returns an empty result');

-- Forged metadata must not override the actual anonymous or unconfirmed Auth row.
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"email":"forged@zju.edu.cn","email_verified":true}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated","email_verified":true}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated","email":"forged@zju.edu.cn"}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect_personal($s$select public.list_my_food_ratings()$s$, '42501');
select pg_temp.check_personal(
  (select count(*) = 1 and min(name) = '在架美食' from public.foods),
  'public browsing still shows active food and hides withdrawn food');
reset role;
select pg_temp.check_personal(
  (select count(*) = 4 from public.ratings) and (select count(*) = 3 from public.foods),
  'history reads do not create, change or delete foods or ratings');
select 'Personal-center rating history SQL checks passed.' as result;
rollback;
