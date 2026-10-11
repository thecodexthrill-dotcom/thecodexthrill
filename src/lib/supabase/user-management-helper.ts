export type UserAccessStatus =
  | "protected_owner"
  | "active"
  | "disabled"
  | "pending_verification"
  | "no_workspace_role";

export type UserDiagnosticCategory =
  | "real_or_active_account"
  | "confirmed_test_account"
  | "unknown_unassigned_account";

export type UserMfaSummaryStatus =
  | "verified_totp"
  | "unverified_factor"
  | "no_mfa"
  | "unavailable";

export interface UserOrganizationMembershipSummary {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  membershipStatus: string;
  roles: string[];
}

export interface UserInvitationSummary {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  resendCount: number;
  archivedAt: string | null;
}

export interface SuperAdminDirectoryUser {
  userId: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  invitedAt: string | null;
  emailConfirmedAt: string | null;
  isSuperAdmin: boolean;
  isProtectedOwner: boolean;
  platformRoles: string[];
  revokedPlatformRoles: string[];
  organizations: UserOrganizationMembershipSummary[];
  invitations: UserInvitationSummary[];
  mfaStatus: UserMfaSummaryStatus;
  verifiedTotpCount: number;
  totalFactorCount: number;
  isBanned: boolean;
  bannedUntil: string | null;
  accessRevokedInMetadata: boolean;
  accessRevokedAt: string | null;
  accessRevokedReason: string | null;
  accessStatus: UserAccessStatus;
  diagnosticCategory: UserDiagnosticCategory;
  diagnosticSignals: string[];
  canRevokeAccess: boolean;
  canRestoreAccess: boolean;
  canPermanentlyDelete: boolean;
  permanentDeleteBlockReason: string | null;
}

export interface UserDeletionDependencySummary {
  userId: string;
  isDesignatedSuperAdmin: boolean;
  designatedSuperAdminBySelf: boolean;
  totalSuperAdminCount: number;
  bootstrapConsumedCount: number;
  ownerTransferConsumedCount: number;
  activeOrganizationMembershipsCount: number;
  totalOrganizationMembershipsCount: number;
  activeOrganizationRolesCount: number;
  supportTicketsCustomerCount: number;
  supportTicketMessagesSenderCount: number;
  issuedPlatformInvitationsCount: number;
  linkedPlatformInvitationsCount: number;
  activePlatformRolesCount: number;
  totalPlatformRolesCount: number;
  organizationsCreatedCount: number;
  leadsCreatedCount: number;
  leadsAssignedCount: number;
  projectsCreatedCount: number;
  tasksAssignedCount: number;
  documentsUploadedCount: number;
  userNotificationsCount: number;
  auditEventsActorCount: number;
}

