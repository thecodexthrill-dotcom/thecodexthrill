import type { SupabaseClient } from "@supabase/supabase-js";
import { logSanitizedOperationalEvent } from "./platform-health-helper.ts";
import {
  classifyAccountDiagnostics,
  evaluateDeletionDependencies,
  isValidUuid,
  resolveUserAccessStatus,
  validatePermanentUserDeletionRequest,
  type SuperAdminDirectoryUser,
  type UserDeletionDependencySummary,
  type UserInvitationSummary,
  type UserMfaSummaryStatus,
  type UserOrganizationMembershipSummary,
} from "./user-management-helper.ts";

async function resolveAdminClient(
  override?: SupabaseClient,
): Promise<SupabaseClient> {
  if (override) return override;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

export interface PlatformInvitationRpcRow {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  auth_user_id: string | null;
  resend_count: number;
  last_resent_at: string | null;
  archived_at: string | null;
}

function deriveMfaSummary(
  factors: Array<{ factor_type?: string; status?: string }> | undefined,
): {
  mfaStatus: UserMfaSummaryStatus;
  verifiedTotpCount: number;
  totalFactorCount: number;
} {
  if (!Array.isArray(factors)) {
    return { mfaStatus: "no_mfa", verifiedTotpCount: 0, totalFactorCount: 0 };
  }
  const verifiedTotpCount = factors.filter(
    (f) => f.factor_type === "totp" && f.status === "verified",
  ).length;
  const totalFactorCount = factors.length;
  if (verifiedTotpCount > 0) {
    return { mfaStatus: "verified_totp", verifiedTotpCount, totalFactorCount };
  }
  if (totalFactorCount > 0) {
    return {
      mfaStatus: "unverified_factor",
      verifiedTotpCount: 0,
      totalFactorCount,
    };
  }
  return { mfaStatus: "no_mfa", verifiedTotpCount: 0, totalFactorCount: 0 };
}

export async function loadSuperAdminUserDirectory(options: {
  actorUserId: string;
  invitations?: PlatformInvitationRpcRow[];
  adminClientOverride?: SupabaseClient;
}): Promise<{
  users: SuperAdminDirectoryUser[];
  error?: string;
}> {
  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(options.adminClientOverride);
  } catch {
    return {
      users: [],
      error:
        "The server-only Supabase admin client is unavailable. Verify SUPABASE_SECRET_KEY is configured.",
    };
  }

  const allAuthUsers: Array<{
    id: string;
    email?: string;
    created_at: string;
    last_sign_in_at?: string | null;
    invited_at?: string | null;
    email_confirmed_at?: string | null;
    banned_until?: string | null;
    user_metadata?: Record<string, unknown>;
    factors?: Array<{ factor_type?: string; status?: string }>;
  }> = [];

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      logSanitizedOperationalEvent({
        level: "error",
        scope: "admin.user_directory",
        action: "list_auth_users_failed",
        message: "Failed to list Supabase Auth users for Super Admin directory",
        metadata: { code: error.code, status: error.status },
      });
      return {
        users: [],
        error:
          "Could not load the Supabase Auth user directory. Retry when the connection is available.",
      };
    }
    allAuthUsers.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) break;
  }

  const [
    profilesRes,
    superAdminRes,
    platformRolesRes,
    orgMembershipsRes,
    orgRolesRes,
    orgsRes,
    ticketsRes,
    messagesRes,
    inviteAuditRes,
  ] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, created_at"),
    admin
      .from("platform_super_admin_designation")
      .select("slot, user_id, designated_by"),
    admin
      .from("platform_role_assignments")
      .select("user_id, role, revoked_at"),
    admin
      .from("organization_memberships")
      .select("organization_id, user_id, status"),
    admin
      .from("organization_role_assignments")
      .select("organization_id, user_id, role, revoked_at"),
    admin.from("organizations").select("id, name, status"),
    admin.from("support_tickets").select("customer_id"),
    admin.from("support_ticket_messages").select("sender_id"),
    admin
      .from("audit_events")
      .select("actor_user_id")
      .eq("action", "platform.invitation.created"),
  ]);

  const profileById = new Map<
    string,
    { email: string; display_name: string | null }
  >();
  for (const p of profilesRes.data ?? []) {
    profileById.set(p.id, { email: p.email, display_name: p.display_name });
  }

  const superAdminSet = new Set<string>();
  const designatedBySet = new Set<string>();
  for (const row of superAdminRes.data ?? []) {
    superAdminSet.add(row.user_id);
    if (row.designated_by) designatedBySet.add(row.designated_by);
  }

  const activePlatformRolesByUser = new Map<string, string[]>();
  const revokedPlatformRolesByUser = new Map<string, string[]>();
  for (const row of platformRolesRes.data ?? []) {
    if (!row.revoked_at) {
      const list = activePlatformRolesByUser.get(row.user_id) ?? [];
      if (!list.includes(row.role)) list.push(row.role);
      activePlatformRolesByUser.set(row.user_id, list);
    } else {
      const list = revokedPlatformRolesByUser.get(row.user_id) ?? [];
      if (!list.includes(row.role)) list.push(row.role);
      revokedPlatformRolesByUser.set(row.user_id, list);
    }
  }

  const orgById = new Map<string, { name: string; status: string }>();
  for (const org of orgsRes.data ?? []) {
    orgById.set(org.id, { name: org.name, status: org.status });
  }

  const activeOrgRolesByKey = new Map<string, string[]>();
  for (const row of orgRolesRes.data ?? []) {
    if (!row.revoked_at) {
      const key = `${row.organization_id}:${row.user_id}`;
      const list = activeOrgRolesByKey.get(key) ?? [];
      if (!list.includes(row.role)) list.push(row.role);
      activeOrgRolesByKey.set(key, list);
    }
  }

  const orgMembershipsByUser = new Map<
    string,
    UserOrganizationMembershipSummary[]
  >();
  for (const m of orgMembershipsRes.data ?? []) {
    const orgInfo = orgById.get(m.organization_id);
    const roles =
      activeOrgRolesByKey.get(`${m.organization_id}:${m.user_id}`) ?? [];
    const list = orgMembershipsByUser.get(m.user_id) ?? [];
    list.push({
      organizationId: m.organization_id,
      organizationName: orgInfo?.name ?? "Organization",
      organizationStatus: orgInfo?.status ?? "unknown",
      membershipStatus: m.status,
      roles,
    });
    orgMembershipsByUser.set(m.user_id, list);
  }

  const invitationsByUserId = new Map<string, UserInvitationSummary[]>();
  const invitationsByEmail = new Map<string, UserInvitationSummary[]>();
  for (const inv of options.invitations ?? []) {
    const summary: UserInvitationSummary = {
      id: inv.id,
      role: inv.role,
      status: inv.status,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      resendCount: inv.resend_count,
      archivedAt: inv.archived_at,
    };
    if (inv.auth_user_id) {
      const list = invitationsByUserId.get(inv.auth_user_id) ?? [];
      list.push(summary);
      invitationsByUserId.set(inv.auth_user_id, list);
    }
    const emailKey = (inv.email || "").trim().toLowerCase();
    if (emailKey) {
      const list = invitationsByEmail.get(emailKey) ?? [];
      list.push(summary);
      invitationsByEmail.set(emailKey, list);
    }
  }

  const ticketCountByCustomer = new Map<string, number>();
  for (const row of ticketsRes.data ?? []) {
    if (row.customer_id) {
      ticketCountByCustomer.set(
        row.customer_id,
        (ticketCountByCustomer.get(row.customer_id) ?? 0) + 1,
      );
    }
  }

  const messageCountBySender = new Map<string, number>();
  for (const row of messagesRes.data ?? []) {
    if (row.sender_id) {
      messageCountBySender.set(
        row.sender_id,
        (messageCountBySender.get(row.sender_id) ?? 0) + 1,
      );
    }
  }

  const issuedInviteCountByActor = new Map<string, number>();
  for (const row of inviteAuditRes.data ?? []) {
    if (row.actor_user_id) {
      issuedInviteCountByActor.set(
        row.actor_user_id,
        (issuedInviteCountByActor.get(row.actor_user_id) ?? 0) + 1,
      );
    }
  }

  const nowMs = Date.now();
  const directoryUsers: SuperAdminDirectoryUser[] = allAuthUsers.map((u) => {
    const profile = profileById.get(u.id);
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const email = (u.email || profile?.email || "").trim();
    const emailLower = email.toLowerCase();
    const displayName =
      profile?.display_name ||
      (typeof meta.full_name === "string" ? meta.full_name : null) ||
      (typeof meta.display_name === "string" ? meta.display_name : null) ||
      null;

    const isSuperAdmin = superAdminSet.has(u.id);
    const activePlatformRoles = activePlatformRolesByUser.get(u.id) ?? [];
    const platformRoles = isSuperAdmin
      ? ["super_admin", ...activePlatformRoles]
      : [...activePlatformRoles];
    const revokedPlatformRoles = revokedPlatformRolesByUser.get(u.id) ?? [];
    const organizations = orgMembershipsByUser.get(u.id) ?? [];

    const byIdInvites = invitationsByUserId.get(u.id) ?? [];
    const byEmailInvites = invitationsByEmail.get(emailLower) ?? [];
    const seenInviteIds = new Set<string>();
    const invitations: UserInvitationSummary[] = [];
    for (const item of [...byIdInvites, ...byEmailInvites]) {
      if (!seenInviteIds.has(item.id)) {
        seenInviteIds.add(item.id);
        invitations.push(item);
      }
    }

    const { mfaStatus, verifiedTotpCount, totalFactorCount } = deriveMfaSummary(
      u.factors,
    );

    const bannedUntil = u.banned_until ?? null;
    const isBanned = Boolean(
      bannedUntil &&
        bannedUntil !== "none" &&
        new Date(bannedUntil).getTime() > nowMs,
    );
    const accessRevokedInMetadata = meta.account_access_revoked === true;
    const accessRevokedAt =
      typeof meta.account_access_revoked_at === "string"
        ? meta.account_access_revoked_at
        : null;
    const accessRevokedReason =
      typeof meta.account_access_revoked_reason === "string"
        ? meta.account_access_revoked_reason
        : null;

    const accessStatus = resolveUserAccessStatus({
      isSuperAdmin,
      isBanned,
      accessRevokedInMetadata,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      platformRoles: activePlatformRoles,
      organizations,
    });

    const diagnostics = classifyAccountDiagnostics({
      email,
      displayName,
      isSuperAdmin,
      platformRoles: activePlatformRoles,
      organizations,
      invitations,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    });

    const isSelf = u.id === options.actorUserId;
    const ticketCount = ticketCountByCustomer.get(u.id) ?? 0;
    const messageCount = messageCountBySender.get(u.id) ?? 0;
    const issuedInvitesCount = issuedInviteCountByActor.get(u.id) ?? 0;

    let permanentDeleteBlockReason: string | null = null;
    if (isSelf) {
      permanentDeleteBlockReason =
        "Self-deletion is forbidden. You cannot delete your own Super Admin account.";
    } else if (isSuperAdmin || designatedBySet.has(u.id)) {
      permanentDeleteBlockReason =
        "Protected Global Super Admin / owner account cannot be deleted without atomic ownership transfer.";
    } else if (organizations.length > 0) {
      permanentDeleteBlockReason =
        "User has organization membership records. Use 'Revoke Access / Disable' to block access while preserving client history.";
    } else if (ticketCount > 0 || messageCount > 0) {
      permanentDeleteBlockReason =
        "User has authored support tickets or messages. Use 'Revoke Access / Disable' to preserve support history.";
    } else if (issuedInvitesCount > 0) {
      permanentDeleteBlockReason =
        "User issued platform invitations referenced by invitation audit records. Use 'Revoke Access / Disable' instead.";
    }

    const canPermanentlyDelete = permanentDeleteBlockReason === null;
    const canRevokeAccess =
      !isSelf && !isSuperAdmin && accessStatus !== "disabled";
    const canRestoreAccess =
      !isSelf && !isSuperAdmin && accessStatus === "disabled";

    return {
      userId: u.id,
      email,
      displayName,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      invitedAt: u.invited_at ?? null,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      isSuperAdmin,
      isProtectedOwner: isSuperAdmin,
      platformRoles,
      revokedPlatformRoles,
      organizations,
      invitations,
      mfaStatus,
      verifiedTotpCount,
      totalFactorCount,
      isBanned,
      bannedUntil,
      accessRevokedInMetadata,
      accessRevokedAt,
      accessRevokedReason,
      accessStatus,
      diagnosticCategory: diagnostics.category,
      diagnosticSignals: diagnostics.signals,
      canRevokeAccess,
      canRestoreAccess,
      canPermanentlyDelete,
      permanentDeleteBlockReason,
    };
  });

  directoryUsers.sort((a, b) => {
    if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1;
    const aHasStaff = a.platformRoles.length > 0;
    const bHasStaff = b.platformRoles.length > 0;
    if (aHasStaff !== bHasStaff) return aHasStaff ? -1 : 1;
    const aHasOrg = a.organizations.length > 0;
    const bHasOrg = b.organizations.length > 0;
    if (aHasOrg !== bHasOrg) return aHasOrg ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { users: directoryUsers };
}

export async function inspectUserDeletionDependencies(
  admin: SupabaseClient,
  targetUserId: string,
): Promise<UserDeletionDependencySummary> {
  const [
    superAdminRes,
    bootstrapRes,
    ownerTransferRes,
    orgMembershipsRes,
    orgRolesRes,
    ticketsRes,
    messagesRes,
    inviteIssuedAuditRes,
    inviteLinkedAuditRes,
    platformRolesRes,
    orgsCreatedRes,
    leadsCreatedRes,
    leadsAssignedRes,
    projectsCreatedRes,
    tasksAssignedRes,
    docsUploadedRes,
    notificationsRes,
    auditActorRes,
  ] = await Promise.all([
    admin
      .from("platform_super_admin_designation")
      .select("slot, user_id, designated_by"),
    admin
      .from("initial_super_admin_bootstrap_authorizations")
      .select("id", { count: "exact", head: true })
      .eq("consumed_user_id", targetUserId),
    admin
      .from("owner_super_admin_transfer_authorizations")
      .select("id", { count: "exact", head: true })
      .eq("consumed_user_id", targetUserId),
    admin
      .from("organization_memberships")
      .select("status")
      .eq("user_id", targetUserId),
    admin
      .from("organization_role_assignments")
      .select("revoked_at")
      .eq("user_id", targetUserId),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", targetUserId),
    admin
      .from("support_ticket_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", targetUserId),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "platform.invitation.created")
      .eq("actor_user_id", targetUserId),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "platform.invitation.auth_user_linked")
      .contains("details", { auth_user_id: targetUserId }),
    admin
      .from("platform_role_assignments")
      .select("revoked_at")
      .eq("user_id", targetUserId),
    admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("created_by", targetUserId),
    admin
      .from("platform_sales_leads")
      .select("id", { count: "exact", head: true })
      .eq("created_by", targetUserId),
    admin
      .from("platform_sales_leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", targetUserId),
    admin
      .from("tenant_projects")
      .select("id", { count: "exact", head: true })
      .eq("created_by", targetUserId),
    admin
      .from("tenant_tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", targetUserId),
    admin
      .from("tenant_documents")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", targetUserId),
    admin
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", targetUserId),
  ]);

  const superAdminRows = superAdminRes.data ?? [];
  const isDesignatedSuperAdmin = superAdminRows.some(
    (r) => r.user_id === targetUserId,
  );
  const designatedSuperAdminBySelf = superAdminRows.some(
    (r) => r.designated_by === targetUserId,
  );

  const memberships = orgMembershipsRes.data ?? [];
  const activeOrganizationMembershipsCount = memberships.filter(
    (m) => m.status === "active",
  ).length;

  const orgRoles = orgRolesRes.data ?? [];
  const activeOrganizationRolesCount = orgRoles.filter(
    (r) => !r.revoked_at,
  ).length;

  const platformRoles = platformRolesRes.data ?? [];
  const activePlatformRolesCount = platformRoles.filter(
    (r) => !r.revoked_at,
  ).length;

  return {
    userId: targetUserId,
    isDesignatedSuperAdmin,
    designatedSuperAdminBySelf,
    totalSuperAdminCount: superAdminRows.length,
    bootstrapConsumedCount: bootstrapRes.count ?? 0,
    ownerTransferConsumedCount: ownerTransferRes.count ?? 0,
    activeOrganizationMembershipsCount,
    totalOrganizationMembershipsCount: memberships.length,
    activeOrganizationRolesCount,
    supportTicketsCustomerCount: ticketsRes.count ?? 0,
    supportTicketMessagesSenderCount: messagesRes.count ?? 0,
    issuedPlatformInvitationsCount: inviteIssuedAuditRes.count ?? 0,
    linkedPlatformInvitationsCount: inviteLinkedAuditRes.count ?? 0,
    activePlatformRolesCount,
    totalPlatformRolesCount: platformRoles.length,
    organizationsCreatedCount: orgsCreatedRes.count ?? 0,
    leadsCreatedCount: leadsCreatedRes.count ?? 0,
    leadsAssignedCount: leadsAssignedRes.count ?? 0,
    projectsCreatedCount: projectsCreatedRes.count ?? 0,
    tasksAssignedCount: tasksAssignedRes.count ?? 0,
    documentsUploadedCount: docsUploadedRes.count ?? 0,
    userNotificationsCount: notificationsRes.count ?? 0,
    auditEventsActorCount: auditActorRes.count ?? 0,
  };
}

