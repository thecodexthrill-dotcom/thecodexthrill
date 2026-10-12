import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildRetainedOrganizationAuditEventTombstone,
  classifyOrganizationDeleteDatabaseError,
  evaluateOrganizationDeletionEligibility,
  isLikelyTestOrganizationName,
  ORGANIZATION_AUDIT_RETENTION_POLICY,
  validateOrganizationDeleteConfirmation,
  type OrganizationAuditRetentionPolicy,
  type OrganizationDeletionEligibility,
  type OrganizationDependencyCounts,
  type OrganizationDirectoryItem,
  type OrganizationLifecycleStatus,
} from "./organization-lifecycle-helper";

export {
  buildRetainedOrganizationAuditEventTombstone,
  classifyOrganizationDeleteDatabaseError,
  evaluateOrganizationDeletionEligibility,
  isLikelyTestOrganizationName,
  ORGANIZATION_AUDIT_RETENTION_POLICY,
  validateOrganizationDeleteConfirmation,
  type OrganizationAuditRetentionPolicy,
  type OrganizationDeletionEligibility,
  type OrganizationDependencyCounts,
  type OrganizationDirectoryItem,
  type OrganizationLifecycleStatus,
};

function emptyDependencies(): OrganizationDependencyCounts {
  return {
    projectsCount: 0,
    tasksCount: 0,
    documentsCount: 0,
    invoicesCount: 0,
    supportTicketsCount: 0,
    activeMembershipsCount: 0,
    totalMembershipsCount: 0,
    roleAssignmentsCount: 0,
    auditEventsCount: 0,
  };
}

export async function loadOrganizationDirectorySummaries(
  rawOrganizations: {
    id: string;
    name: string;
    status: string;
    created_at: string;
    deleted_at: string | null;
  }[],
): Promise<OrganizationDirectoryItem[]> {
  if (rawOrganizations.length === 0) {
    return [];
  }

  let dbClient;
  try {
    dbClient = createAdminClient();
  } catch {
    dbClient = await createClient();
  }

  const orgIds = rawOrganizations.map((org) => org.id);

  const [
    projectsRes,
    tasksRes,
    docsRes,
    invoicesRes,
    ticketsRes,
    membershipsRes,
    rolesRes,
    auditEventsRes,
  ] = await Promise.all([
    dbClient.from("tenant_projects").select("id, organization_id").in("organization_id", orgIds),
    dbClient.from("tenant_tasks").select("id, organization_id").in("organization_id", orgIds),
    dbClient.from("tenant_documents").select("id, organization_id").in("organization_id", orgIds),
    dbClient.from("tenant_invoices").select("id, organization_id").in("organization_id", orgIds),
    dbClient.from("support_tickets").select("id, organization_id").in("organization_id", orgIds),
    dbClient.from("organization_memberships").select("organization_id, status").in("organization_id", orgIds),
    dbClient.from("organization_role_assignments").select("organization_id").in("organization_id", orgIds),
    dbClient.from("audit_events").select("id, organization_id").in("organization_id", orgIds).limit(5000),
  ]);

  const mapByOrg = new Map<string, OrganizationDependencyCounts>();
  for (const org of rawOrganizations) {
    mapByOrg.set(org.id, emptyDependencies());
  }

  for (const row of projectsRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.projectsCount += 1;
  }
  for (const row of tasksRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.tasksCount += 1;
  }
  for (const row of docsRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.documentsCount += 1;
  }
  for (const row of invoicesRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.invoicesCount += 1;
  }
  for (const row of ticketsRes.data ?? []) {
    if (!row.organization_id) continue;
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.supportTicketsCount += 1;
  }
  for (const row of membershipsRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) {
      entry.totalMembershipsCount += 1;
      if (row.status === "active") {
        entry.activeMembershipsCount += 1;
      }
    }
  }
  for (const row of rolesRes.data ?? []) {
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.roleAssignmentsCount += 1;
  }
  for (const row of auditEventsRes.data ?? []) {
    if (!row.organization_id) continue;
    const entry = mapByOrg.get(row.organization_id);
    if (entry) entry.auditEventsCount = (entry.auditEventsCount ?? 0) + 1;
  }

  const nameCounts = new Map<string, number>();
  for (const org of rawOrganizations) {
    const key = org.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return rawOrganizations.map((org) => {
    const dependencies = mapByOrg.get(org.id) ?? emptyDependencies();
    const eligibility = evaluateOrganizationDeletionEligibility(dependencies);
    const isDuplicateName = (nameCounts.get(org.name.trim().toLowerCase()) ?? 0) > 1;
    const status: OrganizationLifecycleStatus =
      org.status === "suspended" || org.status === "deleted" ? org.status : "active";

    return {
      id: org.id,
      name: org.name,
      status,
      created_at: org.created_at,
      deleted_at: org.deleted_at,
      dependencies,
      eligibility,
      isLikelyTestOrganization:
        isLikelyTestOrganizationName(org.name) ||
        (isDuplicateName && eligibility.canPermanentlyDelete),
    };
  });
}

type OrganizationAuditEventSnapshot = {
  id: string;
  organization_id: string | null;
  scope: string;
  details: Record<string, unknown> | null;
};

