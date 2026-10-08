-- Run AFTER the migration in a disposable/local Supabase database, as postgres.
-- These database checks do not verify the Auth/Storage HTTP services or uploads.
-- All fixtures, helper functions and the deliberate failure trigger are rolled back.
begin;

create function pg_temp.assert_true(p_ok boolean, p_label text)
returns void language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
end;
$$;

create function pg_temp.expect_sqlstate(p_sql text, p_expected text, p_label text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_expected then return; end if;
    raise exception 'FAILED: %, expected SQLSTATE %, got % (%)', p_label, p_expected, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: %, statement unexpectedly succeeded', p_label;
end;
$$;

-- Fictional identities exist only inside this transaction. They cannot sign in.
insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', true, now(), now());

create temporary table campus_test_state (key text primary key, value uuid);
grant select, insert on campus_test_state to authenticated;
grant select on campus_test_state to anon;

select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.foods'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.ratings'::regclass),
  'RLS is enabled for both tables'
);
select pg_temp.assert_true(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.food_summaries'::regclass),
  'summary view respects caller RLS'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.foods', 'INSERT')
    and not has_table_privilege('authenticated', 'public.foods', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.foods', 'DELETE')
    and not has_table_privilege('authenticated', 'public.ratings', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ratings', 'DELETE'),
  'clients have no direct food writes or rating updates/deletes'
);
select pg_temp.assert_true(
  (select public and file_size_limit = 5242880
    and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
    and cardinality(allowed_mime_types) = 3
   from storage.buckets where id = 'food-images'),
  'public image bucket restricts size and supported MIME types'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true,"iss":"https://campustests.supabase.co/auth/v1"}', true);

insert into campus_test_state (key, value)
select 'food', public.create_food_with_rating(
  'SQL 测试菜品', 'SQL 测试地点', 'campus', null, 15.50,
  null, '仅存在于回滚事务中的测试记录', array['测试'], 5
);

select pg_temp.assert_true(
  (select f.created_by = auth.uid() and f.category = '其他'
    and f.average_rating = 5.0 and f.rating_count = 1
   from public.food_summaries f where f.id = (select value from campus_test_state where key = 'food')),
  'RPC creates food and first rating together, with caller as owner'
);

select pg_temp.expect_sqlstate(
  $$insert into public.foods (name, location, area) values ('绕过 RPC', '测试', 'campus')$$,
  '42501', 'cannot create a food without its first rating'
);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (food_id, user_id, rating)
    select value, auth.uid(), 4 from campus_test_state where key = 'food'$$,
  '23505', 'publisher cannot rate the same food twice'
);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (food_id, user_id, rating)
    select value, '10000000-0000-4000-8000-000000000002', 4 from campus_test_state where key = 'food'$$,
  '42501', 'cannot impersonate another user'
);
select pg_temp.expect_sqlstate(
  $$update public.foods set name = '篡改' where id = (select value from campus_test_state where key = 'food')$$,
  '42501', 'publisher cannot edit a food'
);
select pg_temp.expect_sqlstate(
  $$delete from public.foods where id = (select value from campus_test_state where key = 'food')$$,
  '42501', 'publisher cannot delete a food'
);
select pg_temp.expect_sqlstate(
  $$update public.ratings set rating = 1 where food_id = (select value from campus_test_state where key = 'food')$$,
  '42501', 'user cannot modify an existing rating'
);
select pg_temp.expect_sqlstate(
  $$delete from public.ratings where food_id = (select value from campus_test_state where key = 'food')$$,
  '42501', 'user cannot delete an existing rating'
);

