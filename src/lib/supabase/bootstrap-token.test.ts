import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { issueOwnerBootstrapToken, verifyOwnerBootstrapToken } from "./bootstrap-token.ts";

const secret = "local-test-only-signing-secret-which-is-at-least-32-bytes";
const migration = readFileSync("supabase/migrations/20260929142302_auth_invitation_bootstrap.sql", "utf8").replace(String.fromCharCode(0xfeff), "");
const foundation = readFileSync("supabase/migrations/20260929131309_foundation_identity_tenancy.sql", "utf8");
const functionBody = (name: string, source = migration) => {
  const start = source.indexOf(`create function public.${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf("$$;", source.indexOf("as $$", start) + 5);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end);
};

test("owner bootstrap token is valid only inside its bounded 15 minute window", () => {
  const token = issueOwnerBootstrapToken(secret, 1_000);
  assert.ok(verifyOwnerBootstrapToken(token, secret, 1_001));
  assert.equal(verifyOwnerBootstrapToken(token, secret, 1_900), null);
});

test("expired and tampered owner bootstrap tokens fail verification", () => {
  const token = issueOwnerBootstrapToken(secret, 1_000);
  assert.equal(verifyOwnerBootstrapToken(token, secret, 1_900), null);
  assert.equal(verifyOwnerBootstrapToken(token + "x", secret, 1_001), null);
});

test("migration stores expiry and only a nonce digest, never the bearer token", () => {
  assert.match(migration, /expires_at timestamptz not null/);
  assert.match(migration, /owner_token_nonce_hash text not null unique/);
  assert.doesNotMatch(migration, /owner_token text/i);
  assert.match(functionBody("authorize_initial_super_admin"), /p_expires_at <= statement_timestamp\(\)/);
  assert.match(functionBody("authorize_initial_super_admin"), /p_expires_at > statement_timestamp\(\) \+ interval '24 hours'/);
});

test("expired authorization is rejected by both creation and claim functions", () => {
  assert.match(functionBody("authorize_initial_super_admin"), /p_expires_at <= statement_timestamp\(\)/);
  assert.match(functionBody("bootstrap_initial_super_admin"), /v_expires_at <= statement_timestamp\(\)/);
});

test("retries cannot refresh or replace a consumed owner token authorization", () => {
  const body = functionBody("authorize_initial_super_admin");
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /Initial bootstrap authorization is already consumed and cannot be replaced or refreshed/);
  assert.match(body, /owner_token_nonce_hash, expires_at/);
});

test("concurrent authorization and claim attempts serialize on the same transaction lock", () => {
  const authorize = functionBody("authorize_initial_super_admin");
  const claim = functionBody("bootstrap_initial_super_admin");
  assert.ok(authorize.indexOf("pg_advisory_xact_lock") < authorize.indexOf("Initial bootstrap authorization is already consumed"));
  assert.ok(claim.indexOf("pg_advisory_xact_lock") < claim.indexOf("insert into public.platform_super_admin_designation"));
  assert.match(migration, /slot smallint primary key default 1 check \(slot = 1\)/);
});

test("claim requires invited confirmed identity, verified TOTP, and AAL2 without caller-supplied user id", () => {
  const body = functionBody("bootstrap_initial_super_admin");
  assert.match(body, /auth\.uid\(\)/);
  assert.match(body, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(body, /v_email_confirmed_at is null/);
  assert.match(body, /v_invited_at is null/);
  assert.match(body, /f\.status::text = 'verified'/);
  assert.match(body, /f\.factor_type::text = 'totp'/);
  assert.doesNotMatch(body, /p_user_id/);
});

test("designation, authorization consumption, and designation audit trigger are transactionally coupled", () => {
  const body = functionBody("bootstrap_initial_super_admin");
  assert.ok(body.indexOf("insert into public.platform_super_admin_designation") < body.indexOf("update public.initial_super_admin_bootstrap_authorizations"));
  assert.match(foundation, /create trigger super_admin_designation_audit\s+after insert or update or delete on public\.platform_super_admin_designation/);
  assert.match(foundation, /create constraint trigger super_admin_designation_must_remain_set/);
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
});

test("database function privileges prevent anonymous, public, or ordinary table access", () => {
  assert.match(migration, /revoke all on table public\.initial_super_admin_bootstrap_authorizations\s+from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.initial_super_admin_bootstrap_authorizations from service_role/);
  assert.match(migration, /revoke all on function public\.authorize_initial_super_admin\(text, timestamptz, text\)\s+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.authorize_initial_super_admin\(text, timestamptz, text\)\s+to service_role/);
});
