-- Personal-center history only. Apply after 202610130001; no profile rollout is required.
-- This migration does not change public browsing, rating eligibility or existing RLS.
begin;

create function public.list_my_food_ratings()
returns table (
  food_id uuid,
  rating integer,
  created_at timestamptz,
  food_name text,
  food_location text,
  food_image_url text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Verify the canonical Auth record, not caller metadata or an external user ID.
  perform campus_private.require_campus_member();
  return query
    select r.food_id, r.rating, r.created_at, f.name, f.location, f.image_url
    from public.ratings as r
    -- Keep the caller's rating history after withdrawal, without returning withdrawn
    -- food details (including to its author). No other account's history is returned.
    left join public.foods as f on f.id = r.food_id and f.deleted_at is null
    where r.user_id = (select auth.uid())
    order by r.created_at desc, r.id desc;
end;
$$;

revoke all on function public.list_my_food_ratings() from public, anon, authenticated;
grant execute on function public.list_my_food_ratings() to authenticated;
notify pgrst, 'reload schema';
commit;
