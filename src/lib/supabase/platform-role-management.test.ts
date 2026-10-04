import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261004150000_platform_role_management.sql", "utf8").replace(String.fromCharCode(0xfeff), "");
const functionBody = (name: string) => {
  const start = migration.indexOf(`create function public.${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("$$;", migration.indexOf("as $$", start) + 5);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end);
};

test("platform user listing is restricted to authenticated AAL2 platform admins", () => {
  const listing = functionBody("list_platform_users");
  assert.match(listing, /security definer[\s\S]*set search_path = ''/);
  assert.match(listing, /auth\.jwt\(\) ->> 'aal'[\s\S]*aal2/);
  assert.match(listing, /private\.is_super_admin\(\) or private\.has_platform_role\(array\['platform_admin'\]\)/);
  assert.match(listing, /from auth\.users/);
  assert.match(listing, /u\.invited_at is not null/);
  assert.match(migration, /grant execute on function public\.list_platform_users\(\) to authenticated/);
});

test("platform role changes enforce MFA, invitation verification, hierarchy and audit triggers", () => {
  const setter = functionBody("set_platform_role");
  assert.match(setter, /auth\.jwt\(\) ->> 'aal'[\s\S]*aal2/);
  assert.match(setter, /p_role not in \('platform_admin', 'developer', 'support_staff'\)/);
  assert.match(setter, /p_role = 'platform_admin' and not v_has_super_admin/);
  assert.match(setter, /Only the Super Admin may change a Platform Admin role/);
  assert.match(setter, /p_user_id = v_actor/);
  assert.match(setter, /email_confirmed_at is not null and not u\.is_anonymous/);
  assert.match(setter, /platform_super_admin_designation where user_id = p_user_id/);
  assert.match(setter, /update public\.platform_role_assignments[\s\S]*set revoked_at/);
  assert.match(setter, /insert into public\.platform_role_assignments\(user_id, role, assigned_by\)/);
  assert.match(migration, /grant execute on function public\.set_platform_role\(uuid, text\) to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete|all) on table public\.platform_role_assignments/i);
});