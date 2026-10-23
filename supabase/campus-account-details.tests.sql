-- Local embedded PostgreSQL fixtures only; no real Auth users or personal data.
begin;
create function pg_temp.check_details(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', msg; end if; end;
$$;
create function pg_temp.expect_details(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected then return; else raise; end if; end;
  raise exception 'Expected SQLSTATE % for %', expected, statement;
end;
$$;
insert into auth.users(id,is_anonymous,email,email_confirmed_at) values
 ('90000000-0000-4000-8000-000000000001',false,'details-a@zju.edu.cn',now()),
 ('90000000-0000-4000-8000-000000000002',false,'details-b@zju.edu.cn',now()),
 ('90000000-0000-4000-8000-000000000003',true,null,null),
 ('90000000-0000-4000-8000-000000000004',false,'details-pending@zju.edu.cn',null);
select pg_temp.check_details((select relrowsecurity from pg_class where oid='public.campus_account_details'::regclass), 'RLS is enabled');
select pg_temp.check_details(
 has_table_privilege('authenticated','public.campus_account_details','SELECT')
 and not has_table_privilege('anon','public.campus_account_details','SELECT')
 and not has_table_privilege('authenticated','public.campus_account_details','INSERT')
 and not has_table_privilege('authenticated','public.campus_account_details','UPDATE')
 and not has_table_privilege('authenticated','public.campus_account_details','DELETE'), 'only private owner SELECT is granted; writes require guarded RPC');
select pg_temp.check_details((select count(*)=2 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
 where oid in ('public.get_my_campus_details(uuid)'::regprocedure,'public.save_my_campus_details(uuid,text,text,text,timestamptz)'::regprocedure)), 'RPCs pin search path');
select pg_temp.check_details(
 not has_function_privilege('anon','public.get_my_campus_details(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.save_my_campus_details(uuid,text,text,text,timestamptz)','EXECUTE')
 and not exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid in
 ('public.get_my_campus_details(uuid)'::regprocedure,'public.save_my_campus_details(uuid,text,text,text,timestamptz)'::regprocedure) and a.grantee=0), 'RPCs have no PUBLIC or anonymous grants');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.check_details((select count(*)=0 from public.get_my_campus_details('90000000-0000-4000-8000-000000000001')), 'absent details do not fabricate or auto-create a saved row');
select pg_temp.check_details((select gender='female' and signature='测试签名' and campus='紫金港' from public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female',' 测试签名 ','紫金港',null)), 'verified A can create and read real saved details');
select pg_temp.check_details((select count(*)=1 from public.campus_account_details), 'owner can read its only row through RLS');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female','重复','紫金港',null)$s$,'40001');
select pg_temp.expect_details($s$insert into public.campus_account_details(user_id) values('90000000-0000-4000-8000-000000000002')$s$,'42501');
select pg_temp.expect_details($s$update public.campus_account_details set signature='伪造'$s$,'42501');
select pg_temp.expect_details($s$delete from public.campus_account_details$s$,'42501');
select pg_temp.expect_details($s$select * from auth.users$s$,'42501');
select pg_temp.expect_details($s$select public.get_my_campus_details('90000000-0000-4000-8000-000000000002')$s$,'42501');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000002','male','篡改他人','玉泉',null)$s$,'42501');
select pg_temp.expect_details($s$select public.get_my_campus_details(null)$s$,'42501');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female','旧版本','紫金港','2000-01-01')$s$,'40001');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','invalid','签名','紫金港',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female','签名','不存在校区',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female',repeat('字',121),'紫金港',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female',E'错误\n换行','紫金港',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female',chr(133),'紫金港',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','female',repeat(' ',120)||'字','紫金港',(select updated_at from public.campus_account_details))$s$,'23514');
select pg_temp.check_details((select signature=repeat('🍚',120) from public.save_my_campus_details('90000000-0000-4000-8000-000000000001','other',repeat('🍚',120),'舟山',(select updated_at from public.campus_account_details))), 'Unicode signature length is measured in characters');
select pg_temp.check_details((select gender='undisclosed' and signature='' and campus='' from public.save_my_campus_details('90000000-0000-4000-8000-000000000001','undisclosed','','',(select updated_at from public.campus_account_details))), 'all optional values can be cleared');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.check_details((select count(*)=0 from public.campus_account_details), 'B cannot read A details even by direct table query');
select pg_temp.check_details((select count(*)=0 from public.get_my_campus_details('90000000-0000-4000-8000-000000000002')), 'B receives its own empty result');
select pg_temp.check_details((select signature='B的私密资料' from public.save_my_campus_details('90000000-0000-4000-8000-000000000002','male','B的私密资料','海宁',null)), 'B gets a distinct row');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000001','male','旧A请求','玉泉',null)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"email":"forged@zju.edu.cn","email_verified":true}',true);
select pg_temp.check_details((select count(*)=0 from public.campus_account_details), 'anonymous cannot see any saved details using forged claims');
select pg_temp.expect_details($s$select public.get_my_campus_details('90000000-0000-4000-8000-000000000003')$s$,'42501');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000003','male','','',null)$s$,'42501');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","email_verified":true}',true);
select pg_temp.expect_details($s$select public.get_my_campus_details('90000000-0000-4000-8000-000000000004')$s$,'42501');
select pg_temp.expect_details($s$select public.save_my_campus_details('90000000-0000-4000-8000-000000000004','female','','',null)$s$,'42501');
reset role;
update auth.users set email_confirmed_at=null where id='90000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","email_verified":true}',true);
select pg_temp.check_details((select count(*)=0 from public.campus_account_details), 'lost canonical verification removes old-session SELECT access');
select pg_temp.expect_details($s$select public.get_my_campus_details('90000000-0000-4000-8000-000000000001')$s$,'42501');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select pg_temp.expect_details($s$select public.get_my_campus_details(null)$s$,'42501');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.expect_details($s$select * from public.campus_account_details$s$,'42501');
select pg_temp.expect_details($s$select public.get_my_campus_details('90000000-0000-4000-8000-000000000001')$s$,'42501');
reset role;
select pg_temp.check_details((select count(*)=2 from public.campus_account_details), 'one row per Auth account; failed writes caused no extra records');
select pg_temp.check_details((select count(*)=0 from public.foods) and (select count(*)=0 from public.ratings), 'details do not alter public food or rating data');
select 'Campus account details SQL checks passed.' as result;
rollback;
