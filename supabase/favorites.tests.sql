-- Embedded PostgreSQL fixtures only. The runner wraps migration + tests in a rollback.
create function pg_temp.check_favorite(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', msg; end if; end; $$;
create function pg_temp.expect_favorite(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE % for %', expected, statement;
end; $$;

insert into auth.users(id,is_anonymous,email,email_confirmed_at) values
 ('a1000000-0000-4000-8000-000000000001',false,'favorites-a@zju.edu.cn',now()),
 ('a1000000-0000-4000-8000-000000000002',false,'favorites-b@zju.edu.cn',now()),
 ('a1000000-0000-4000-8000-000000000003',true,null,null),
 ('a1000000-0000-4000-8000-000000000004',false,'favorites-unconfirmed@zju.edu.cn',null);
insert into public.foods(id,name,location,area,created_by,deleted_at) values
 ('b1000000-0000-4000-8000-000000000001','收藏测试在架','测试地点','campus','a1000000-0000-4000-8000-000000000002',null),
 ('b1000000-0000-4000-8000-000000000002','收藏测试撤下','撤下受限地点','campus','a1000000-0000-4000-8000-000000000002',now());

select pg_temp.check_favorite((select relrowsecurity from pg_catalog.pg_class where oid='public.campus_favorites'::regclass),'favorites has RLS enabled');
select pg_temp.check_favorite(not has_table_privilege('anon','public.campus_favorites','SELECT')
 and has_table_privilege('authenticated','public.campus_favorites','SELECT')
 and not has_table_privilege('authenticated','public.campus_favorites','INSERT')
 and not has_table_privilege('authenticated','public.campus_favorites','UPDATE'),'grants do not permit direct ownership or context writes');
select pg_temp.check_favorite(not has_table_privilege('authenticated','auth.users','SELECT'),'favorites does not expose Auth rows');
select pg_temp.check_favorite((select count(*)=3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
 from pg_catalog.pg_proc p where p.oid in ('public.list_my_campus_favorites()'::regprocedure,'public.save_my_campus_favorite(text,text,jsonb)'::regprocedure,'public.remove_my_campus_favorite(text,text)'::regprocedure)), 'all RPCs have fixed search_path and no caller-owned identity');
select pg_temp.check_favorite(not has_function_privilege('anon','public.list_my_campus_favorites()','EXECUTE')
 and not has_function_privilege('anon','public.save_my_campus_favorite(text,text,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.remove_my_campus_favorite(text,text)','EXECUTE')
 and not exists(select 1 from pg_catalog.pg_proc p, lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 where p.oid in ('public.list_my_campus_favorites()'::regprocedure,'public.save_my_campus_favorite(text,text,jsonb)'::regprocedure,'public.remove_my_campus_favorite(text,text)'::regprocedure) and a.grantee=0), 'RPC execution is not granted to anon or PUBLIC');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.check_favorite((select count(*)=0 from public.list_my_campus_favorites()),'empty verified account has empty favorites');
select public.save_my_campus_favorite('guide','campus-card-replacement','{"route":"offline","campus":"紫金港"}');
select public.save_my_campus_favorite('guide','campus-card-replacement','{"route":"online"}');
select pg_temp.check_favorite((select count(*)=1 and min(context->>'route')='online' from public.list_my_campus_favorites()),'repeat save is idempotent and replaces only limited revisit context');
select public.save_my_campus_favorite('website','website-123','{}');
select public.save_my_campus_favorite('food','b1000000-0000-4000-8000-000000000001','{"campus":"紫金港"}');
select pg_temp.check_favorite((select count(*)=3 from public.campus_favorites),'owner can read only own canonical favorites');
select pg_temp.expect_favorite($s$insert into public.campus_favorites(user_id,target_kind,target_id) values('a1000000-0000-4000-8000-000000000002','guide','forged')$s$,'42501');
select pg_temp.expect_favorite($s$update public.campus_favorites set user_id='a1000000-0000-4000-8000-000000000002'$s$,'42501');
select pg_temp.expect_favorite($s$update public.campus_favorites set context='{"q":"private"}'$s$,'42501');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('food','b1000000-0000-4000-8000-000000000002','{}')$s$,'P0002');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('food','b1000000-0000-4000-8000-000000000099','{}')$s$,'P0002');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','https://example.invalid','{}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('account','account-1','{}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','{"q":"private"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','{"returnTo":"//evil.invalid"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','{"route":"https://evil.invalid"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','{"campus":"紫金港&token=private"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','{"campus":null}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('website','website-1','{"route":"offline"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('food','b1000000-0000-4000-8000-000000000001','{"route":"offline"}')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid','[]')$s$,'23514');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','valid',null)$s$,'23514');
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites('a1000000-0000-4000-8000-000000000002'::uuid)$s$,'42883');
select pg_temp.check_favorite((select count(*)=3 from public.list_my_campus_favorites()),'invalid payloads do not create records');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_favorite((select count(*)=0 from public.list_my_campus_favorites()) and (select count(*)=0 from public.campus_favorites),'B cannot read A through RPC or table');
delete from public.campus_favorites where user_id='a1000000-0000-4000-8000-000000000001';
select public.remove_my_campus_favorite('guide','campus-card-replacement');
select public.save_my_campus_favorite('guide','campus-card-replacement','{}');
select pg_temp.check_favorite((select count(*)=1 from public.list_my_campus_favorites()),'B has its separate favorite for the same target');
reset role;
select pg_temp.check_favorite((select count(*)=3 from public.campus_favorites where user_id='a1000000-0000-4000-8000-000000000001'),'B delete and RPC remove cannot affect A');
select pg_temp.expect_favorite($s$insert into public.campus_favorites(user_id,target_kind,target_id) values('a1000000-0000-4000-8000-000000000001','guide','campus-card-replacement')$s$,'23505');

