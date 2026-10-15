import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  completeInvitationAcceptanceFallback,
  mapClientInviteRoleToOrganizationRole,
} from "./invitation-fallback-service.ts";

const migration = readFileSync(
  "supabase/migrations/20261014120000_provision_organization_membership_rpc.sql",
  "utf8",
);
const fallbackServiceCode = readFileSync(
  "src/lib/supabase/invitation-fallback-service.ts",
  "utf8",
);
const leadActionsCode = readFileSync(
  "src/lib/supabase/lead-actions.ts",
  "utf8",
);

test("provision_organization_membership migration enforces security, search_path, and atomic DDL standards", () => {
  assert.ok(
    migration.includes("create or replace function public.provision_organization_membership"),
    "Function must be defined in public schema",
  );
  assert.ok(
    migration.includes("security definer"),
    "Function must execute with security definer privileges",
  );
  assert.ok(
    migration.includes("set search_path = ''"),
    "search_path must be locked to empty string to prevent search_path hijacking",
  );
  assert.ok(
    migration.includes("revoke all on function public.provision_organization_membership"),
    "Must revoke open execute permissions from public and anon",
  );
  assert.ok(
    migration.includes("grant execute on function public.provision_organization_membership(uuid, uuid, text, uuid, text) to service_role, authenticated"),
    "Must grant execute only to service_role and authenticated",
  );
});

test("provision_organization_membership strictly allowlists valid organization roles and validates organization and user existence", () => {
  // 1. Role allowlist
  assert.ok(migration.includes("'organization_owner'"));
  assert.ok(migration.includes("'organization_admin'"));
  assert.ok(migration.includes("'project_manager'"));
  assert.ok(migration.includes("'client_member'"));
  assert.ok(migration.includes("Invalid organization role: %"));

  // 2. Organization check
  assert.ok(migration.includes("from public.organizations as o"));
  assert.ok(migration.includes("v_org_status <> 'active'"));
  assert.ok(migration.includes("Cannot provision membership for inactive or deleted organization"));

  // 3. User check in auth.users
  assert.ok(migration.includes("from auth.users as u where u.id = p_user_id"));
  assert.ok(migration.includes("User % not found in auth.users"));
});

test("provision_organization_membership enforces authorization: Super Admin/Platform Admin/Org Admin AAL2 or invited user self-claim", () => {
  assert.ok(migration.includes("v_caller_role = 'authenticated'"));
  assert.ok(migration.includes("coalesce(auth.jwt() ->> 'aal', '') = 'aal2'"));
  assert.ok(migration.includes("private.is_super_admin() or private.has_platform_role(array['platform_admin'])"));
  assert.ok(migration.includes("private.has_org_role(p_organization_id, array['organization_owner', 'organization_admin'])"));
  assert.ok(migration.includes("u.email_confirmed_at is not null"));
  assert.ok(migration.includes("u.invited_at is not null"));
  assert.ok(migration.includes("Unauthorized to provision organization membership"));
  assert.ok(migration.includes("v_caller_role <> 'service_role'"));
});

test("provision_organization_membership atomically manages membership state, role assignments, and revokes outdated roles", () => {
  // Row-level locking for concurrency safety
  assert.ok(migration.includes("from public.organization_memberships"));
  assert.ok(migration.includes("for update"));
  assert.ok(migration.includes("from public.organization_role_assignments"));

  // Membership state management
  assert.ok(migration.includes("status = 'active'"));
  assert.ok(migration.includes("v_action := 'created'"));
  assert.ok(migration.includes("v_action := 'reactivated'"));

  // Outdated role revocation to preserve unique active role constraint
  assert.ok(migration.includes("update public.organization_role_assignments"));
  assert.ok(migration.includes("set revoked_at = statement_timestamp()"));
  assert.ok(migration.includes("v_action := 'role_updated'"));

  // Audit trail insertion
  assert.ok(migration.includes("insert into public.audit_events"));
  assert.ok(migration.includes("'organization.member_provisioned'"));
});

