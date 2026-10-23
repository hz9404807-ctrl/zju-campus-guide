-- Optional, private account details. Apply after 202610130001_food_email_management.sql.
-- Independent of the deferred five-food-profile and favorites rollouts.
begin;

create table public.campus_account_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text not null default 'undisclosed' check (gender in ('undisclosed', 'female', 'male', 'other')),
  signature text not null default '' check (char_length(signature) <= 120 and signature !~ '[[:cntrl:]]'),
  campus text not null default '' check (campus in ('', '紫金港', '玉泉', '西溪', '华家池', '之江', '舟山', '海宁')),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.campus_account_details enable row level security;
revoke all on table public.campus_account_details from public, anon, authenticated;
grant select on table public.campus_account_details to authenticated;
create policy campus_details_owner_read on public.campus_account_details for select to authenticated
  using (user_id = (select auth.uid()) and (select campus_private.is_campus_member()));

create function public.get_my_campus_details(p_expected_user_id uuid)
returns setof public.campus_account_details
language plpgsql stable security definer set search_path = '' as $$
begin
  perform campus_private.require_campus_member();
  if p_expected_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Account changed.';
  end if;
  return query select d.* from public.campus_account_details d where d.user_id = auth.uid();
end;
$$;

create function public.save_my_campus_details(p_expected_user_id uuid, p_gender text, p_signature text, p_campus text, p_expected_updated_at timestamptz)
returns setof public.campus_account_details
language plpgsql security definer set search_path = '' as $$
begin
  perform campus_private.require_campus_member();
  if p_expected_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Account changed.';
  end if;
  -- Match the client code-point limit before trimming; do not let padding bypass it.
  if p_signature is null or pg_catalog.char_length(p_signature) > 120 or p_signature ~ '[[:cntrl:]]' then
    raise exception using errcode = '23514', message = 'Signature must be at most 120 characters without controls.';
  end if;
  if p_expected_updated_at is null then
    insert into public.campus_account_details(user_id, gender, signature, campus)
    values(auth.uid(), p_gender, pg_catalog.btrim(p_signature), p_campus)
    on conflict (user_id) do nothing;
    if not found then raise exception using errcode = '40001', message = 'Account details changed.'; end if;
  else
    update public.campus_account_details d
      set gender = p_gender, signature = pg_catalog.btrim(p_signature), campus = p_campus, updated_at = pg_catalog.clock_timestamp()
      where d.user_id = auth.uid() and d.updated_at = p_expected_updated_at;
    if not found then raise exception using errcode = '40001', message = 'Account details changed.'; end if;
  end if;
  return query select d.* from public.campus_account_details d where d.user_id = auth.uid();
end;
$$;
revoke all on function public.get_my_campus_details(uuid), public.save_my_campus_details(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.get_my_campus_details(uuid), public.save_my_campus_details(uuid,text,text,text,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
