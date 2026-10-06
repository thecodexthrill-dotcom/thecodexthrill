import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
const acceptPage = readFileSync("src/app/invite/accept/page.tsx", "utf8");
const actions = readFileSync("src/lib/supabase/actions.ts", "utf8");
const ui = readFileSync("src/components/platform/workspace-content.tsx", "utf8");
const rows = readFileSync("src/components/auth/invitation-row-actions.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261005120000_platform_invitation_auth_lifecycle.sql", "utf8");
const archiveMigration = readFileSync("supabase/migrations/20261005150000_platform_invitation_archive.sql", "utf8");
const listRbacMigration = readFileSync("supabase/migrations/20261006120000_platform_invitation_list_rbac.sql", "utf8");

test("invite acceptance validates the authenticated invite identity against its recorded invitation", () => {
  assert.ok(acceptPage.includes("get_auth_invitation_status"));
  assert.ok(acceptPage.includes("hasFreshInvitationSession"));
  assert.ok(migration.includes("i.auth_user_id is null or i.auth_user_id = v_user"));
  assert.ok(migration.includes("u.email_confirmed_at is not null and u.invited_at is not null"));
  assert.ok(migration.includes("select v_user, v_role, i.invited_by"));
  assert.ok(!migration.includes("p_role"));
});

test("expired, accepted, and revoked invitations remain distinct and revocation never deletes Auth users", () => {
  assert.ok(migration.includes("return 'expired'"));
  assert.ok(migration.includes("return v_invitation.status"));
  assert.ok(migration.includes("status = 'revoked', revoked_at = statement_timestamp()"));
  assert.ok(!migration.includes("delete from auth.users"));
  assert.ok(!actions.includes("admin.deleteUser"));
  assert.ok(archiveMigration.includes("status not in ('expired', 'accepted', 'revoked')"));
  assert.ok(archiveMigration.includes("archived_at = coalesce(archived_at, statement_timestamp())"));
  assert.ok(!archiveMigration.includes("delete from auth.users"));
});

test("resend rotates expiry, records resend metadata, and binds the same Auth user", () => {
  assert.ok(migration.includes("v_invitation.auth_user_id, v_invitation.resend_count + 1, v_now"));
  assert.ok(migration.includes("v_now + interval '1 hour'"));
  assert.ok(actions.includes("admin.auth.admin.inviteUserByEmail(invitation.email, { redirectTo })"));
  assert.ok(actions.includes("link_platform_invitation_auth_user"));
  assert.ok(migration.includes("A newer active invitation already exists"));
  assert.ok(listRbacMigration.includes("where private.is_super_admin() or i.role <> 'platform_admin'"));
});

test("Super Admin sees lifecycle and resend fields; Platform Admin cannot manage Super Admin invitations", () => {
  assert.ok(ui.includes("<h2>Invitations</h2>"));
  assert.ok(ui.includes("<th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Expires</th><th>Resent</th>"));
  assert.ok(ui.includes('roles.includes("super_admin") || (roles.includes("platform_admin") && invitation.role !== "platform_admin")'));
  assert.ok(rows.includes("Resend Invitation"));
  assert.ok(rows.includes("Revoke Invitation"));
  assert.ok(rows.includes("Archive Invitation"));
  assert.ok(ui.includes("archived_at"));
  assert.ok(migration.includes("Only the Super Admin may revoke a Platform Admin invitation"));
});

test("invitation read and mutation functions retain AAL2 admin authorization and private table access", () => {
  assert.ok(migration.includes("auth.jwt() ->> 'aal'"));
  assert.ok(migration.includes("'aal2'"));
  assert.ok(migration.includes("private.is_super_admin() or private.has_platform_role(array['platform_admin'])"));
  assert.ok(migration.includes("revoke all on function public.get_auth_invitation_status() from public, anon"));
  assert.ok(migration.includes("grant execute on function public.get_auth_invitation_status() to authenticated"));
  assert.ok(callback.includes("isInvitationCallback({ code, tokenHash, otpType, next })"));
});