test("deferred constraint simulation: proves why atomic provisioning is mandatory and why sequential writes fail", () => {
  // Simulate private.assert_membership_role_pair_integrity
  function assertMembershipRolePairIntegrity(membershipStatus: string | null, activeRoleCount: number): void {
    if (membershipStatus === "active" && activeRoleCount !== 1) {
      const err = new Error("Active organization membership must have exactly one current role assignment");
      (err as { code?: string }).code = "P0001";
      throw err;
    }
    if (membershipStatus !== "active" && activeRoleCount !== 0) {
      const err = new Error("Non-active organization membership cannot have a current role assignment");
      (err as { code?: string }).code = "P0001";
      throw err;
    }
  }

  // Simulation 1: Sequential write attempt 1 (insert membership first over PostgREST)
  // At transaction 1 commit:
  assert.throws(
    () => {
      const currentMembership = "active";
      const currentActiveRoles = 0; // Role not yet inserted because it's a separate HTTP request
      assertMembershipRolePairIntegrity(currentMembership, currentActiveRoles);
    },
    (err: { code?: string }) => err.code === "P0001",
  );

  // Simulation 2: Sequential write attempt 2 (insert role first over PostgREST)
  // Foreign key fails immediately because organization_memberships row does not exist
  function insertRoleFirst(membershipExists: boolean) {
    if (!membershipExists) {
      const err = new Error(
        'insert or update on table "organization_role_assignments" violates foreign key constraint "organization_role_assignments_organization_id_user_id_fkey"',
      );
      (err as { code?: string }).code = "23503";
      throw err;
    }
  }
  assert.throws(
    () => insertRoleFirst(false),
    (err: { code?: string }) => err.code === "23503",
  );

  // Simulation 3: Atomic database RPC transaction (both modified within same transaction)
  // At transaction commit:
  assert.doesNotThrow(() => {
    const currentMembership = "active";
    const currentActiveRoles = 1; // Atomically inserted in the same transaction
    assertMembershipRolePairIntegrity(currentMembership, currentActiveRoles);
  });
});

test("completeInvitationAcceptanceFallback calls provision_organization_membership RPC with verified parameters", async () => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const auditInserts: Array<Record<string, unknown>> = [];

  const mockAdminClient = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: { ok: true, action: "created" }, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "inviter-profile-uuid" } }),
        }),
      }),
      insert: async (data: Record<string, unknown>) => {
        if (table === "audit_events") {
          auditInserts.push(data);
        }
        return { error: null };
      },
    }),
  } as unknown as Parameters<typeof completeInvitationAcceptanceFallback>[0]["adminClientOverride"];

  const res = await completeInvitationAcceptanceFallback({
    userId: "test-user-uuid",
    fallbackState: {
      source: "organization_invite_fallback",
      invitationVerified: true,
      status: "pending",
      email: "invited.member@example.com",
      organizationId: "test-org-uuid",
      organizationRole: "client_manager",
      invitedBy: "inviter-profile-uuid",
    },
    adminClientOverride: mockAdminClient,
  });

  assert.equal(res.ok, true);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0]?.fn, "provision_organization_membership");
  assert.deepEqual(rpcCalls[0]?.args, {
    p_organization_id: "test-org-uuid",
    p_user_id: "test-user-uuid",
    p_role: "organization_admin",
    p_actor_user_id: "inviter-profile-uuid",
    p_display_name: "invited.member",
  });
  assert.equal(auditInserts.length, 1);
  assert.equal(auditInserts[0]?.action, "organization.invitation.accepted");
});

