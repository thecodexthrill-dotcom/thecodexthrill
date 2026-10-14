export type OrganizationLifecycleStatus = "active" | "suspended" | "deleted";

export type OrganizationDependencyCounts = {
  projectsCount: number;
  tasksCount: number;
  documentsCount: number;
  invoicesCount: number;
  supportTicketsCount: number;
  activeMembershipsCount: number;
  totalMembershipsCount: number;
  roleAssignmentsCount: number;
  auditEventsCount?: number;
};

export const ORGANIZATION_AUDIT_RETENTION_POLICY =
  "preserve_as_platform_tombstone" as const;

export type OrganizationAuditRetentionPolicy =
  | typeof ORGANIZATION_AUDIT_RETENTION_POLICY
  | "none";

export type OrganizationDeletionEligibility = {
  canPermanentlyDelete: boolean;
  totalBlockingRecords: number;
  retainedAuditEventsCount: number;
  auditRetentionPolicy: OrganizationAuditRetentionPolicy;
  blockers: string[];
  recommendation: string;
};

export type OrganizationDirectoryItem = {
  id: string;
  name: string;
  status: OrganizationLifecycleStatus;
  created_at: string;
  deleted_at: string | null;
  dependencies: OrganizationDependencyCounts;
  eligibility: OrganizationDeletionEligibility;
  isLikelyTestOrganization: boolean;
};

const TEST_ORG_NAME_PATTERNS = [
  /^automation org\b/i,
  /^phase\s*\d+/i,
  /\btest\b/i,
  /\bdemo\b/i,
  /\bsandbox\b/i,
  /\bsmoke\b/i,
];

export function isLikelyTestOrganizationName(name: string): boolean {
  const normalized = name.trim();
  return TEST_ORG_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function evaluateOrganizationDeletionEligibility(
  deps: OrganizationDependencyCounts,
): OrganizationDeletionEligibility {
  const blockers: string[] = [];
  const retainedAuditEventsCount = deps.auditEventsCount ?? 0;

  if (deps.projectsCount > 0) {
    blockers.push(`${deps.projectsCount} project${deps.projectsCount === 1 ? "" : "s"}`);
  }
  if (deps.tasksCount > 0) {
    blockers.push(`${deps.tasksCount} task${deps.tasksCount === 1 ? "" : "s"}`);
  }
  if (deps.documentsCount > 0) {
    blockers.push(`${deps.documentsCount} document${deps.documentsCount === 1 ? "" : "s"}`);
  }
  if (deps.invoicesCount > 0) {
    blockers.push(`${deps.invoicesCount} invoice${deps.invoicesCount === 1 ? "" : "s"}`);
  }
  if (deps.supportTicketsCount > 0) {
    blockers.push(
      `${deps.supportTicketsCount} support ticket${deps.supportTicketsCount === 1 ? "" : "s"}`,
    );
  }
  if (deps.activeMembershipsCount > 0) {
    blockers.push(
      `${deps.activeMembershipsCount} active member${deps.activeMembershipsCount === 1 ? "" : "s"}`,
    );
  } else if (deps.totalMembershipsCount > 0) {
    blockers.push(
      `${deps.totalMembershipsCount} membership record${deps.totalMembershipsCount === 1 ? "" : "s"}`,
    );
  }
  if (deps.roleAssignmentsCount > 0) {
    blockers.push(
      `${deps.roleAssignmentsCount} role assignment${deps.roleAssignmentsCount === 1 ? "" : "s"}`,
    );
  }

  const totalBlockingRecords =
    deps.projectsCount +
    deps.tasksCount +
    deps.documentsCount +
    deps.invoicesCount +
    deps.supportTicketsCount +
    deps.totalMembershipsCount +
    deps.roleAssignmentsCount;

  const canPermanentlyDelete = blockers.length === 0 && totalBlockingRecords === 0;
  const auditRetentionPolicy: OrganizationAuditRetentionPolicy =
    retainedAuditEventsCount > 0 ? ORGANIZATION_AUDIT_RETENTION_POLICY : "none";

  let recommendation: string;
  if (!canPermanentlyDelete) {
    recommendation = `Permanent deletion is prohibited because this organization retains ${blockers.join(", ")}. Active client delivery, financial, support, and membership records are protected by ON DELETE RESTRICT. Use Archive or Suspend to deactivate access while preserving historical records.`;
  } else if (retainedAuditEventsCount > 0) {
    recommendation = `Eligible for permanent deletion (0 projects, tasks, documents, invoices, tickets, or memberships). ${retainedAuditEventsCount} historical audit event${retainedAuditEventsCount === 1 ? "" : "s"} will be preserved in public.audit_events as platform-scoped tombstones (organization_id = NULL, scope = 'platform') before deleting the organization.`;
  } else {
    recommendation =
      "Safe to permanently delete (0 projects, tasks, documents, invoices, tickets, memberships, or organization audit events).";
  }

  return {
    canPermanentlyDelete,
    totalBlockingRecords,
    retainedAuditEventsCount,
    auditRetentionPolicy,
    blockers,
    recommendation,
  };
}

export function buildRetainedOrganizationAuditEventTombstone(params: {
  existingDetails: Record<string, unknown> | null | undefined;
  organizationId: string;
  organizationName: string;
  originalScope?: string | null;
  actorUserId: string;
  detachedAtIso: string;
}): {
  organization_id: null;
  scope: "platform";
  details: Record<string, unknown>;
} {
  const baseDetails =
    params.existingDetails &&
    typeof params.existingDetails === "object" &&
    !Array.isArray(params.existingDetails)
      ? params.existingDetails
      : {};

  return {
    organization_id: null,
    scope: "platform",
    details: {
      ...baseDetails,
      retained_organization_context: {
        deleted_organization_id: params.organizationId,
        deleted_organization_name: params.organizationName,
        original_scope: params.originalScope ?? "organization",
        retention_policy: ORGANIZATION_AUDIT_RETENTION_POLICY,
        detached_at: params.detachedAtIso,
        detached_by_user_id: params.actorUserId,
      },
    },
  };
}

export function classifyOrganizationDeleteDatabaseError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  organizationName: string,
): string {
  const code = error?.code ?? "error";
  const combined = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  if (code === "23503") {
    if (combined.includes("audit_events")) {
      return `Permanent deletion of "${organizationName}" was rejected by foreign-key constraint audit_events_organization_id_fkey (23503) because organization audit events could not be detached to platform tombstone retention.`;
    }
    return `Permanent deletion of "${organizationName}" is blocked by PostgreSQL foreign-key constraint (23503) because concurrent operational or membership records still reference this organization.`;
  }

  return `The database rejected organization deletion (${code}). Verify that no dependent operational records exist and retry.`;
}

export function validateOrganizationDeleteConfirmation(params: {
  targetOrganizationName: string;
  confirmationName: string;
  typedConfirmation: string;
}): { valid: boolean; error?: string } {
  const expectedName = params.targetOrganizationName.trim();
  const providedName = params.confirmationName.trim();
  const providedPhrase = params.typedConfirmation.trim();
  const expectedPhrase = `DELETE ${expectedName}`;

  if (!expectedName) {
    return { valid: false, error: "Target organization name is missing." };
  }
  if (providedName !== expectedName) {
    return {
      valid: false,
      error: `Step 1 confirmation must match the organization name "${expectedName}" exactly.`,
    };
  }
  if (providedPhrase !== expectedPhrase) {
    return {
      valid: false,
      error: `Step 2 confirmation must match "${expectedPhrase}" exactly.`,
    };
  }
  return { valid: true };
}

