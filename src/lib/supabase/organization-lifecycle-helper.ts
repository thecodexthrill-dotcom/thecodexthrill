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
};

export type OrganizationDeletionEligibility = {
  canPermanentlyDelete: boolean;
  totalBlockingRecords: number;
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

  const recommendation = canPermanentlyDelete
    ? "Safe to permanently delete (0 projects, tasks, documents, invoices, tickets, or memberships)."
    : `Permanent deletion blocked because this organization retains ${blockers.join(", ")}. Use Archive or Suspend to deactivate access while preserving delivery and billing history.`;

  return {
    canPermanentlyDelete,
    totalBlockingRecords,
    blockers,
    recommendation,
  };
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