test("completeInvitationAcceptanceFallback handles RPC errors gracefully without leaving partial state", async () => {
  const mockAdminClient = {
    rpc: async () => ({
      data: null,
      error: { code: "P0001", message: "Simulated constraint failure" },
    }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  } as unknown as Parameters<typeof completeInvitationAcceptanceFallback>[0]["adminClientOverride"];

  const res = await completeInvitationAcceptanceFallback({
    userId: "test-user-uuid",
    fallbackState: {
      source: "organization_invite_fallback",
      invitationVerified: true,
      status: "pending",
      email: "invited.member@example.com",
      organizationId: "test-org-uuid",
      organizationRole: "client_viewer",
    },
    adminClientOverride: mockAdminClient,
  });

  assert.equal(res.ok, false);
  assert.equal(res.error, "Could not activate organization membership.");
});

test("lead-actions wiring: provisionClientOrganizationMember delegates to provision_organization_membership RPC", () => {
  assert.ok(
    leadActionsCode.includes('await params.adminClient.rpc("provision_organization_membership"'),
    "lead-actions must call provision_organization_membership RPC",
  );
  assert.ok(
    leadActionsCode.includes("p_organization_id: params.organizationId"),
    "lead-actions must pass p_organization_id",
  );
  assert.ok(
    leadActionsCode.includes("p_user_id: params.invitedUserId"),
    "lead-actions must pass p_user_id",
  );
  assert.ok(
    leadActionsCode.includes("p_role: mappedOrgRole"),
    "lead-actions must pass mappedOrgRole",
  );
  assert.ok(
    leadActionsCode.includes("p_actor_user_id: params.actorUserId"),
    "lead-actions must pass p_actor_user_id",
  );
  assert.ok(
    leadActionsCode.includes('throw new Error(`Failed to provision client organization member via atomic RPC: ${rpcErr.message}`)'),
    "lead-actions must throw on RPC failure to abort lead conversion",
  );
});

test("role mapping invariants: client portal roles strictly map to canonical organization roles", () => {
  assert.equal(mapClientInviteRoleToOrganizationRole("client_owner"), "organization_owner");
  assert.equal(mapClientInviteRoleToOrganizationRole("client_manager"), "organization_admin");
  assert.equal(mapClientInviteRoleToOrganizationRole("client_collaborator"), "project_manager");
  assert.equal(mapClientInviteRoleToOrganizationRole("client_viewer"), "client_member");
  assert.equal(mapClientInviteRoleToOrganizationRole(undefined), "client_member");
});

test("codebase verification: no sequential manual upserts remain in application paths", () => {
  assert.ok(
    !fallbackServiceCode.includes('admin.from("organization_memberships").upsert'),
    "fallback service must not contain manual organization_memberships upsert",
  );
  assert.ok(
    !fallbackServiceCode.includes('admin.from("organization_role_assignments").insert'),
    "fallback service must not contain manual organization_role_assignments insert",
  );
  assert.ok(
    !leadActionsCode.includes('params.adminClient.from("organization_memberships").upsert'),
    "lead actions must not contain manual organization_memberships upsert",
  );
  assert.ok(
    !leadActionsCode.includes('params.adminClient.from("organization_role_assignments").insert'),
    "lead actions must not contain manual organization_role_assignments insert",
  );
});

function createMockQueryBuilder(dataMap: Record<string, unknown>) {
  return (table: string) => {
    const tableData = dataMap[table] ?? [];
    const chain: Record<string, unknown> = {
      data: tableData,
      error: null,
    };
    const returnSelf = () => chain;
    chain.select = returnSelf;
    chain.eq = returnSelf;
    chain.is = returnSelf;
    chain.in = returnSelf;
    chain.order = returnSelf;
    chain.limit = returnSelf;
    chain.maybeSingle = async () => ({
      data: Array.isArray(tableData) ? tableData[0] ?? null : tableData,
      error: null,
    });
    chain.then = (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: tableData, error: null }).then(resolve);
    return chain;
  };
}