export interface UserDeletionEligibilityResult {
  allowed: boolean;
  code:
    | "allowed"
    | "unauthorized_role"
    | "mfa_aal2_required"
    | "invalid_target_user_id"
    | "self_deletion_forbidden"
    | "protected_super_admin_forbidden"
    | "last_super_admin_forbidden"
    | "confirmation_email_mismatch"
    | "typed_confirmation_mismatch"
    | "blocked_by_dependencies";
  error?: string;
  blockingReasons: string[];
  retainedRecordsSummary: string[];
  detachedRecordsSummary: string[];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

export function formatExpectedDeleteConfirmation(email: string): string {
  return `DELETE ${email.trim().toLowerCase()}`;
}

export function matchesDeleteConfirmationPhrase(
  email: string,
  typedConfirmation: string,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedTyped = typedConfirmation.trim().toLowerCase();
  if (!normalizedEmail || !normalizedTyped) return false;
  return (
    normalizedTyped === `delete ${normalizedEmail}` ||
    normalizedTyped === normalizedEmail
  );
}

/**
 * Classifies an account for diagnostic visibility in the Super Admin directory.
 * IMPORTANT: This classification is strictly informational for human review.
 * No user is ever automatically deleted based on domain, display name, or date.
 */
export function classifyAccountDiagnostics(input: {
  email: string;
  displayName: string | null;
  isSuperAdmin: boolean;
  platformRoles: string[];
  organizations: UserOrganizationMembershipSummary[];
  invitations: UserInvitationSummary[];
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
}): {
  category: UserDiagnosticCategory;
  signals: string[];
} {
  const emailLower = (input.email || "").trim().toLowerCase();
  const displayName = (input.displayName || "").trim();
  const signals: string[] = [];

  if (input.isSuperAdmin) {
    signals.push("Designated Global Super Admin (slot 1)");
    return { category: "real_or_active_account", signals };
  }

  if (input.platformRoles.length > 0) {
    signals.push(`Active platform role: ${input.platformRoles.join(", ")}`);
    return { category: "real_or_active_account", signals };
  }

  const activeOrgs = input.organizations.filter(
    (org) => org.membershipStatus === "active",
  );
  if (activeOrgs.length > 0) {
    signals.push(
      `Active member in ${activeOrgs.length} client organization(s)`,
    );
    return { category: "real_or_active_account", signals };
  }

  // Multi-signal detection for known automated acceptance-test artifacts
  const isPhase5TestPattern =
    /^phase5\.(alpha|beta)\.[a-z0-9-]+@example\.com$/i.test(emailLower) &&
    (displayName === "Phase 5 Alpha Client" ||
      displayName === "Phase 5 Beta Client");

  const isPhase2OnboardingTestPattern =
    /^onboard-\d+@thecodexthrill\.test$/i.test(emailLower) &&
    !input.emailConfirmedAt &&
    !input.lastSignInAt &&
    input.invitations.length === 0;

  const isDisposableAcceptancePattern =
    /^disposable-delete-test-[a-z0-9-]+@example\.com$/i.test(emailLower);

  if (isPhase5TestPattern) {
    signals.push("Phase 5 analytics acceptance-test pattern (phase5.alpha/beta)");
    signals.push(`Test metadata display name: "${displayName}"`);
    signals.push("No active platform roles, organizations, or invitations");
    return { category: "confirmed_test_account", signals };
  }

  if (isPhase2OnboardingTestPattern) {
    signals.push("Phase 2 onboarding acceptance-test pattern (@thecodexthrill.test)");
    signals.push("Unconfirmed SMTP test artifact with zero sign-ins and zero roles");
    return { category: "confirmed_test_account", signals };
  }

  if (isDisposableAcceptancePattern) {
    signals.push("Disposable user-management acceptance test account");
    return { category: "confirmed_test_account", signals };
  }

  if (input.invitations.length > 0) {
    const latest = input.invitations[0];
    signals.push(
      `Platform invitation record (${latest.role}, status: ${latest.status})`,
    );
  } else {
    signals.push("No active platform role or organization membership");
  }

  if (!input.emailConfirmedAt) {
    signals.push("Email not yet confirmed");
  } else if (!input.lastSignInAt) {
    signals.push("Email confirmed; no recorded sign-in");
  } else {
    signals.push("Email confirmed; no active role assignment");
  }

  return { category: "unknown_unassigned_account", signals };
}

export function resolveUserAccessStatus(input: {
  isSuperAdmin: boolean;
  isBanned: boolean;
  accessRevokedInMetadata: boolean;
  emailConfirmedAt: string | null;
  platformRoles: string[];
  organizations: UserOrganizationMembershipSummary[];
}): UserAccessStatus {
  if (input.isSuperAdmin) return "protected_owner";
  if (input.isBanned || input.accessRevokedInMetadata) return "disabled";
  const hasActiveOrgMembership = input.organizations.some(
    (org) => org.membershipStatus === "active" && org.roles.length > 0,
  );
  if (input.platformRoles.length > 0 || hasActiveOrgMembership) {
    return "active";
  }
  if (!input.emailConfirmedAt) {
    return "pending_verification";
  }
  return "no_workspace_role";
}

export function evaluateDeletionDependencies(
  deps: UserDeletionDependencySummary,
): {
  canDelete: boolean;
  blockingReasons: string[];
  retainedRecordsSummary: string[];
  detachedRecordsSummary: string[];
} {
  const blockingReasons: string[] = [];
  const retainedRecordsSummary: string[] = [];
  const detachedRecordsSummary: string[] = [];

  if (deps.isDesignatedSuperAdmin || deps.designatedSuperAdminBySelf) {
    blockingReasons.push(
      "Account holds or designated the Global Super Admin slot (platform_super_admin_designation).",
    );
  }
  if (deps.isDesignatedSuperAdmin && deps.totalSuperAdminCount <= 1) {
    blockingReasons.push(
      "Cannot delete the last remaining Global Super Admin.",
    );
  }
  if (deps.bootstrapConsumedCount > 0 || deps.ownerTransferConsumedCount > 0) {
    blockingReasons.push(
      "Account is permanently recorded in Super Admin bootstrap/ownership-transfer authorization history.",
    );
  }
  if (deps.activeOrganizationMembershipsCount > 0 || deps.activeOrganizationRolesCount > 0) {
    blockingReasons.push(
      `Account has ${deps.activeOrganizationMembershipsCount} active organization membership(s) and ${deps.activeOrganizationRolesCount} active organization role(s). Revoke access or remove organization memberships first.`,
    );
  } else if (deps.totalOrganizationMembershipsCount > 0) {
    blockingReasons.push(
      `Account is linked to ${deps.totalOrganizationMembershipsCount} organization membership record(s) guarded by tenant role-pair integrity constraints. Use "Revoke Access / Disable Account" to block access while preserving tenant history.`,
    );
  }
  if (deps.supportTicketsCustomerCount > 0) {
    blockingReasons.push(
      `Account is the customer of record on ${deps.supportTicketsCustomerCount} support ticket(s). Permanent deletion is blocked to preserve support history; use "Revoke Access / Disable Account" instead.`,
    );
  }
  if (deps.supportTicketMessagesSenderCount > 0) {
    blockingReasons.push(
      `Account authored ${deps.supportTicketMessagesSenderCount} support ticket message(s). Permanent deletion is blocked to preserve support thread integrity; use "Revoke Access / Disable Account" instead.`,
    );
  }
  if (deps.issuedPlatformInvitationsCount > 0) {
    blockingReasons.push(
      `Account issued ${deps.issuedPlatformInvitationsCount} platform staff invitation(s) referenced by non-nullable invitation audit constraints. Use "Revoke Access / Disable Account" instead.`,
    );
  }

  // Summarizing what is retained vs cleaned up when deletion is allowed
  if (deps.auditEventsActorCount > 0) {
    retainedRecordsSummary.push(
      `${deps.auditEventsActorCount} audit event(s) retained with actor_user_id set to NULL`,
    );
  } else {
    retainedRecordsSummary.push(
      "All platform and organization audit_events history retained intact",
    );
  }
  if (deps.projectsCreatedCount > 0) {
    retainedRecordsSummary.push(
      `${deps.projectsCreatedCount} project(s) retained with created_by set to NULL`,
    );
  }
  if (deps.tasksAssignedCount > 0) {
    retainedRecordsSummary.push(
      `${deps.tasksAssignedCount} task(s) retained with assigned_to set to NULL`,
    );
  }
  if (deps.documentsUploadedCount > 0) {
    retainedRecordsSummary.push(
      `${deps.documentsUploadedCount} document(s) retained with uploaded_by set to NULL`,
    );
  }
  if (deps.linkedPlatformInvitationsCount > 0) {
    retainedRecordsSummary.push(
      `${deps.linkedPlatformInvitationsCount} invitation record(s) retained with auth_user_id set to NULL`,
    );
  }

  if (deps.organizationsCreatedCount > 0) {
    detachedRecordsSummary.push(
      `${deps.organizationsCreatedCount} organization created_by reference(s) detached (organization records preserved)`,
    );
  }
  if (deps.leadsCreatedCount > 0 || deps.leadsAssignedCount > 0) {
    detachedRecordsSummary.push(
      `${deps.leadsCreatedCount + deps.leadsAssignedCount} CRM sales lead creator/assignee reference(s) detached (leads preserved)`,
    );
  }
  if (deps.totalPlatformRolesCount > 0) {
    detachedRecordsSummary.push(
      `${deps.totalPlatformRolesCount} platform_role_assignments row(s) removed`,
    );
  }
  if (deps.userNotificationsCount > 0) {
    detachedRecordsSummary.push(
      `${deps.userNotificationsCount} user notification(s) cascaded`,
    );
  }
  detachedRecordsSummary.push(
    "public.profiles record and auth.users identity permanently deleted",
  );

  return {
    canDelete: blockingReasons.length === 0,
    blockingReasons,
    retainedRecordsSummary,
    detachedRecordsSummary,
  };
}

export function validatePermanentUserDeletionRequest(input: {
  actorUserId: string;
  actorRoles: string[];
  actorMfaLevel: string | null | undefined;
  targetUserId: string;
  targetEmail: string;
  confirmationEmail: string;
  typedConfirmation: string;
  dependencies: UserDeletionDependencySummary;
}): UserDeletionEligibilityResult {
  const emptyLists = {
    blockingReasons: [] as string[],
    retainedRecordsSummary: [] as string[],
    detachedRecordsSummary: [] as string[],
  };

  if (!input.actorRoles.includes("super_admin")) {
    return {
      allowed: false,
      code: "unauthorized_role",
      error: "Only the Global Super Admin is authorized to permanently delete users.",
      ...emptyLists,
    };
  }

  if (input.actorMfaLevel !== "aal2") {
    return {
      allowed: false,
      code: "mfa_aal2_required",
      error: "A verified MFA (AAL2) session is required before permanently deleting a user.",
      ...emptyLists,
    };
  }

  if (!isValidUuid(input.targetUserId)) {
    return {
      allowed: false,
      code: "invalid_target_user_id",
      error: "Select a valid target user UUID.",
      ...emptyLists,
    };
  }

  if (input.actorUserId.trim().toLowerCase() === input.targetUserId.trim().toLowerCase()) {
    return {
      allowed: false,
      code: "self_deletion_forbidden",
      error: "You cannot permanently delete your own Super Admin account.",
      ...emptyLists,
    };
  }

  if (input.dependencies.isDesignatedSuperAdmin) {
    if (input.dependencies.totalSuperAdminCount <= 1) {
      return {
        allowed: false,
        code: "last_super_admin_forbidden",
        error: "Cannot delete the last remaining Global Super Admin account.",
        blockingReasons: [
          "Target user is the last remaining Global Super Admin.",
        ],
        retainedRecordsSummary: [],
        detachedRecordsSummary: [],
      };
    }
    return {
      allowed: false,
      code: "protected_super_admin_forbidden",
      error:
        "Cannot delete a designated Global Super Admin account without completing an atomic ownership transfer first.",
      blockingReasons: [
        "Target user holds the protected Global Super Admin designation.",
      ],
      retainedRecordsSummary: [],
      detachedRecordsSummary: [],
    };
  }

  const normalizedTargetEmail = input.targetEmail.trim().toLowerCase();
  const normalizedConfirmationEmail = input.confirmationEmail.trim().toLowerCase();
  if (!normalizedTargetEmail || normalizedTargetEmail !== normalizedConfirmationEmail) {
    return {
      allowed: false,
      code: "confirmation_email_mismatch",
      error: "The confirmation email does not match the selected user's email address.",
      ...emptyLists,
    };
  }

  if (!matchesDeleteConfirmationPhrase(input.targetEmail, input.typedConfirmation)) {
    return {
      allowed: false,
      code: "typed_confirmation_mismatch",
      error: `Type "${formatExpectedDeleteConfirmation(input.targetEmail)}" to confirm permanent deletion.`,
      ...emptyLists,
    };
  }

  const depEval = evaluateDeletionDependencies(input.dependencies);
  if (!depEval.canDelete) {
    return {
      allowed: false,
      code: "blocked_by_dependencies",
      error: depEval.blockingReasons[0] ?? "User cannot be permanently deleted due to linked records.",
      blockingReasons: depEval.blockingReasons,
      retainedRecordsSummary: depEval.retainedRecordsSummary,
      detachedRecordsSummary: depEval.detachedRecordsSummary,
    };
  }

  return {
    allowed: true,
    code: "allowed",
    blockingReasons: [],
    retainedRecordsSummary: depEval.retainedRecordsSummary,
    detachedRecordsSummary: depEval.detachedRecordsSummary,
  };
}

export interface DirectoryFilterOptions {
  search?: string;
  accessStatus?: "all" | UserAccessStatus;
  roleFilter?:
    | "all"
    | "super_admin"
    | "platform_admin"
    | "developer"
    | "support_staff"
    | "organization_member"
    | "unassigned";
  diagnosticFilter?: "all" | UserDiagnosticCategory;
  mfaFilter?: "all" | UserMfaSummaryStatus;
  page?: number;
  pageSize?: number;
}

export function filterAndPaginateDirectoryUsers(
  users: SuperAdminDirectoryUser[],
  options: DirectoryFilterOptions = {},
): {
  filteredUsers: SuperAdminDirectoryUser[];
  paginatedUsers: SuperAdminDirectoryUser[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const search = (options.search ?? "").trim().toLowerCase();
  const accessStatus = options.accessStatus ?? "all";
  const roleFilter = options.roleFilter ?? "all";
  const diagnosticFilter = options.diagnosticFilter ?? "all";
  const mfaFilter = options.mfaFilter ?? "all";
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));