export async function revokeUserWorkspaceAccess(input: {
  actorUserId: string;
  actorRoles: string[];
  actorMfaLevel: string | null | undefined;
  targetUserId: string;
  reason?: string;
  userSupabaseClient?: SupabaseClient;
  adminClientOverride?: SupabaseClient;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!input.actorRoles.includes("super_admin")) {
    return {
      ok: false,
      error: "Only the Global Super Admin can revoke or disable user accounts.",
    };
  }
  if (input.actorMfaLevel !== "aal2") {
    return {
      ok: false,
      error: "A verified MFA (AAL2) session is required to revoke account access.",
    };
  }
  if (!isValidUuid(input.targetUserId)) {
    return { ok: false, error: "Select a valid target user account." };
  }
  if (input.actorUserId === input.targetUserId) {
    return {
      ok: false,
      error: "You cannot disable or revoke your own Super Admin account.",
    };
  }

  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(input.adminClientOverride);
  } catch {
    return {
      ok: false,
      error: "The server-only Supabase admin credential is not configured.",
    };
  }

  const [{ data: superAdminRow }, { data: targetUserRes, error: getUserErr }] =
    await Promise.all([
      admin
        .from("platform_super_admin_designation")
        .select("user_id")
        .eq("user_id", input.targetUserId)
        .maybeSingle(),
      admin.auth.admin.getUserById(input.targetUserId),
    ]);

  if (superAdminRow) {
    return {
      ok: false,
      error: "The designated Global Super Admin account cannot be disabled.",
    };
  }
  if (getUserErr || !targetUserRes?.user) {
    return {
      ok: false,
      error: "The target Supabase Auth account could not be found.",
    };
  }

  const targetUser = targetUserRes.user;
  const nowIso = new Date().toISOString();
  const reason =
    (input.reason || "Revoked by Super Admin via User Management").trim().slice(
      0,
      280,
    );

  // 1. Revoke any active platform_role_assignments
  const { data: activePlatformRoles } = await admin
    .from("platform_role_assignments")
    .select("id, role")
    .eq("user_id", input.targetUserId)
    .is("revoked_at", null);

  if (activePlatformRoles && activePlatformRoles.length > 0) {
    await admin
      .from("platform_role_assignments")
      .update({ revoked_at: nowIso })
      .eq("user_id", input.targetUserId)
      .is("revoked_at", null);
  }

  // 2. Revoke pending platform invitations if caller supplied authenticated RPC client
  let revokedInvitationsCount = 0;
  if (input.userSupabaseClient) {
    const { data: invitations } = await input.userSupabaseClient.rpc(
      "list_platform_invitations",
    );
    const pendingMatches = ((invitations ?? []) as PlatformInvitationRpcRow[]).filter(
      (inv) =>
        inv.status === "pending" &&
        (inv.auth_user_id === input.targetUserId ||
          inv.email.toLowerCase() === (targetUser.email ?? "").toLowerCase()),
    );
    for (const inv of pendingMatches) {
      const { data: revoked } = await input.userSupabaseClient.rpc(
        "revoke_platform_invitation",
        { p_invitation_id: inv.id },
      );
      if (revoked === true) revokedInvitationsCount += 1;
    }
  }

  // 3. Ban the Auth account and record revocation in user_metadata
  const existingMeta = (targetUser.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    input.targetUserId,
    {
      ban_duration: "876000h",
      user_metadata: {
        ...existingMeta,
        account_access_revoked: true,
        account_access_revoked_at: nowIso,
        account_access_revoked_by: input.actorUserId,
        account_access_revoked_reason: reason,
      },
    },
  );

  if (updateErr) {
    logSanitizedOperationalEvent({
      level: "error",
      scope: "admin.user_management",
      action: "revoke_access_failed",
      message: "Failed to ban Auth user during access revocation",
      metadata: { code: updateErr.code, status: updateErr.status },
    });
    return {
      ok: false,
      error:
        "Supabase Auth rejected the account disable update. Verify service credentials and retry.",
    };
  }

  // 4. Write immutable audit event
  await admin.from("audit_events").insert({
    actor_user_id: input.actorUserId,
    scope: "platform",
    action: "platform.user.access_revoked",
    target_type: "auth.users",
    target_id: input.targetUserId,
    details: {
      target_email: targetUser.email ?? null,
      revoked_platform_roles: (activePlatformRoles ?? []).map((r) => r.role),
      revoked_pending_invitations: revokedInvitationsCount,
      reason,
      revoked_at: nowIso,
    },
  });

  return {
    ok: true,
    message: `Workspace access revoked and account disabled for ${targetUser.email ?? input.targetUserId}. Organization records and audit history remain intact.`,
  };
}

