import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyAccountDiagnostics,
  evaluateDeletionDependencies,
  filterAndPaginateDirectoryUsers,
  formatExpectedDeleteConfirmation,
  isValidUuid,
  matchesDeleteConfirmationPhrase,
  resolveUserAccessStatus,
  validatePermanentUserDeletionRequest,
  type SuperAdminDirectoryUser,
  type UserDeletionDependencySummary,
} from "./user-management-helper.ts";

function createCleanDependencies(
  userId = "11111111-2222-4333-8444-555555555555",
  overrides: Partial<UserDeletionDependencySummary> = {},
): UserDeletionDependencySummary {
  return {
    userId,
    isDesignatedSuperAdmin: false,
    designatedSuperAdminBySelf: false,
    totalSuperAdminCount: 1,
    bootstrapConsumedCount: 0,
    ownerTransferConsumedCount: 0,
    activeOrganizationMembershipsCount: 0,
    totalOrganizationMembershipsCount: 0,
    activeOrganizationRolesCount: 0,
    supportTicketsCustomerCount: 0,
    supportTicketMessagesSenderCount: 0,
    issuedPlatformInvitationsCount: 0,
    linkedPlatformInvitationsCount: 0,
    activePlatformRolesCount: 0,
    totalPlatformRolesCount: 0,
    organizationsCreatedCount: 0,
    leadsCreatedCount: 0,
    leadsAssignedCount: 0,
    projectsCreatedCount: 0,
    tasksAssignedCount: 0,
    documentsUploadedCount: 0,
    userNotificationsCount: 0,
    auditEventsActorCount: 0,
    ...overrides,
  };
}

test("rejects non-Super-Admin actors attempting permanent user deletion", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "a6b8df88-44ff-4039-8661-d113968d008d";
  const targetEmail = "phase5.alpha.test@example.com";

  for (const roles of [
    [],
    ["platform_admin"],
    ["developer"],
    ["support_staff"],
    ["organization_owner"],
  ]) {
    const res = validatePermanentUserDeletionRequest({
      actorUserId: actorId,
      actorRoles: roles,
      actorMfaLevel: "aal2",
      targetUserId: targetId,
      targetEmail,
      confirmationEmail: targetEmail,
      typedConfirmation: `DELETE ${targetEmail}`,
      dependencies: createCleanDependencies(targetId),
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, "unauthorized_role");
  }
});

test("rejects Super Admin without verified MFA (AAL2) session", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "a6b8df88-44ff-4039-8661-d113968d008d";
  const targetEmail = "phase5.alpha.test@example.com";

  for (const mfaLevel of [null, undefined, "aal1", ""]) {
    const res = validatePermanentUserDeletionRequest({
      actorUserId: actorId,
      actorRoles: ["super_admin"],
      actorMfaLevel: mfaLevel,
      targetUserId: targetId,
      targetEmail,
      confirmationEmail: targetEmail,
      typedConfirmation: `DELETE ${targetEmail}`,
      dependencies: createCleanDependencies(targetId),
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, "mfa_aal2_required");
  }
});

test("rejects self-deletion by Global Super Admin", () => {
  const superAdminId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const email = "priyanshugautamji0001@gmail.com";

  const res = validatePermanentUserDeletionRequest({
    actorUserId: superAdminId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: superAdminId,
    targetEmail: email,
    confirmationEmail: email,
    typedConfirmation: `DELETE ${email}`,
    dependencies: createCleanDependencies(superAdminId),
  });

  assert.equal(res.allowed, false);
  assert.equal(res.code, "self_deletion_forbidden");
});

test("rejects deleting the last remaining Global Super Admin or protected owner", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "22222222-3333-4444-8555-666666666666";
  const email = "owner@example.com";

  const lastAdminRes = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail: email,
    confirmationEmail: email,
    typedConfirmation: `DELETE ${email}`,
    dependencies: createCleanDependencies(targetId, {
      isDesignatedSuperAdmin: true,
      totalSuperAdminCount: 1,
    }),
  });
  assert.equal(lastAdminRes.allowed, false);
  assert.equal(lastAdminRes.code, "last_super_admin_forbidden");

  const protectedOwnerRes = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail: email,
    confirmationEmail: email,
    typedConfirmation: `DELETE ${email}`,
    dependencies: createCleanDependencies(targetId, {
      isDesignatedSuperAdmin: true,
      totalSuperAdminCount: 2,
    }),
  });
  assert.equal(protectedOwnerRes.allowed, false);
  assert.equal(protectedOwnerRes.code, "protected_super_admin_forbidden");
});

