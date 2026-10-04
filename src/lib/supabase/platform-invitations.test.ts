import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261004120000_platform_invitations.sql", "utf8").replace(String.fromCharCode(0xfeff), "");
const functionBody = (name: string) => {
  const start = migration.indexOf(`create function public.${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("$$;", migration.indexOf("as $$", start) + 5);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end);
};

test("invitations are one-hour, single-pending, role-limited records with RLS and audit", () => {
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /create unique index platform_invitations_one_pending_email[\s\S]*where status = 'pending'/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.platform_invitations from public, anon, authenticated, service_role/);
  assert.match(migration, /interval '1 hour'/);
  assert.match(migration, /create trigger platform_invitations_audit/);
  assert.match(migration, /platform\.invitation\.created/);
  assert.match(migration, /platform\.invitation\.'/);
  assert.match(migration, /role text not null check \(role in \('platform_admin', 'developer', 'support_staff'\)\)/);
});

test("only AAL2 authorized administrators create and revoke invitations", () => {
  const create = functionBody("create_platform_invitation");
  const revoke = functionBody("revoke_platform_invitation");
  assert.match(create, /auth\.jwt\(\) ->> 'aal'[\s\S]*aal2/);
  assert.match(create, /Only the Super Admin may invite a Platform Admin/);
  assert.match(create, /private\.has_platform_role\(array\['platform_admin'\]\)/);
  assert.match(revoke, /auth\.jwt\(\) ->> 'aal'[\s\S]*aal2/);
});

test("acceptance requires confirmed invite AMR, locks one live email invitation, and assigns its stored role atomically", () => {
  const accept = functionBody("accept_platform_invitation");
  assert.match(accept, /jsonb_path_exists.*method == "invite"/);
  assert.match(accept, /email_confirmed_at is not null and u\.invited_at is not null/);
  assert.match(accept, /expires_at > statement_timestamp\(\)/);
  assert.match(accept, /for update/);
  assert.match(accept, /insert into public\.platform_role_assignments\(user_id, role, assigned_by\)/);
  assert.match(accept, /select v_user, v_role, i\.invited_by/);
  assert.match(accept, /update public\.platform_invitations set status = 'accepted'/);
  assert.doesNotMatch(accept, /p_user_id|p_role/);
});

test("the verified invitation flow also recognizes the existing bootstrap and atomic transfer authorizations", () => {
  const inviteGate = functionBody("has_valid_auth_invitation");
  assert.match(inviteGate, /initial_super_admin_bootstrap_authorizations/);
  assert.match(inviteGate, /owner_super_admin_transfer_authorizations/);
  assert.match(inviteGate, /consumed_at is null/);
  assert.match(inviteGate, /a.status = 'authorized'/);
  assert.match(inviteGate, /method == "invite"/);
});

test("resending rotates the database authorization and preserves the authorized role", () => {
  const resend = functionBody("resend_platform_invitation");
  assert.match(resend, /status not in \('pending', 'expired'\)/);
  assert.match(resend, /private\.is_super_admin\(\)/);
  assert.match(resend, /private\.has_platform_role\(array\['platform_admin'\]\)/);
  assert.match(resend, /status = 'revoked'/);
  assert.match(resend, /values\(v_invitation\.email, v_invitation\.role, v_actor, statement_timestamp\(\) \+ interval '1 hour'\)/);
  assert.match(resend, /return next;/);
});







test("revocation changes only an active pending invitation and records its timestamp", () => {
  const revoke = functionBody("revoke_platform_invitation");
  assert.match(revoke, /where id = p_invitation_id for update/);
  assert.match(revoke, /if not found or v_invitation\.status <> 'pending' then return false/);
  assert.match(revoke, /set status = 'revoked', revoked_at = statement_timestamp\(\)/);
  assert.match(revoke, /where id = p_invitation_id/);
});

test("resend uses a new one-hour record and the originally authorized role", () => {
  const resend = functionBody("resend_platform_invitation");
  assert.match(resend, /status not in \('pending', 'expired'\)/);
  assert.match(resend, /update public\.platform_invitations set status = 'revoked'/);
  assert.match(resend, /values\(v_invitation\.email, v_invitation\.role, v_actor, statement_timestamp\(\) \+ interval '1 hour'\)/);
  assert.doesNotMatch(resend, /p_role/);
});

test("role assignment accepts only the role stored on the live invitation", () => {
  const accept = functionBody("accept_platform_invitation");
  assert.match(accept, /select i\.id, i\.role into v_invitation_id, v_role/);
  assert.match(accept, /where i\.email = v_email and i\.status = 'pending' and i\.expires_at > statement_timestamp\(\)/);
  assert.match(accept, /insert into public\.platform_role_assignments\(user_id, role, assigned_by\)[\s\S]*select v_user, v_role, i\.invited_by/);
  assert.doesNotMatch(accept, /p_role/);
});