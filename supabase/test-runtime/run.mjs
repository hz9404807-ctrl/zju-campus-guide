// Local SQL-only checks. This is not Supabase Auth, Storage or its HTTP gateway.
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = await PGlite.create()
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    create schema auth;
    create schema storage;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      aud text,
      role text,
      is_anonymous boolean,
      email text,
      email_change text,
      email_confirmed_at timestamptz,
      created_at timestamptz,
      updated_at timestamptz
    );
    grant usage on schema auth to supabase_auth_admin;
    grant select,insert,update on auth.users to supabase_auth_admin;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select auth.jwt()->>'role' $$;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner_id text,
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `)

  const migration = await readFile(new URL('../migrations/202610020001_initial.sql', import.meta.url), 'utf8')
  const checks = await readFile(new URL('../tests.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  const results = await db.exec(checks)
  const result = results.flatMap((item) => item.rows ?? []).find((row) => typeof row.result === 'string')
  await db.exec(await readFile(new URL('../migrations/202610130001_food_email_management.sql', import.meta.url), 'utf8'))
  const emailChecks = await readFile(new URL('../email-management.tests.sql', import.meta.url), 'utf8')
  const emailResults = await db.exec(emailChecks)
  console.log(emailResults.flatMap((r) => r.rows ?? []).find((r) => r.result)?.result ?? 'Email management checks passed.')
  console.log(`Email assertions: ${(emailChecks.match(/select pg_temp\.(?:check_it|expect_state)\(/g) ?? []).length}`)
  // The personal-center migration must work on the deployed email-only schema;
  // it must not depend on opening the still-deferred profile rollout.
  await db.exec(await readFile(new URL('../migrations/202610170001_personal_center_ratings.sql', import.meta.url), 'utf8'))
  const personalChecks = await readFile(new URL('../personal-center.tests.sql', import.meta.url), 'utf8')
  async function checkPersonalHistory(stage) {
    const personalResults = await db.exec(personalChecks)
    console.log(personalResults.flatMap((r) => r.rows ?? []).find((r) => r.result)?.result ?? 'Personal-center checks passed.')
    console.log(`Personal-center assertions (${stage}): ${(personalChecks.match(/select pg_temp\.(?:check_personal|expect_personal)\(/g) ?? []).length}`)
  }
  await checkPersonalHistory('email-only schema')
  await db.exec(await readFile(new URL('../migrations/202610130002_food_profiles.sql', import.meta.url), 'utf8'))
  const profileChecks = await readFile(new URL('../food-profiles.tests.sql', import.meta.url), 'utf8')
  const profileResults = await db.exec(profileChecks)
  console.log(profileResults.flatMap((r) => r.rows ?? []).find((r) => r.result)?.result ?? 'Profile checks passed.')
  console.log('Profile assertions: ' + (profileChecks.match(/select pg_temp\.(?:check_profile|expect_profile)\(/g) ?? []).length)
  await checkPersonalHistory('profile-compatible schema')
  const leftover = await db.query('select (select count(*) from public.foods)::int as foods, (select count(*) from public.ratings)::int as ratings, (select count(*) from auth.users)::int as users, (select count(*) from public.food_profiles)::int as profiles')
  if (Object.values(leftover.rows[0]).some((count) => count !== 0)) {
    throw new Error('SQL tests did not roll back all their fixtures')
  }
  console.log(result?.result ?? 'SQL checks passed.')
  console.log(`Assertions: ${(checks.match(/select pg_temp\.(?:assert_true|expect_sqlstate)\(/g) ?? []).length}`)
  console.log('Rollback verified: no food, rating, user or profile test fixtures remain.')
  console.log('Scope: embedded PostgreSQL plus minimal Auth/Storage schema fixtures; no live Supabase service was contacted.')
} catch (error) {
  console.error('SQL checks failed:', error.message)
  if (error.detail) console.error('Detail:', error.detail)
  if (error.where) console.error('Where:', error.where)
  process.exitCode = 1
} finally {
  await db.close()
}
