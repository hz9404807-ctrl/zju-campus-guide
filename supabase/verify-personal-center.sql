-- Read-only verification for the deployed email + personal-center features.
-- No test users, foods, ratings, or changes to existing records are created.
begin transaction read only;
do $$
begin
 if not (select require_email from campus_private.food_auth_settings where singleton) then raise exception 'Email-only publication is not enabled'; end if;
 if not has_function_privilege('authenticated','public.list_my_food_ratings()','execute') or has_function_privilege('anon','public.list_my_food_ratings()','execute') then raise exception 'Incorrect history function grants'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='ratings' and policyname='ratings_insert_own' and with_check like '%is_campus_member%') then raise exception 'Rating email check is missing'; end if;
end $$;
do $$
declare member_id uuid;
begin
 select id into member_id from auth.users where is_anonymous=false and email_confirmed_at is not null and lower(email) ~ '^[^[:space:]@]+@zju[.]edu[.]cn$' order by created_at limit 1;
 if member_id is null then raise exception 'A real verified campus account is required for this check'; end if;
 perform set_config('campus.verify_rating_count',(select count(*)::text from public.ratings where user_id=member_id),true);
 perform set_config('request.jwt.claims',json_build_object('role','authenticated','sub',member_id)::text,true);
end $$;
set local role authenticated;
do $$
begin
 if (select count(*) from public.list_my_food_ratings()) <> current_setting('campus.verify_rating_count')::bigint then raise exception 'Own rating history mismatch'; end if;
 if exists(select 1 from public.list_my_food_ratings() h where not exists(select 1 from public.ratings r where r.food_id=h.food_id and r.user_id=auth.uid() and r.rating=h.rating) and h.food_name is not null) then raise exception 'History contains another account record'; end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000","email_verified":true}',true); end $$;
set local role authenticated;
do $$ begin
 begin perform public.list_my_food_ratings(); raise exception 'Unverified account was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.list_my_food_ratings(); raise exception 'Guest was allowed';
 exception when insufficient_privilege then null; end;
end $$;
select 'PASS: verified history, private access and public browsing' as result, (select count(*) from public.food_summaries) as publicly_visible_foods;
reset role;
select (select count(*) from public.foods) as all_foods, (select count(*) from public.ratings) as all_ratings, (select require_email from campus_private.food_auth_settings where singleton) as email_required;
rollback;
