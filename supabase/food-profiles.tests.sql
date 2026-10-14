begin;
create function pg_temp.check_profile(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',msg; end if; end; $$;
create function pg_temp.expect_profile(statement text,expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate=expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE %',expected;
end; $$;
insert into auth.users(id,is_anonymous,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000001',false,'owner@zju.edu.cn',now()),
('10000000-0000-4000-8000-000000000002',false,'other@zju.edu.cn',now()),
('10000000-0000-4000-8000-000000000003',true,null,null),
('10000000-0000-4000-8000-000000000004',false,'pending@zju.edu.cn',null);
insert into public.foods(id,name,location,area,created_by,created_at,updated_at) values
('20000000-0000-4000-8000-000000000001','旧发布','原地点','campus','10000000-0000-4000-8000-000000000001','2026-10-01Z','2026-10-01Z'),
('20000000-0000-4000-8000-000000000002','他人旧发布','他人地点','campus','10000000-0000-4000-8000-000000000002','2026-10-01Z','2026-10-01Z');
insert into public.ratings(food_id,user_id,rating) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.expect_profile($s$select public.ensure_default_food_profile()$s$,'42501');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.expect_profile($s$select public.create_food_profile('拒绝未验证')$s$,'42501');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select public.ensure_default_food_profile();
select public.ensure_default_food_profile();
select pg_temp.check_profile((select count(*)=1 from public.food_profiles),'default profile is idempotent');
select pg_temp.check_profile((select profile_id is not null and name='旧发布' and created_at='2026-10-01Z' and updated_at='2026-10-01Z' and rating_count=1 and average_rating=4 from public.food_summaries where name='旧发布'),'legacy assignment preserves content, times and ratings');
select pg_temp.check_profile((select profile_id is null from public.foods where name='他人旧发布'),'cannot claim other user legacy food');
select public.create_food_profile('档案二');
select public.create_food_profile('档案三');
select public.create_food_profile('档案四');
select public.create_food_profile('档案五');
select pg_temp.check_profile((select count(*)=5 and min(slot)=1 and max(slot)=5 from public.food_profiles),'five slots including default');
select pg_temp.expect_profile($s$select public.create_food_profile('第六个')$s$,'P0001');
select pg_temp.expect_profile($s$select public.create_food_profile('账号已切换','10000000-0000-4000-8000-000000000002')$s$,'42501');
select pg_temp.expect_profile($s$insert into public.food_profiles(user_id,slot,name) values(auth.uid(),5,'绕过')$s$,'42501');
select pg_temp.expect_profile($s$update public.food_profiles set name='绕过更新'$s$,'42501');
select pg_temp.expect_profile($s$delete from public.food_profiles$s$,'42501');
select pg_temp.expect_profile($s$select campus_private.update_own_food(gen_random_uuid(),now(),'越权','测试','campus','其他',null,null,'','{}')$s$,'42501');

select public.create_food_in_profile(id,'第二档案发布','测试地点','campus','其他',null,null,'','{}',5)
from public.food_profiles where slot=2;
select pg_temp.check_profile((select rating_count=1 and average_rating=5 and profile_id=(select id from public.food_profiles where slot=2) from public.food_summaries where name='第二档案发布'),'new food belongs to chosen profile with atomic first rating');
select pg_temp.expect_profile($s$select public.update_profile_food((select id from public.food_profiles where slot=1),id,updated_at,'错误档案','测试地点','campus','其他',null,null,'','{}') from public.foods where name='第二档案发布'$s$,'42501');
select pg_temp.expect_profile($s$select public.update_own_food(id,updated_at,'旧API绕过','测试地点','campus','其他',null,null,'','{}') from public.foods where name='第二档案发布'$s$,'42501');
select public.update_profile_food(profile_id,id,updated_at,'档案二修改','测试地点','campus','其他',null,null,'','{}') from public.foods where name='第二档案发布';
select pg_temp.check_profile((select rating_count=1 and average_rating=5 from public.food_summaries where name='档案二修改'),'edit preserves rating');
select pg_temp.expect_profile($s$insert into public.ratings(food_id,rating) select id,1 from public.foods where name='档案二修改'$s$,'23505');
select pg_temp.expect_profile($s$select public.set_profile_food_deleted((select id from public.food_profiles where slot=1),id,updated_at,true) from public.foods where name='档案二修改'$s$,'42501');
select public.set_profile_food_deleted(profile_id,id,updated_at,true) from public.foods where name='档案二修改';
select public.set_profile_food_deleted(profile_id,id,updated_at,false) from public.foods where name='档案二修改';
select pg_temp.check_profile((select deleted_at is null and rating_count=1 and average_rating=5 from public.food_summaries where name='档案二修改'),'restore retains rating');
select public.update_own_food(id,updated_at,'旧发布修改','原地点','campus','其他',null,null,'','{}') from public.foods where name='旧发布';

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
select pg_temp.check_profile((select count(*)=0 from public.food_profiles),'other email cannot read profile names');
select public.ensure_default_food_profile();
select pg_temp.expect_profile($s$select public.create_food_in_profile(profile_id,'越权','测试','campus','其他',null,null,'','{}',4) from public.foods where name='档案二修改'$s$,'42501');
select pg_temp.expect_profile($s$select public.create_food_profile('')$s$,'23514');
select public.create_food_profile('Example');
select pg_temp.expect_profile($s$select public.create_food_profile('EXAMPLE')$s$,'23505');
select pg_temp.expect_profile($s$select public.create_food_profile(E'bad\nname')$s$,'23514');

reset role;
select pg_temp.expect_profile($s$update public.foods set profile_id=(select id from public.food_profiles where user_id='10000000-0000-4000-8000-000000000002' and slot=1) where name='档案二修改'$s$,'23503');
select pg_temp.check_profile((select count(*)=4 from auth.users),'profiles do not create extra Auth users');
select pg_temp.check_profile((select count(*)=2 from public.ratings),'profiles do not duplicate or remove ratings');
set local role anon;
select pg_temp.expect_profile($s$select * from public.food_profiles$s$,'42501');
select pg_temp.expect_profile($s$select public.create_food_profile('匿名')$s$,'42501');
reset role;
select 'Profile SQL checks passed.' as result;
rollback;