select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('评分越界', '测试', 'campus', null, null, null, null, null, 6)$$,
  '23514', 'initial rating range is checked in database'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('小数价格', '测试', 'campus', null, 1.001, null, null, null, 4)$$,
  '23514', 'price is not silently rounded'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('负数价格', '测试', 'campus', null, -1, null, null, null, 4)$$,
  '23514', 'price cannot be negative'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('   ', '测试', 'campus', null, null, null, null, null, 4)$$,
  '23514', 'name cannot be whitespace only'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('未知区域', '测试', 'unknown', null, null, null, null, null, 4)$$,
  '23514', 'area is constrained'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('过长标签', '测试', 'campus', null, null, null, null, array[repeat('字', 13)], 4)$$,
  '23514', 'tag length is constrained'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('空标签', '测试', 'campus', null, null, null, null, array[null]::text[], 4)$$,
  '23514', 'null tag elements are rejected'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('外域图片', '测试', 'campus', null, null,
    'https://example.com/storage/v1/object/public/food-images/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.jpg', null, null, 4)$$,
  '23514', 'arbitrary external image origins are rejected'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('他人图片', '测试', 'campus', null, null,
    'https://campustests.supabase.co/storage/v1/object/public/food-images/10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001.jpg', null, null, 4)$$,
  '23514', 'another users image path is rejected'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('不存在图片', '测试', 'campus', null, null,
    'https://campustests.supabase.co/storage/v1/object/public/food-images/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.jpg', null, null, 4)$$,
  '23514', 'URL alone is not enough without an owned storage object'
);

select set_config('request.jwt.claims', '{"role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}', true);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('缺失身份', '测试', 'campus', null, null, null, null, null, 4)$$,
  '42501', 'RPC refuses a missing user identity'
);

-- A second anonymous identity can contribute once; summary is computed from rows.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true,"iss":"https://campustests.supabase.co/auth/v1"}', true);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (food_id, user_id, rating)
    select value, auth.uid(), 0 from campus_test_state where key = 'food'$$,
  '23514', 'direct ratings have database range checks'
);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (id, food_id, user_id, rating)
    select gen_random_uuid(), value, auth.uid(), 3 from campus_test_state where key = 'food'$$,
  '42501', 'clients cannot override generated rating identifiers'
);
insert into public.ratings (food_id, user_id, rating)
select value, auth.uid(), 3 from campus_test_state where key = 'food';
select pg_temp.assert_true(
  (select average_rating = 4.0 and rating_count = 2 from public.food_summaries
    where id = (select value from campus_test_state where key = 'food')),
  'second user changes database average and count'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.ratings where user_id = auth.uid()
    and food_id = (select value from campus_test_state where key = 'food')),
  'own rating can be queried'
);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (food_id, user_id, rating)
    select value, auth.uid(), 5 from campus_test_state where key = 'food'$$,
  '23505', 'second user cannot rate twice'
);

-- Deliberately make the SECOND write fail, proving no empty food survives.
reset role;
create function pg_temp.fail_test_rating()
returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'ZX001', message = 'Deliberate transaction test failure';
end;
$$;
create trigger campus_transaction_test_failure
before insert on public.ratings for each row execute function pg_temp.fail_test_rating();
set local role authenticated;
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('事务回滚测试独有菜品', '测试', 'campus', null, null, null, null, null, 4)$$,
  'ZX001', 'RPC propagates a failure of its second write'
);
select pg_temp.assert_true(
  not exists (select 1 from public.foods where name = '事务回滚测试独有菜品'),
  'failed first rating rolls back the food row'
);
reset role;
drop trigger campus_transaction_test_failure on public.ratings;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_true(
  (select average_rating = 4.0 and rating_count = 2 from public.food_summaries
    where id = (select value from campus_test_state where key = 'food')),
  'signed-out visitors can read shared summaries'
);
select pg_temp.expect_sqlstate(
  $$select public.create_food_with_rating('未认证发布', '测试', 'campus', null, null, null, null, null, 4)$$,
  '42501', 'anon role cannot execute creation RPC'
);
select pg_temp.expect_sqlstate(
  $$insert into public.ratings (food_id, user_id, rating)
    select value, '10000000-0000-4000-8000-000000000002', 4 from campus_test_state where key = 'food'$$,
  '42501', 'anon role cannot submit ratings'
);

reset role;
select 'PASS: database checks completed; all test changes will now be rolled back.' as result;
rollback;