export async function restoreUserWorkspaceAccess(input: {
  actorUserId: string;
  actorRoles: string[];
  actorMfaLevel: string | null | undefined;
  targetUserId: string;
  adminClientOverride?: SupabaseClient;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!input.actorRoles.includes("super_admin")) {
    return {
      ok: false,
      error: "Only the Global Super Admin can restore disabled user accounts.",
    };
  }
  if (input.actorMfaLevel !== "aal2") {
    return {
      ok: false,
      error: "A verified MFA (AAL2) session is required to restore account access.",
    };
  }
  if (!isValidUuid(input.targetUserId)) {
    return { ok: false, error: "Select a valid target user account." };
  }

  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(input.adminClientOverride);
  } catch {
    return {
      ok: false,
      error: "The server-only Supabase admin credential is not configured.",
    };
  }

  const { data: targetUserRes, error: getUserErr } =
    await admin.auth.admin.getUserById(input.targetUserId);
  if (getUserErr || !targetUserRes?.user) {
    return {
      ok: false,
      error: "The target Supabase Auth account could not be found.",
    };
  }

  const targetUser = targetUserRes.user;
  const nowIso = new Date().toISOString();
  const existingMeta = (targetUser.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const { error: updateErr } = await admin.auth.admin.updateUserById(
    input.targetUserId,
    {
      ban_duration: "none",
      user_metadata: {
        ...existingMeta,
        account_access_revoked: false,
        account_access_revoked_at: null,
        account_access_revoked_by: null,
        account_access_revoked_reason: null,
        account_access_restored_at: nowIso,
        account_access_restored_by: input.actorUserId,
      },
    },
  );

  if (updateErr) {
    return {
      ok: false,
      error: "Supabase Auth could not restore the disabled user account.",
    };
  }

  await admin.from("audit_events").insert({
    actor_user_id: input.actorUserId,
    scope: "platform",
    action: "platform.user.access_restored",
    target_type: "auth.users",
    target_id: input.targetUserId,
    details: {
      target_email: targetUser.email ?? null,
      restored_at: nowIso,
    },
  });

  return {
    ok: true,
    message: `Account sign-in access restored for ${targetUser.email ?? input.targetUserId}. Re-assign a platform role if staff access is required.`,
  };
}

