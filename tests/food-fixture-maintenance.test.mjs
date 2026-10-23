import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const withdraw = await readFile(new URL('../supabase/maintenance/withdraw-acceptance-foods.sql', import.meta.url), 'utf8')
const restore = await readFile(new URL('../supabase/maintenance/restore-acceptance-foods.sql', import.meta.url), 'utf8')
const apply = (sql) => sql.replace(/rollback;\s*$/, 'commit;')
const targetDefinition = withdraw.slice(withdraw.indexOf('create temporary table acceptance_food_targets'), withdraw.indexOf('-- Private rollback evidence.'))

test('acceptance-food maintenance is precise, reversible and rolls back by default', async (t) => {
  const db = await PGlite.create()
  async function count(sql) { return (await db.query(sql)).rows[0].n }
  async function abortTransaction() { await db.exec('rollback') }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema campus_private;
      create table foods (
        id uuid primary key, name text, location text, area text, category text, price numeric,
        image_url text, description text, tags text[], created_at timestamptz,
        updated_at timestamptz, deleted_at timestamptz, created_by uuid
      );
      create table ratings(id integer generated always as identity primary key,food_id uuid references foods(id),rating integer);
      alter default privileges in schema campus_private grant all on tables to anon,authenticated,service_role;
      begin;
      ${targetDefinition}
      insert into foods select id,name,'功能测试，不是真实食堂或商家','campus','其他',price,
        'https://fixture.invalid/storage/v1/object/public/food-images/'||image_path,description,array['接入验收'],created_at,
        '2026-10-13T07:46:32.17726Z',null,'11111111-1111-4111-8111-111111111111'
        from acceptance_food_targets;
      insert into ratings(food_id,rating) select id,4 from acceptance_food_targets;
      insert into ratings(food_id,rating) values
        ('335f9643-764c-4ce4-96d8-8d5f1f349e11',1),('335f9643-764c-4ce4-96d8-8d5f1f349e11',3),
        ('0c29c274-8a48-4509-95c9-3fa916c3da5d',4);
      insert into foods values ('ffffffff-ffff-4fff-8fff-ffffffffffff','测试也是正常菜名','真实店铺','campus','其他',12,null,'真实内容','{}',now(),now(),null,null);
      commit;
    `)
    await t.test('preview leaves every row and the schema unchanged', async () => {
      await db.exec(withdraw)
      assert.equal(await count('select count(*)::int n from foods where deleted_at is not null'), 0)
      assert.equal(await count("select count(*)::int n from pg_tables where schemaname='campus_private' and tablename='acceptance_food_cleanup'"), 0)
    })
    await t.test('changed metadata or new ratings abort the entire operation', async () => {
      await db.exec("update foods set name='其他正常内容' where id='335f9643-764c-4ce4-96d8-8d5f1f349e11'")
      await assert.rejects(db.exec(apply(withdraw)), /Expected exactly 4 unchanged/)
      await abortTransaction()
      assert.equal(await count('select count(*)::int n from foods where deleted_at is not null'), 0)
      await db.exec("update foods set name='接入验收用菜品（PNG）' where id='335f9643-764c-4ce4-96d8-8d5f1f349e11'; insert into ratings(food_id,rating) values ('335f9643-764c-4ce4-96d8-8d5f1f349e11',5)")
      await assert.rejects(db.exec(apply(withdraw)), /Expected exactly 4 unchanged/)
      await abortTransaction()
      await db.exec('delete from ratings where rating=5')
    })
    await t.test('apply withdraws exactly four and keeps all ratings, images and real content', async () => {
      await db.exec(apply(withdraw))
      assert.equal(await count('select count(*)::int n from foods where deleted_at is not null'), 4)
      assert.equal(await count('select count(*)::int n from ratings'), 7)
      assert.equal(await count('select count(*)::int n from foods where image_url is not null'), 4)
      assert.equal(await count("select count(*)::int n from foods where name='测试也是正常菜名' and deleted_at is null"), 1)
      assert.equal(await count('select count(*)::int n from campus_private.acceptance_food_cleanup'), 4)
      const privileges = await db.query("select has_table_privilege(role,'campus_private.acceptance_food_cleanup','SELECT') allowed from unnest(array['anon','authenticated','service_role']) role")
      assert.deepEqual(privileges.rows.map((row) => row.allowed), [false,false,false])
    })
    await t.test('repeat apply cannot overwrite rollback evidence', async () => {
      await assert.rejects(db.exec(apply(withdraw)), /Cleanup already applied/)
      await abortTransaction()
      assert.equal(await count('select count(*)::int n from campus_private.acceptance_food_cleanup'), 4)
    })
    await t.test('restore refuses newer edits and defaults to rollback', async () => {
      await db.exec("update foods set description='后续编辑' where id='335f9643-764c-4ce4-96d8-8d5f1f349e11'")
      await assert.rejects(db.exec(apply(restore)), /changed/)
      await abortTransaction()
      assert.equal(await count('select count(*)::int n from foods where deleted_at is not null'), 4)
      await db.exec("update foods set description='用于验证上传、共享和评分；不是美食推荐。' where id='335f9643-764c-4ce4-96d8-8d5f1f349e11'")
      await db.exec(restore)
      assert.equal(await count('select count(*)::int n from foods where deleted_at is not null'), 4)
      await db.exec(apply(restore))
      assert.equal(await count('select count(*)::int n from foods where deleted_at is null'), 5)
      assert.equal(await count('select count(*)::int n from ratings'), 7)
      assert.equal(await count('select count(*)::int n from campus_private.acceptance_food_cleanup'), 4)
    })
  } finally { await db.close() }
})
