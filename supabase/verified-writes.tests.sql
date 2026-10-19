-- Embedded PostgreSQL only; all fixtures roll back with the migration under test.
create function pg_temp.check_write(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', msg; end if; end; $$;
create function pg_temp.expect_write(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE % for %', expected, statement;
end; $$;
insert into auth.users(id,is_anonymous,email,email_confirmed_at) values
 ('60000000-0000-4000-8000-000000000001',false,'verified-a@zju.edu.cn',now()),
 ('60000000-0000-4000-8000-000000000002',false,'verified-b@zju.edu.cn',now()),
 ('60000000-0000-4000-8000-000000000003',true,null,null),
 ('60000000-0000-4000-8000-000000000004',false,'unconfirmed@zju.edu.cn',null);
insert into public.foods(id,name,location,area,created_by,deleted_at) values
 ('70000000-0000-4000-8000-000000000001','公开测试菜','测试','campus','60000000-0000-4000-8000-000000000001',null),
 ('70000000-0000-4000-8000-000000000002','撤下测试菜','测试','campus','60000000-0000-4000-8000-000000000001',now());
insert into public.ratings(food_id,user_id,rating) values
 ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003',3);
select pg_temp.check_write((select require_email from campus_private.food_auth_settings where singleton),'server publication requires verified email');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.check_write((select count(*)=1 from public.food_summaries),'public browsing stays available');
select pg_temp.expect_write($s$insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000001',4)$s$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"email":"fake@zju.edu.cn","email_verified":true}',true);
select pg_temp.expect_write($s$select public.create_food_with_rating('拒绝匿名','测试','campus','其他',null,null,'','{}',4)$s$,'42501');
select pg_temp.expect_write($s$insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000001',4)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.expect_write($s$insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000001',4)$s$,'42501');
select pg_temp.expect_write($s$select public.create_food_with_rating('拒绝未验证','测试','campus','其他',null,null,'','{}',4)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated","iss":"https://campustests.supabase.co/auth/v1"}',true);
insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000001',4);
select pg_temp.check_write((select count(*)=1 from public.list_my_food_ratings()),'verified user sees their own new rating');
select pg_temp.expect_write($s$insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000001',5)$s$,'23505');
select pg_temp.expect_write($s$insert into public.ratings(food_id,user_id,rating) values('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',5)$s$,'42501');
select pg_temp.expect_write($s$insert into public.ratings(food_id,rating) values('70000000-0000-4000-8000-000000000002',5)$s$,'42501');
select public.create_food_with_rating('已验证发布','测试','campus','其他',null,null,'','{}',5);
select pg_temp.check_write((select count(*)=2 from public.list_my_food_ratings()),'verified publication creates initial rating');
select pg_temp.expect_write($s$update public.ratings set rating=1$s$,'42501');
reset role;
select pg_temp.check_write((select count(*)=1 from public.ratings where user_id='60000000-0000-4000-8000-000000000003'),'old anonymous ratings preserved');
select 'Verified write checks passed.' as result;
