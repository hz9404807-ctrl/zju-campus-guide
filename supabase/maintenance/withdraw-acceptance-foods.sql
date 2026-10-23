-- One-time maintenance, NOT a migration. Default: PREVIEW AND ROLLBACK.
-- Run only as the project database owner after the shared testing window.
-- Review docs/food-fixture-cleanup.md before changing the final ROLLBACK to COMMIT.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

create temporary table acceptance_food_targets (
  id uuid primary key, name text not null, price numeric not null,
  image_path text not null, description text not null,
  created_at timestamptz not null, rating_count integer not null, average_rating numeric not null
) on commit drop;
insert into acceptance_food_targets values
('335f9643-764c-4ce4-96d8-8d5f1f349e11', '接入验收用菜品（PNG）', 12.5, '8604f90e-2364-4f43-a65e-78a1c189495c/10e5344b-d65d-4e53-a1a1-25fdaf7b1213.png', '用于验证上传、共享和评分；不是美食推荐。', '2026-10-08T10:44:50.654715Z', 3, 2.7),
('a0d57c8e-2211-4814-a982-ce2af56afbe4', '接入验收用菜品（JPG）', 12.5, '8604f90e-2364-4f43-a65e-78a1c189495c/b596b7c5-7f23-491c-9570-84beac316264.jpg', '用于验证上传、共享和评分；不是美食推荐。', '2026-10-08T10:44:55.057771Z', 1, 4),
('707e55a6-7f7b-465c-9738-0e75dee69f2f', '接入验收用菜品（WEBP）', 12.5, '8604f90e-2364-4f43-a65e-78a1c189495c/cf04c733-6131-490a-8f68-e923b1379356.webp', '用于验证上传、共享和评分；不是美食推荐。', '2026-10-08T10:44:59.182687Z', 1, 4),
('0c29c274-8a48-4509-95c9-3fa916c3da5d', '网页流程验收用菜品', 8.5, 'f95879ae-9b50-4b81-9978-e599d8e10fe3/5b2fc2f2-f86e-43c4-9cbc-c26442800e5b.png', '用于验证网页发布、上传和评分；不是美食推荐。', '2026-10-08T10:50:05.741143Z', 2, 4);

-- Private rollback evidence. This schema already exists in the application.
-- No Auth user records, image objects or rating records are changed.
create table if not exists campus_private.acceptance_food_cleanup (
  operation text not null,
  food_id uuid not null,
  before_row jsonb not null,
  applied_at timestamptz not null,
  primary key (operation, food_id)
);
alter table campus_private.acceptance_food_cleanup enable row level security;
revoke all on table campus_private.acceptance_food_cleanup from public, anon, authenticated, service_role;

do $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  -- Row locks also block concurrent FK checks for new ratings on these targets.
  perform 1 from public.foods f join acceptance_food_targets t on f.id=t.id for update of f;
  perform 1 from public.ratings r join acceptance_food_targets t on r.food_id=t.id for update of r;
  if exists (select 1 from campus_private.acceptance_food_cleanup where operation='acceptance-foods-2026-10-24') then
    raise exception 'Cleanup already applied. Inspect the private audit and use the restore script; do not repeat it.';
  end if;
  select count(*) into v_count
  from public.foods f join acceptance_food_targets t on f.id=t.id
  where f.name=t.name and f.location='功能测试，不是真实食堂或商家'
    and f.area='campus' and f.category='其他' and f.price=t.price
    and f.description=t.description and f.tags=array['接入验收']::text[]
    and f.created_at=t.created_at and f.updated_at='2026-10-13T07:46:32.17726Z'::timestamptz
    and f.deleted_at is null
    and right(f.image_url, length('/storage/v1/object/public/food-images/' || t.image_path))='/storage/v1/object/public/food-images/' || t.image_path
    and (select count(*) from public.ratings r where r.food_id=f.id)=t.rating_count
    and (select round(avg(r.rating),1) from public.ratings r where r.food_id=f.id)=t.average_rating;
  if v_count <> 4 then
    raise exception 'Expected exactly 4 unchanged acceptance fixtures, found %. Nothing committed; inspect current records and test activity.', v_count;
  end if;
  insert into campus_private.acceptance_food_cleanup(operation,food_id,before_row,applied_at)
    select 'acceptance-foods-2026-10-24',f.id,to_jsonb(f),v_now from public.foods f join acceptance_food_targets t on f.id=t.id;
  update public.foods f set deleted_at=v_now,updated_at=v_now from acceptance_food_targets t where f.id=t.id;
  get diagnostics v_count=row_count;
  if v_count <> 4 then raise exception 'Unexpected cleanup count: %',v_count; end if;
end;
$$;

-- This output is safe to review: it omits author identity and image credentials.
select f.id,f.name,f.deleted_at as preview_withdrawn_at,
  (select count(*) from public.ratings r where r.food_id=f.id) as retained_ratings
from public.foods f join acceptance_food_targets t on f.id=t.id order by f.name;

-- Default preview. Change this ONE final line to COMMIT only after review.
rollback;