-- Withdrawing a target does not leak a stale snapshot through favorites. It also
-- does not erase the private record, so the caller may still remove it.
update public.foods set deleted_at=now() where id='b1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.check_favorite((select count(*)=1 from public.list_my_campus_favorites() where target_kind='food'),'withdrawn favorite remains as an identifier');
select pg_temp.check_favorite((select count(*)=0 from public.food_summaries where id='b1000000-0000-4000-8000-000000000001'),'favorite never bypasses withdrawn food read restrictions');
select pg_temp.check_favorite((select array_agg(column_name::text order by ordinal_position)=array['user_id','target_kind','target_id','context','created_at'] from information_schema.columns where table_schema='public' and table_name='campus_favorites'),'favorite table has no title/image/location snapshot columns');
select public.remove_my_campus_favorite('food','b1000000-0000-4000-8000-000000000001');
select public.remove_my_campus_favorite('food','b1000000-0000-4000-8000-000000000001');
select pg_temp.check_favorite((select count(*)=2 from public.list_my_campus_favorites()),'remove withdrawn target twice is idempotent');

-- An old token with forged verification fields must not override canonical Auth.
reset role;
update auth.users set email_confirmed_at=null where id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","email":"forged@zju.edu.cn","email_verified":true}',true);
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','forged','{}')$s$,'42501');
select pg_temp.expect_favorite($s$select public.remove_my_campus_favorite('guide','campus-card-replacement')$s$,'42501');
select pg_temp.check_favorite((select count(*)=0 from public.campus_favorites),'RLS also denies stale verified session reads');
delete from public.campus_favorites;
reset role;
select pg_temp.check_favorite((select count(*)=2 from public.campus_favorites where user_id='a1000000-0000-4000-8000-000000000001'),'unverified direct deletion does not remove private records');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","email_verified":true,"is_anonymous":false}',true);
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','anonymous','{}')$s$,'42501');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","email_verified":true}',true);
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','unconfirmed','{}')$s$,'42501');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.expect_favorite($s$select * from public.campus_favorites$s$,'42501');
select pg_temp.expect_favorite($s$select public.list_my_campus_favorites()$s$,'42501');
select pg_temp.expect_favorite($s$select public.save_my_campus_favorite('guide','guest','{}')$s$,'42501');
select pg_temp.expect_favorite($s$select public.remove_my_campus_favorite('guide','guest')$s$,'42501');
reset role;
select pg_temp.check_favorite((select count(*)=3 from public.campus_favorites),'rejected operations preserve unrelated favorites');
select 'Favorites SQL isolation and mutation checks passed.' as result;