test("rejects invalid UUIDs and mismatched confirmation inputs", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "a6b8df88-44ff-4039-8661-d113968d008d";
  const targetEmail = "phase5.alpha.test@example.com";

  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid(targetId), true);

  const badIdRes = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: "invalid-uuid",
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: createCleanDependencies(targetId),
  });
  assert.equal(badIdRes.allowed, false);
  assert.equal(badIdRes.code, "invalid_target_user_id");

  const badEmailRes = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: "wrong@example.com",
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: createCleanDependencies(targetId),
  });
  assert.equal(badEmailRes.allowed, false);
  assert.equal(badEmailRes.code, "confirmation_email_mismatch");

  const badPhraseRes = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: "REMOVE USER",
    dependencies: createCleanDependencies(targetId),
  });
  assert.equal(badPhraseRes.allowed, false);
  assert.equal(badPhraseRes.code, "typed_confirmation_mismatch");
  assert.equal(
    formatExpectedDeleteConfirmation(targetEmail),
    "DELETE phase5.alpha.test@example.com",
  );
  assert.equal(
    matchesDeleteConfirmationPhrase(targetEmail, `DELETE ${targetEmail}`),
    true,
  );
});

test("blocks permanent deletion when critical non-nullable business or audit dependencies exist", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "a6b8df88-44ff-4039-8661-d113968d008d";
  const targetEmail = "client.with.tickets@example.com";

  // 1. Customer support tickets
  const ticketDep = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: createCleanDependencies(targetId, {
      supportTicketsCustomerCount: 2,
    }),
  });
  assert.equal(ticketDep.allowed, false);
  assert.equal(ticketDep.code, "blocked_by_dependencies");
  assert.ok(ticketDep.error?.includes("support ticket"));

  // 2. Active organization membership
  const orgDep = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: createCleanDependencies(targetId, {
      activeOrganizationMembershipsCount: 1,
      totalOrganizationMembershipsCount: 1,
      activeOrganizationRolesCount: 1,
    }),
  });
  assert.equal(orgDep.allowed, false);
  assert.equal(orgDep.code, "blocked_by_dependencies");
  assert.ok(orgDep.error?.includes("active organization membership"));

  // 3. Issued platform invitations
  const inviteDep = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: createCleanDependencies(targetId, {
      issuedPlatformInvitationsCount: 3,
    }),
  });
  assert.equal(inviteDep.allowed, false);
  assert.equal(inviteDep.code, "blocked_by_dependencies");
  assert.ok(inviteDep.error?.includes("platform staff invitation"));
});

test("allows permanent deletion for eligible accounts while summarizing retained and detached records", () => {
  const actorId = "62abac1f-9688-4577-9835-12f008f7e2d0";
  const targetId = "a6b8df88-44ff-4039-8661-d113968d008d";
  const targetEmail = "phase5.alpha.p5-1791649433885-n0bz6@example.com";

  const deps = createCleanDependencies(targetId, {
    organizationsCreatedCount: 1,
    leadsCreatedCount: 2,
    projectsCreatedCount: 1,
    userNotificationsCount: 3,
    auditEventsActorCount: 4,
  });

  const evalRes = evaluateDeletionDependencies(deps);
  assert.equal(evalRes.canDelete, true);
  assert.ok(
    evalRes.retainedRecordsSummary.some((s) => s.includes("4 audit event(s) retained")),
  );
  assert.ok(
    evalRes.detachedRecordsSummary.some((s) =>
      s.includes("1 organization created_by reference(s) detached"),
    ),
  );

  const res = validatePermanentUserDeletionRequest({
    actorUserId: actorId,
    actorRoles: ["super_admin"],
    actorMfaLevel: "aal2",
    targetUserId: targetId,
    targetEmail,
    confirmationEmail: targetEmail,
    typedConfirmation: `DELETE ${targetEmail}`,
    dependencies: deps,
  });
  assert.equal(res.allowed, true);
  assert.equal(res.code, "allowed");
});