async function rollbackDetachedOrganizationAuditEvents(
  admin: ReturnType<typeof createAdminClient>,
  snapshots: OrganizationAuditEventSnapshot[],
): Promise<void> {
  for (const snap of snapshots) {
    await admin
      .from("audit_events")
      .update({
        organization_id: snap.organization_id,
        scope: snap.scope,
        details: snap.details ?? {},
      })
      .eq("id", snap.id);
  }
}

export async function permanentlyDeleteOrganization(params: {
  actorUserId: string;
  actorRoles: string[];
  actorMfaLevel: string | null;
  organizationId: string;
  confirmationName: string;
  typedConfirmation: string;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  deletedOrganizationId?: string;
  retainedAuditEventsCount?: number;
}> {
  if (!params.actorRoles.includes("super_admin")) {
    return {
      ok: false,
      error: "Only the Global Super Admin is authorized to permanently delete organizations.",
    };
  }
  if (params.actorMfaLevel !== "aal2") {
    return {
      ok: false,
      error: "A verified MFA (AAL2) session is required before permanently deleting an organization.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Server-only Supabase administration credentials are unavailable.",
    };
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, status, created_at, deleted_at")
    .eq("id", params.organizationId)
    .maybeSingle();

  if (orgError || !org) {
    return {
      ok: false,
      error: "The target organization could not be found in Supabase Cloud.",
    };
  }

  const confirmationCheck = validateOrganizationDeleteConfirmation({
    targetOrganizationName: org.name,
    confirmationName: params.confirmationName,
    typedConfirmation: params.typedConfirmation,
  });
  if (!confirmationCheck.valid) {
    return { ok: false, error: confirmationCheck.error };
  }

  const summaries = await loadOrganizationDirectorySummaries([org]);
  const summary = summaries[0];
  if (!summary || !summary.eligibility.canPermanentlyDelete) {
    return {
      ok: false,
      error:
        summary?.eligibility.recommendation ??
        "Permanent deletion is prohibited because active operational or membership records exist. Archive or suspend this organization instead.",
    };
  }

  // Snapshot and tombstone-detach any organization-scoped audit_events rows so historical evidence
  // is preserved in public.audit_events (scope='platform', organization_id=null) without violating
  // audit_events_organization_id_fkey (ON DELETE RESTRICT).
  const { data: orgAuditRows, error: auditQueryError } = await admin
    .from("audit_events")
    .select("id, organization_id, scope, details")
    .eq("organization_id", org.id);

  if (auditQueryError) {
    return {
      ok: false,
      error: "Could not inspect organization audit history prior to deletion. No records were modified.",
    };
  }

  const auditSnapshots = (orgAuditRows ?? []) as OrganizationAuditEventSnapshot[];
  const detachedSnapshots: OrganizationAuditEventSnapshot[] = [];
  const detachedAtIso = new Date().toISOString();

  for (const snap of auditSnapshots) {
    const tombstone = buildRetainedOrganizationAuditEventTombstone({
      existingDetails: snap.details,
      organizationId: org.id,
      organizationName: org.name,
      originalScope: snap.scope,
      actorUserId: params.actorUserId,
      detachedAtIso,
    });

    const { error: detachError } = await admin
      .from("audit_events")
      .update(tombstone)
      .eq("id", snap.id)
      .eq("organization_id", org.id);

    if (detachError) {
      await rollbackDetachedOrganizationAuditEvents(admin, detachedSnapshots);
      return {
        ok: false,
        error:
          "Could not transition organization audit history to platform tombstone retention. All audit records were restored and the organization was not deleted.",
      };
    }

    detachedSnapshots.push(snap);
  }

  const { error: deleteError } = await admin
    .from("organizations")
    .delete()
    .eq("id", org.id);

  if (deleteError) {
    if (detachedSnapshots.length > 0) {
      await rollbackDetachedOrganizationAuditEvents(admin, detachedSnapshots);
    }
    return {
      ok: false,
      error: classifyOrganizationDeleteDatabaseError(deleteError, org.name),
    };
  }

  await admin.from("audit_events").insert({
    actor_user_id: params.actorUserId,
    scope: "platform",
    action: "organization.permanently_deleted",
    target_type: "organizations",
    target_id: org.id,
    details: {
      organization_name: org.name,
      previous_status: org.status,
      created_at: org.created_at,
      dependencies_verified_zero: summary.dependencies,
      audit_retention_policy:
        detachedSnapshots.length > 0 ? ORGANIZATION_AUDIT_RETENTION_POLICY : "none",
      retained_audit_events_count: detachedSnapshots.length,
      retained_audit_event_ids: detachedSnapshots.map((s) => s.id),
    },
  });

  const retentionSummary =
    detachedSnapshots.length > 0
      ? ` ${detachedSnapshots.length} historical audit event${detachedSnapshots.length === 1 ? " was" : "s were"} preserved in the platform audit log with organization tombstone metadata.`
      : "";

  return {
    ok: true,
    deletedOrganizationId: org.id,
    retainedAuditEventsCount: detachedSnapshots.length,
    message: `Organization "${org.name}" was permanently deleted and recorded in the immutable audit log.${retentionSummary}`,
  };
}


