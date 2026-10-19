-- Verified-campus writes. Apply after 202610130001; profiles are not required.
-- Existing foods, ratings, public reads and anonymous identities are preserved.
begin;

-- The existing publication RPC already consults this private setting.
insert into campus_private.food_auth_settings (singleton, require_email)
values (true, true)
on conflict (singleton) do update set require_email = true;

-- RLS remains the enforcement boundary even when a caller skips the website.
alter policy ratings_insert_own on public.ratings to authenticated
with check (
  user_id = (select auth.uid())
  and (select campus_private.is_campus_member())
  and exists (select 1 from public.foods f where f.id = food_id and f.deleted_at is null)
);

notify pgrst, 'reload schema';
commit;