test("accurately classifies real/active accounts, confirmed test artifacts, and unassigned accounts", () => {
  const realStaff = classifyAccountDiagnostics({
    email: "bharatskillsfoundation@gmail.com",
    displayName: "bharatskillsfoundation",
    isSuperAdmin: false,
    platformRoles: ["platform_admin"],
    organizations: [],
    invitations: [],
    emailConfirmedAt: "2026-10-05T06:26:47Z",
    lastSignInAt: "2026-10-09T16:34:58Z",
  });
  assert.equal(realStaff.category, "real_or_active_account");

  const phase5Alpha = classifyAccountDiagnostics({
    email: "phase5.alpha.p5-1791649433885-n0bz6@example.com",
    displayName: "Phase 5 Alpha Client",
    isSuperAdmin: false,
    platformRoles: [],
    organizations: [],
    invitations: [],
    emailConfirmedAt: "2026-10-10T16:23:55Z",
    lastSignInAt: null,
  });
  assert.equal(phase5Alpha.category, "confirmed_test_account");

  const phase2Onboard = classifyAccountDiagnostics({
    email: "onboard-1791613341355@thecodexthrill.test",
    displayName: "onboard-1791613341355",
    isSuperAdmin: false,
    platformRoles: [],
    organizations: [],
    invitations: [],
    emailConfirmedAt: null,
    lastSignInAt: null,
  });
  assert.equal(phase2Onboard.category, "confirmed_test_account");

  const unassignedHuman = classifyAccountDiagnostics({
    email: "kailashmahadevagra@gmail.com",
    displayName: "kailashmahadevagra",
    isSuperAdmin: false,
    platformRoles: [],
    organizations: [],
    invitations: [
      {
        id: "inv-1",
        role: "platform_admin",
        status: "accepted",
        createdAt: "2026-10-05T14:12:01Z",
        expiresAt: "2026-10-05T15:12:01Z",
        resendCount: 0,
        archivedAt: null,
      },
    ],
    emailConfirmedAt: "2026-10-05T14:13:24Z",
    lastSignInAt: "2026-10-05T14:13:24Z",
  });
  assert.equal(unassignedHuman.category, "unknown_unassigned_account");
});

test("filters and paginates directory users by search, role, diagnostic category, and access status", () => {
  const sampleUsers: SuperAdminDirectoryUser[] = [
    {
      userId: "62abac1f-9688-4577-9835-12f008f7e2d0",
      email: "priyanshugautamji0001@gmail.com",
      displayName: "Priyanshu Gautam",
      createdAt: "2026-10-04T07:53:46Z",
      lastSignInAt: "2026-10-09T16:15:00Z",
      invitedAt: "2026-10-04T07:53:46Z",
      emailConfirmedAt: "2026-10-04T07:55:19Z",
      isSuperAdmin: true,
      isProtectedOwner: true,
      platformRoles: ["super_admin"],
      revokedPlatformRoles: [],
      organizations: [],
      invitations: [],
      mfaStatus: "verified_totp",
      verifiedTotpCount: 1,
      totalFactorCount: 1,
      isBanned: false,
      bannedUntil: null,
      accessRevokedInMetadata: false,
      accessRevokedAt: null,
      accessRevokedReason: null,
      accessStatus: resolveUserAccessStatus({
        isSuperAdmin: true,
        isBanned: false,
        accessRevokedInMetadata: false,
        emailConfirmedAt: "2026-10-04T07:55:19Z",
        platformRoles: ["super_admin"],
        organizations: [],
      }),
      diagnosticCategory: "real_or_active_account",
      diagnosticSignals: ["Designated Global Super Admin (slot 1)"],
      canRevokeAccess: false,
      canRestoreAccess: false,
      canPermanentlyDelete: false,
      permanentDeleteBlockReason: "Protected owner",
    },
    {
      userId: "a6b8df88-44ff-4039-8661-d113968d008d",
      email: "phase5.alpha.p5-1791649433885-n0bz6@example.com",
      displayName: "Phase 5 Alpha Client",
      createdAt: "2026-10-10T16:23:55Z",
      lastSignInAt: null,
      invitedAt: null,
      emailConfirmedAt: "2026-10-10T16:23:55Z",
      isSuperAdmin: false,
      isProtectedOwner: false,
      platformRoles: [],
      revokedPlatformRoles: [],
      organizations: [],
      invitations: [],
      mfaStatus: "no_mfa",
      verifiedTotpCount: 0,
      totalFactorCount: 0,
      isBanned: false,
      bannedUntil: null,
      accessRevokedInMetadata: false,
      accessRevokedAt: null,
      accessRevokedReason: null,
      accessStatus: "no_workspace_role",
      diagnosticCategory: "confirmed_test_account",
      diagnosticSignals: ["Phase 5 analytics acceptance-test pattern"],
      canRevokeAccess: true,
      canRestoreAccess: false,
      canPermanentlyDelete: true,
      permanentDeleteBlockReason: null,
    },
  ];

  const byTestDiag = filterAndPaginateDirectoryUsers(sampleUsers, {
    diagnosticFilter: "confirmed_test_account",
  });
  assert.equal(byTestDiag.filteredCount, 1);
  assert.equal(
    byTestDiag.paginatedUsers[0]?.email,
    "phase5.alpha.p5-1791649433885-n0bz6@example.com",
  );

  const bySearch = filterAndPaginateDirectoryUsers(sampleUsers, {
    search: "priyanshu",
  });
  assert.equal(bySearch.filteredCount, 1);
  assert.equal(bySearch.paginatedUsers[0]?.isSuperAdmin, true);
});