export async function permanentlyDeleteSupabaseAuthUser(input: {
  actorUserId: string;
  actorRoles: string[];
  actorMfaLevel: string | null | undefined;
  targetUserId: string;
  confirmationEmail: string;
  typedConfirmation: string;
  adminClientOverride?: SupabaseClient;
}): Promise<{
  ok: boolean;
  code?: string;
  message?: string;
  error?: string;
  blockingReasons?: string[];
}> {
  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(input.adminClientOverride);
  } catch {
    return {
      ok: false,
      code: "admin_client_unavailable",
      error:
        "Permanent deletion is unavailable because the server-only Supabase secret is not configured.",
    };
  }

  if (!isValidUuid(input.targetUserId)) {
    return {
      ok: false,
      code: "invalid_target_user_id",
      error: "Select a valid target user UUID.",
    };
  }

  // Look up target Auth user first
  const { data: targetUserRes, error: targetLookupErr } =
    await admin.auth.admin.getUserById(input.targetUserId);
  if (targetLookupErr || !targetUserRes?.user) {
    return {
      ok: false,
      code: "target_not_found",
      error:
        "The target user does not exist in Supabase Auth or was already deleted.",
    };
  }

  const targetUser = targetUserRes.user;
  const targetEmail = (targetUser.email ?? "").trim();

  // Inspect live DB dependencies
  const dependencies = await inspectUserDeletionDependencies(
    admin,
    input.targetUserId,
  );

  // Run full server-side validation
  const validation = validatePermanentUserDeletionRequest({
    actorUserId: input.actorUserId,
    actorRoles: input.actorRoles,
    actorMfaLevel: input.actorMfaLevel,
    targetUserId: input.targetUserId,
    targetEmail,
    confirmationEmail: input.confirmationEmail,
    typedConfirmation: input.typedConfirmation,
    dependencies,
  });

  if (!validation.allowed) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "admin.user_management",
      action: "permanent_delete_blocked",
      message: "Permanent user deletion request blocked by safety validation",
      metadata: {
        code: validation.code,
        targetUserId: input.targetUserId,
        blockingCount: validation.blockingReasons.length,
      },
    });
    return {
      ok: false,
      code: validation.code,
      error: validation.error,
      blockingReasons: validation.blockingReasons,
    };
  }

  // Snapshot profile and platform_role_assignments before mutating so we can roll back on Auth failure
  const [{ data: profileSnapshot }, { data: platformRolesSnapshot }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*")
        .eq("id", input.targetUserId)
        .maybeSingle(),
      admin
        .from("platform_role_assignments")
        .select("*")
        .eq("user_id", input.targetUserId),
    ]);

  // 1. Detach nullable foreign-key references that use ON DELETE RESTRICT on profiles(id)
  const detachOperations = await Promise.all([
    admin
      .from("organizations")
      .update({ created_by: null })
      .eq("created_by", input.targetUserId),
    admin
      .from("organization_memberships")
      .update({ created_by: null })
      .eq("created_by", input.targetUserId),
    admin
      .from("organization_role_assignments")
      .update({ assigned_by: null })
      .eq("assigned_by", input.targetUserId),
    admin
      .from("platform_role_assignments")
      .update({ assigned_by: null })
      .eq("assigned_by", input.targetUserId),
    admin
      .from("platform_sales_leads")
      .update({ created_by: null })
      .eq("created_by", input.targetUserId),
    admin
      .from("platform_sales_leads")
      .update({ assigned_to: null })
      .eq("assigned_to", input.targetUserId),
  ]);

  const detachErr = detachOperations.find((op) => op.error)?.error;
  if (detachErr) {
    logSanitizedOperationalEvent({
      level: "error",
      scope: "admin.user_management",
      action: "detach_references_failed",
      message: "Failed to detach nullable profile references prior to deletion",
      metadata: { code: detachErr.code },
    });
    return {
      ok: false,
      code: "detach_failed",
      error:
        "Could not safely detach linked creator/assignee references. No user or profile was deleted.",
    };
  }

  // 2. Delete target user's platform_role_assignments rows if any
  if ((platformRolesSnapshot ?? []).length > 0) {
    const { error: roleDeleteErr } = await admin
      .from("platform_role_assignments")
      .delete()
      .eq("user_id", input.targetUserId);
    if (roleDeleteErr) {
      return {
        ok: false,
        code: "role_cleanup_failed",
        error:
          "Could not remove platform role assignments prior to deletion. The Auth user was not deleted.",
      };
    }
  }

  // 3. Delete public.profiles row (required because profiles.id has ON DELETE RESTRICT to auth.users.id)
  if (profileSnapshot) {
    const { error: profileDeleteErr } = await admin
      .from("profiles")
      .delete()
      .eq("id", input.targetUserId);

    if (profileDeleteErr) {
      // Restore platform_role_assignments if they were removed
      if ((platformRolesSnapshot ?? []).length > 0) {
        await admin
          .from("platform_role_assignments")
          .upsert(platformRolesSnapshot ?? []);
      }
      logSanitizedOperationalEvent({
        level: "error",
        scope: "admin.user_management",
        action: "profile_delete_blocked",
        message:
          "Database foreign-key constraint blocked public.profiles deletion",
        metadata: { code: profileDeleteErr.code },
      });
      return {
        ok: false,
        code: "profile_fk_blocked",
        error:
          "Database integrity constraints prevented deleting the application profile because protected records still reference this user. Use 'Revoke Access / Disable Account' instead.",
      };
    }
  }

  // 4. Delete the Supabase Auth user via auth.admin.deleteUser(targetUserId)
  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(
    input.targetUserId,
  );
  if (authDeleteErr) {
    // Roll back public.profiles and platform_role_assignments so partial failure never leaves orphan Auth user without profile
    if (profileSnapshot) {
      await admin.from("profiles").upsert(profileSnapshot);
    }
    if ((platformRolesSnapshot ?? []).length > 0) {
      await admin
        .from("platform_role_assignments")
        .upsert(platformRolesSnapshot ?? []);
    }
    logSanitizedOperationalEvent({
      level: "error",
      scope: "admin.user_management",
      action: "auth_delete_failed",
      message:
        "Supabase Auth deleteUser failed; application profile was rolled back",
      metadata: {
        code: authDeleteErr.code,
        status: authDeleteErr.status,
      },
    });
    return {
      ok: false,
      code: "auth_delete_failed",
      error:
        "Supabase Auth rejected the permanent deletion request. Application profile records were rolled back.",
    };
  }

  // 5. Verify actual absence of the Supabase Auth user
  const { data: verifyAfterDelete } = await admin.auth.admin.getUserById(
    input.targetUserId,
  );
  if (verifyAfterDelete?.user) {
    logSanitizedOperationalEvent({
      level: "error",
      scope: "admin.user_management",
      action: "auth_delete_verification_failed",
      message: "Supabase Auth user still present after deleteUser call",
      metadata: { targetUserId: input.targetUserId },
    });
    return {
      ok: false,
      code: "auth_verification_failed",
      error:
        "Deletion could not be verified because the Auth identity is still present in Supabase Auth.",
    };
  }

  // 6. Write immutable, sanitized audit event
  const deletedAtIso = new Date().toISOString();
  const depSummary = evaluateDeletionDependencies(dependencies);
  await admin.from("audit_events").insert({
    actor_user_id: input.actorUserId,
    scope: "platform",
    action: "platform.user.permanently_deleted",
    target_type: "auth.users",
    target_id: input.targetUserId,
    details: {
      target_email: targetEmail,
      target_display_name: profileSnapshot?.display_name ?? null,
      deleted_at: deletedAtIso,
      verified_absent_in_auth: true,
      retained_records: depSummary.retainedRecordsSummary,
      detached_records: depSummary.detachedRecordsSummary,
    },
  });

  return {
    ok: true,
    code: "deleted",
    message: `User ${targetEmail} (${input.targetUserId.slice(0, 8)}…) was permanently deleted from Supabase Auth and verified absent.`,
  };
}