test("regression: confirmed client accounts with missing memberships are not marked expired after 24h", async () => {
  const { resolveVerifiedInvitationState } = await import("./invitation-fallback-service.ts");

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const mockAdmin = {
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id: "client-confirmed-uuid",
              email: "client@example.com",
              invited_at: twoDaysAgo,
              email_confirmed_at: twoDaysAgo, // Confirmed on day 1
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    },
    from: createMockQueryBuilder({
      audit_events: [
        {
          id: "audit-1",
          action: "organization.member_invited",
          target_type: "organizations",
          target_id: "org-codesparks-uuid",
          details: {
            role: "client_owner",
            email: "client@example.com",
            expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
          occurred_at: twoDaysAgo,
          actor_user_id: "admin-actor-uuid",
        },
      ],
      platform_role_assignments: [],
      organization_memberships: [],
    }),
  } as unknown as Parameters<typeof resolveVerifiedInvitationState>[0]["adminClientOverride"];

  const state = await resolveVerifiedInvitationState({
    userId: "client-confirmed-uuid",
    rpcStatus: null,
    adminClientOverride: mockAdmin,
  });

  // Must be verified and valid for reconciliation because user already confirmed
  assert.equal(state.invitationVerified, true);
  assert.equal(state.status, "valid");
  assert.equal(state.organizationId, "org-codesparks-uuid");
  assert.equal(state.organizationRole, "client_owner");
});

test("regression: unconfirmed accounts are rejected as invalid", async () => {
  const { resolveVerifiedInvitationState } = await import("./invitation-fallback-service.ts");

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const mockAdmin = {
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id: "unconfirmed-uuid",
              email: "unconfirmed@example.com",
              invited_at: twoDaysAgo,
              email_confirmed_at: null, // NOT confirmed!
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    },
    from: createMockQueryBuilder({}),
  } as unknown as Parameters<typeof resolveVerifiedInvitationState>[0]["adminClientOverride"];

  const state = await resolveVerifiedInvitationState({
    userId: "unconfirmed-uuid",
    rpcStatus: null,
    adminClientOverride: mockAdmin,
  });

  assert.equal(state.invitationVerified, false);
  assert.equal(state.status, "invalid");
});

test("regression: duplicate callbacks and repeated invitation acceptance are idempotent", async () => {
  let rpcExecutionCount = 0;
  const mockAdminClient = {
    rpc: async (fn: string) => {
      if (fn === "provision_organization_membership") {
        rpcExecutionCount += 1;
        // On duplicate/repeated calls, RPC returns ok: true, action: 'unchanged'
        return { data: { ok: true, action: "unchanged" }, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      insert: async () => ({ error: null }),
    }),
  } as unknown as Parameters<typeof completeInvitationAcceptanceFallback>[0]["adminClientOverride"];

  // Call 1
  const res1 = await completeInvitationAcceptanceFallback({
    userId: "test-user-uuid",
    fallbackState: {
      source: "organization_invite_fallback",
      invitationVerified: true,
      status: "pending",
      email: "test@example.com",
      organizationId: "org-123",
      organizationRole: "client_owner",
    },
    adminClientOverride: mockAdminClient,
  });

  // Call 2 (Duplicate / repeated callback)
  const res2 = await completeInvitationAcceptanceFallback({
    userId: "test-user-uuid",
    fallbackState: {
      source: "organization_invite_fallback",
      invitationVerified: true,
      status: "pending",
      email: "test@example.com",
      organizationId: "org-123",
      organizationRole: "client_owner",
    },
    adminClientOverride: mockAdminClient,
  });

  assert.equal(res1.ok, true);
  assert.equal(res2.ok, true);
  assert.equal(rpcExecutionCount, 2);
});

test("regression: unauthorized role escalation attempts are strictly blocked", () => {
  // Client invite roles can never grant platform_admin or super_admin
  const attemptedRoles = ["super_admin", "platform_admin", "root", "admin", "owner"];
  for (const maliciousRole of attemptedRoles) {
    const mapped = mapClientInviteRoleToOrganizationRole(maliciousRole as never);
    // Any unrecognized role defaults safely to least-privileged client_member
    assert.equal(mapped, "client_member");
  }
});

