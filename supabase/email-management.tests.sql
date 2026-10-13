begin;
create function pg_temp.check_it(ok boolean, msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAILED: %', msg; end if; end; $$;
create function pg_temp.expect_state(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate=expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE % for %', expected,statement;
end;
$$;
insert into auth.users(id,is_anonymous,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001',false,'owner@zju.edu.cn',now()),
 ('10000000-0000-4000-8000-000000000002',false,'other@zju.edu.cn',now()),
 ('10000000-0000-4000-8000-000000000003',true,null,null),
 ('10000000-0000-4000-8000-000000000004',false,'pending@zju.edu.cn',null);
set local role supabase_auth_admin;
insert into auth.users(id,is_anonymous,email) values('10000000-0000-4000-8000-000000000005',false,'authworker@zju.edu.cn');
select pg_temp.expect_state($s$insert into auth.users(id,email,is_anonymous) values(gen_random_uuid(),'fake@zju.edu.cn.evil',false)$s$,'23514');
select pg_temp.expect_state($s$update auth.users set email='external@example.com' where email='owner@zju.edu.cn'$s$,'23514');
select pg_temp.expect_state($s$update auth.users set email_change='external@example.com' where email='owner@zju.edu.cn'$s$,'23514');
reset role;
-- Bind an anonymous identity without changing its ID or previous publication owner.
update auth.users set email='bound@zju.edu.cn' where id='10000000-0000-4000-8000-000000000003';
insert into storage.objects(bucket_id,name,owner_id) values('food-images','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.png','10000000-0000-4000-8000-000000000001');
update campus_private.food_auth_settings set require_email=true;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true,"iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.expect_state($s$select public.create_food_with_rating('拒绝匿名','测试','campus','其他',null,null,'','{}',4)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.expect_state($s$select public.create_food_with_rating('拒绝未验证','测试','campus','其他',null,null,'','{}',4)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select public.create_food_with_rating('作者测试','测试地点','campus','其他',12,null,'介绍','{}',4);
select public.update_own_food(id,updated_at,'作者修改','测试地点','campus','其他',13,null,'新介绍','{}') from public.foods;
select public.update_own_food(id,updated_at,'作者修改','测试地点','campus','其他',13,'https://campustests.supabase.co/storage/v1/object/public/food-images/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.png','新介绍','{}') from public.foods;
select pg_temp.expect_state($s$select public.update_own_food(id,updated_at,'','测试','campus','其他',null,null,'','{}') from public.foods$s$,'23514');
select pg_temp.check_it((select name='作者修改' and price=13 and rating_count=1 and average_rating=4 from public.food_summaries),'edit preserves rating and updates content');
select pg_temp.expect_state($s$select public.update_own_food(id,created_at,'冲突','测试','campus','其他',null,null,'','{}') from public.foods$s$,'40001');
select pg_temp.expect_state($s$update public.foods set created_by='10000000-0000-4000-8000-000000000002'$s$,'42501');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.expect_state($s$select public.update_own_food(id,updated_at,'他人修改','测试','campus','其他',null,null,'','{}') from public.foods$s$,'42501');
select pg_temp.expect_state($s$select public.set_own_food_deleted(id,updated_at,true) from public.foods$s$,'42501');
insert into public.ratings(food_id,rating) select id,2 from public.foods;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select public.set_own_food_deleted(id,updated_at,true) from public.foods;
select pg_temp.check_it((select count(*)=1 from public.foods where deleted_at is not null),'owner can find removed publication');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.check_it((select count(*)=0 from public.foods),'other user cannot read deleted food by direct API');
select pg_temp.check_it((select count(*)=0 from public.food_summaries),'deleted food hidden in summary');
select pg_temp.check_it((select count(*)=0 from public.ratings),'deleted ratings hidden');
reset role;
select pg_temp.check_it((select count(*)=2 from public.ratings),'soft deletion preserves all ratings');
set local role anon;
select pg_temp.check_it((select count(*)=0 from public.foods),'public cannot read removed food');
select pg_temp.expect_state($s$select public.set_own_food_deleted(gen_random_uuid(),now(),false)$s$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select public.set_own_food_deleted(id,updated_at,false) from public.foods;
select pg_temp.check_it((select rating_count=2 and average_rating=3 from public.food_summaries),'restoration restores original rating aggregate');
select pg_temp.expect_state($s$delete from public.ratings$s$,'42501');
select pg_temp.expect_state($s$select public.update_own_food(id,updated_at,'图片篡改','测试','campus','其他',null,'https://evil.invalid/image.jpg','','{}') from public.foods$s$,'23514');
reset role;
-- A previously anonymous author's record keeps the same owner when email is bound.
update campus_private.food_auth_settings set require_email=false;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select public.create_food_with_rating('旧匿名发布','测试','campus','其他',null,null,'','{}',4);
reset role;
update auth.users set is_anonymous=false,email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000003';
update campus_private.food_auth_settings set require_email=true;
set local role authenticated;
select public.update_own_food(id,updated_at,'绑定后可管理','测试','campus','其他',null,null,'','{}') from public.foods where created_by=auth.uid();
select pg_temp.check_it((select name='绑定后可管理' from public.foods where created_by=auth.uid()),'binding retains the anonymous publication ownership');
select pg_temp.expect_state($s$select campus_private.create_food_with_rating('绕过门禁','测试','campus','其他',null,null,'','{}',4)$s$,'42501');
reset role;
select 'Campus email / owner management SQL checks passed.' as result;
rollback;
