import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { invitationListFailureMessage, safeInvitationListErrorCode } from "./invitation-list-status.ts";

const migration = readFileSync("supabase/migrations/20261004120000_platform_invitations.sql", "utf8");
const page = readFileSync("src/components/platform/workspace-content.tsx", "utf8");
const actions = readFileSync("src/lib/supabase/actions.ts", "utf8");
const controls = readFileSync("src/components/auth/invitation-row-actions.tsx", "utf8");

test("Super Admin invitation listing uses the protected database RPC and renders every lifecycle field", () => {
  const start = migration.indexOf("create function public.list_platform_invitations");
  const end = migration.indexOf("$$;", migration.indexOf("as $$", start) + 5);
  const listFunction = migration.slice(start, end);
  assert.match(page, /supabase\.rpc\("list_platform_invitations"\)/);
  assert.match(page, /<th>Email<\/th><th>Role<\/th><th>Status<\/th><th>Created<\/th><th>Expires<\/th><th>Resent<\/th>/);
  assert.match(listFunction, /auth\.uid\(\) is null/);
  assert.match(listFunction, /auth\.jwt\(\) ->> 'aal'[\s\S]*aal2/);
  assert.match(listFunction, /private\.is_super_admin\(\) or private\.has_platform_role\(array\['platform_admin'\]\)/);
  assert.match(migration, /grant execute on function public\.list_platform_invitations\(\) to authenticated/);
  assert.match(migration, /revoke all on table public\.platform_invitations from public, anon, authenticated, service_role/);
});

test("unauthorized users cannot list or mutate invitation records", () => {
  assert.match(actions, /requireWorkspace\("admin", \["team"\]\)/);
  assert.match(actions, /roles\.some\(\(role\) => role === "super_admin" \|\| role === "platform_admin"\)/);
  assert.match(migration, /not \(private\.is_super_admin\(\) or private\.has_platform_role\(array\['platform_admin'\]\)\)/);
});

test("resend preserves role and revoke updates only pending rows through authorized RPCs", () => {
  assert.match(actions, /rpc\("resend_platform_invitation"/);
  assert.match(actions, /rpc\("revoke_platform_invitation"/);
  assert.match(controls, /useActionState\(resendPlatformInvitationAction/);
  assert.match(controls, /useActionState\(revokePlatformInvitationAction/);
  assert.match(migration, /values\(v_invitation\.email, v_invitation\.role, v_actor, statement_timestamp\(\) \+ interval '1 hour'\)/);
  assert.match(migration, /if not found or v_invitation\.status <> 'pending' then return false/);
});

test("invitation listing errors show safe actionable messages and never expose SQL text", () => {
  assert.equal(safeInvitationListErrorCode("42501"), "42501");
  assert.equal(safeInvitationListErrorCode("email@secret.example"), "UNKNOWN");
  assert.match(invitationListFailureMessage("42501"), /sign in again.*complete MFA/i);
  assert.match(invitationListFailureMessage("PGRST202"), /migration.*schema cache/i);
  assert.doesNotMatch(invitationListFailureMessage("XX000"), /secret|token|password/i);
  assert.match(page, /safeInvitationListErrorCode\(invitationError\.code\)/);
  assert.match(page, /invitationListFailureMessage\(invitationError\.code\)/);
});
