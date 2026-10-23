-- Restore the exact one-time withdrawal. Default: PREVIEW AND ROLLBACK.
-- Owner only; see docs/food-fixture-cleanup.md. Do not restore changed records.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $$
declare v_count integer;
begin
  perform 1 from public.foods f join campus_private.acceptance_food_cleanup b on b.food_id=f.id
    where b.operation='acceptance-foods-2026-10-24' for update of f;
  if (select count(*) from campus_private.acceptance_food_cleanup where operation='acceptance-foods-2026-10-24') <> 4 then
    raise exception 'Expected the complete 4-row cleanup audit. Nothing restored.';
  end if;
  select count(*) into v_count from public.foods f join campus_private.acceptance_food_cleanup b on b.food_id=f.id
    where b.operation='acceptance-foods-2026-10-24'
      and f.deleted_at=b.applied_at and f.updated_at=b.applied_at
      and (to_jsonb(f)-'deleted_at'-'updated_at')=(b.before_row-'deleted_at'-'updated_at');
  if v_count <> 4 then raise exception 'Some withdrawn records have changed. Restore aborted to preserve newer edits.'; end if;
  update public.foods f set deleted_at=(b.before_row->>'deleted_at')::timestamptz,updated_at=clock_timestamp()
    from campus_private.acceptance_food_cleanup b where f.id=b.food_id and b.operation='acceptance-foods-2026-10-24';
  get diagnostics v_count=row_count;
  if v_count <> 4 then raise exception 'Unexpected restore count: %',v_count; end if;
end;
$$;
select f.id,f.name,f.deleted_at as preview_restored_state from public.foods f join campus_private.acceptance_food_cleanup b on b.food_id=f.id
  where b.operation='acceptance-foods-2026-10-24' order by f.name;

-- Keep the audit private for review. The restore keeps an updated concurrency timestamp.
-- Change this ONE final line to COMMIT after reviewing the 4 rows above.
rollback;