  const filteredUsers = users.filter((u) => {
    if (accessStatus !== "all" && u.accessStatus !== accessStatus) {
      return false;
    }
    if (diagnosticFilter !== "all" && u.diagnosticCategory !== diagnosticFilter) {
      return false;
    }
    if (mfaFilter !== "all" && u.mfaStatus !== mfaFilter) {
      return false;
    }
    if (roleFilter !== "all") {
      if (roleFilter === "super_admin" && !u.isSuperAdmin) return false;
      if (
        (roleFilter === "platform_admin" ||
          roleFilter === "developer" ||
          roleFilter === "support_staff") &&
        !u.platformRoles.includes(roleFilter)
      ) {
        return false;
      }
      if (
        roleFilter === "organization_member" &&
        u.organizations.length === 0
      ) {
        return false;
      }
      if (
        roleFilter === "unassigned" &&
        (u.isSuperAdmin ||
          u.platformRoles.length > 0 ||
          u.organizations.length > 0)
      ) {
        return false;
      }
    }

    if (search) {
      const haystacks = [
        u.email,
        u.displayName ?? "",
        u.userId,
        ...u.platformRoles,
        ...u.organizations.map((o) => `${o.organizationName} ${o.roles.join(" ")}`),
        ...u.diagnosticSignals,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystacks.includes(search)) {
        return false;
      }
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, options.page ?? 1));
  const start = (page - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(start, start + pageSize);

  return {
    filteredUsers,
    paginatedUsers,
    totalCount: users.length,
    filteredCount: filteredUsers.length,
    page,
    pageSize,
    totalPages,
  };
}

