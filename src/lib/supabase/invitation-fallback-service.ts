import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformInvitationRpcRow } from "./user-management-service.ts";
import { logSanitizedOperationalEvent } from "./platform-health-helper.ts";

async function resolveAdminClient(override?: SupabaseClient): Promise<SupabaseClient> {
  if (override) return override;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

interface AuditInvitationEvent {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Reconstructs platform_invitations rows from immutable `audit_events` + `auth.users`
 * when `list_platform_invitations` returns PostgreSQL error 42702 (ambiguous column reference)
 * prior to applying `20261011140000_fix_invitation_rpc_and_otp_amr.sql`.
 */
export async function reconstructPlatformInvitationsFromAudit(options: {
  roles: string[];
  adminClientOverride?: SupabaseClient;
}): Promise<PlatformInvitationRpcRow[]> {
  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(options.adminClientOverride);
  } catch {
    return [];
  }

  const [auditRes, usersRes, roleAssignmentsRes] = await Promise.all([
    admin
      .from("audit_events")
      .select("id, occurred_at, actor_user_id, action, target_type, target_id, details")
      .eq("target_type", "platform_invitations")
      .order("occurred_at", { ascending: true })
      .limit(500),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("platform_role_assignments")
      .select("user_id, role, revoked_at"),
  ]);

  if (auditRes.error || !auditRes.data) {
    return [];
  }

  const authUserByEmail = new Map<string, { id: string; email_confirmed_at?: string | null }>();
  for (const u of usersRes.data?.users ?? []) {
    if (u.email) {
      authUserByEmail.set(u.email.toLowerCase(), {
        id: u.id,
        email_confirmed_at: u.email_confirmed_at ?? null,
      });
    }
  }

  const activeRolesByUserId = new Map<string, Set<string>>();
  for (const r of roleAssignmentsRes.data ?? []) {
    if (!r.revoked_at) {
      const set = activeRolesByUserId.get(r.user_id) ?? new Set<string>();
      set.add(r.role);
      activeRolesByUserId.set(r.user_id, set);
    }
  }

  const byId = new Map<
    string,
    PlatformInvitationRpcRow & { invited_by: string | null }
  >();
  const countByEmail = new Map<string, number>();

  for (const raw of auditRes.data as AuditInvitationEvent[]) {
    const targetId = raw.target_id;
    if (!targetId) continue;
    const details = raw.details ?? {};
    const email = typeof details.email === "string" ? details.email.toLowerCase().trim() : "";
    const role = typeof details.role === "string" ? details.role : "developer";
    const expiresAt =
      typeof details.expires_at === "string"
        ? details.expires_at
        : new Date(new Date(raw.occurred_at).getTime() + 60 * 60 * 1000).toISOString();

    if (email.startsWith("e2e.verify.")) {
      continue;
    }

    if (raw.action === "platform.invitation.created") {
      const prevCount = countByEmail.get(email) ?? 0;
      countByEmail.set(email, prevCount + 1);
      const matchedUser = authUserByEmail.get(email);
      byId.set(targetId, {
        id: targetId,
        email,
        role,
        status: "pending",
        created_at: raw.occurred_at,
        expires_at: expiresAt,
        auth_user_id: matchedUser?.id ?? null,
        resend_count: prevCount,
        last_resent_at: prevCount > 0 ? raw.occurred_at : null,
        archived_at: null,
        invited_by: raw.actor_user_id ?? null,
      });
    } else if (raw.action === "platform.invitation.archived") {
      const existing = byId.get(targetId);
      if (existing) {
        existing.archived_at = raw.occurred_at;
      }
    } else if (raw.action.startsWith("platform.invitation.")) {
      const newStatus = raw.action.replace("platform.invitation.", "");
      const existing = byId.get(targetId);
      if (existing && ["accepted", "revoked", "expired"].includes(newStatus)) {
        existing.status = newStatus;
      }
    }
  }

  const nowMs = Date.now();
  const isSuperAdmin = options.roles.includes("super_admin");
  const rows: PlatformInvitationRpcRow[] = [];

  for (const item of byId.values()) {
    if (item.archived_at) {
      continue;
    }
    if (!isSuperAdmin && item.role === "platform_admin") {
      continue;
    }
    const matchedUser = authUserByEmail.get(item.email);
    if (
      item.status === "pending" &&
      matchedUser &&
      activeRolesByUserId.get(matchedUser.id)?.has(item.role)
    ) {
      item.status = "accepted";
    } else if (
      item.status === "pending" &&
      new Date(item.expires_at).getTime() <= nowMs
    ) {
      item.status = "expired";
    }
    rows.push({
      id: item.id,
      email: item.email,
      role: item.role,
      status: item.status,
      created_at: item.created_at,
      expires_at: item.expires_at,
      auth_user_id: item.auth_user_id,
      resend_count: item.resend_count,
      last_resent_at: item.last_resent_at,
      archived_at: item.archived_at,
    });
  }

  rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return rows.slice(0, 100);
}

export interface VerifiedInvitationFallbackState {
  invitationVerified: boolean;
  status: "pending" | "valid" | "expired" | "revoked" | "accepted" | "invalid";
  source: "rpc" | "platform_audit_fallback" | "organization_invite_fallback" | "none";
  invitationId?: string;
  email?: string;
  role?: string;
  invitedBy?: string | null;
  organizationId?: string;
  organizationRole?: string;
}

export type CanonicalOrganizationRole =
  | "organization_owner"
  | "organization_admin"
  | "project_manager"
  | "client_member";

export function mapClientInviteRoleToOrganizationRole(
  role?: string | null,
): CanonicalOrganizationRole {
  switch (role) {
    case "client_owner":
    case "organization_owner":
      return "organization_owner";
    case "client_manager":
    case "organization_admin":
      return "organization_admin";
    case "client_collaborator":
    case "project_manager":
      return "project_manager";
    case "client_viewer":
    case "client_member":
    default:
      return "client_member";
  }
}

/**
 * Resolves whether an authenticated invite session is authorized to complete password setup,
 * falling back to `auth.users` + `audit_events` + `organization_memberships` when the database RPC
 * returns `"invalid"` because GoTrue emitted `amr: [{"method": "otp"}]` or because the user was
 * invited through the Client Portal onboarding flow.
 */
export async function resolveVerifiedInvitationState(options: {
  userId: string;
  rpcStatus: string | null;
  adminClientOverride?: SupabaseClient;
}): Promise<VerifiedInvitationFallbackState> {
  const { userId, rpcStatus } = options;
  if (rpcStatus === "pending") {
    return {
      invitationVerified: true,
      status: rpcStatus,
      source: "rpc",
    };
  }
  if (rpcStatus === "expired" || rpcStatus === "revoked" || rpcStatus === "accepted") {
    return {
      invitationVerified: false,
      status: rpcStatus,
      source: "rpc",
    };
  }

  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(options.adminClientOverride);
  } catch {
    if (rpcStatus === "valid") {
      return { invitationVerified: true, status: "valid", source: "rpc" };
    }
    return { invitationVerified: false, status: "invalid", source: "none" };
  }

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  const authUser = userRes?.user;
  if (
    userErr ||
    !authUser ||
    !authUser.email ||
    !authUser.invited_at ||
    !authUser.email_confirmed_at ||
    authUser.is_anonymous
  ) {
    return { invitationVerified: false, status: "invalid", source: "none" };
  }

  const email = authUser.email.toLowerCase().trim();

  // Check platform invitations audit history and role assignments
  const [auditRes, rolesRes, orgMemberRes, orgInviteAuditRes] = await Promise.all([
    admin
      .from("audit_events")
      .select("id, occurred_at, actor_user_id, action, target_type, target_id, details")
      .eq("target_type", "platform_invitations")
      .order("occurred_at", { ascending: true })
      .limit(500),
    admin
      .from("platform_role_assignments")
      .select("role, revoked_at")
      .eq("user_id", userId)
      .is("revoked_at", null),
    admin
      .from("organization_memberships")
      .select("organization_id, status, created_by")
      .eq("user_id", userId),
    admin
      .from("audit_events")
      .select("id, occurred_at, actor_user_id, action, target_type, target_id, details")
      .in("action", [
        "organization.member_invited",
        "lead.converted_to_client",
        "organization.invitation.accepted",
        "organization.invitation.revoked",
        "organization.invitation.expired",
      ])
      .order("occurred_at", { ascending: false })
      .limit(200),
  ]);

  const byId = new Map<
    string,
    {
      id: string;
      email: string;
      role: string;
      status: "pending" | "accepted" | "revoked" | "expired";
      createdAt: string;
      expiresAt: string;
      invitedBy: string | null;
    }
  >();

  for (const raw of (auditRes.data ?? []) as AuditInvitationEvent[]) {
    const targetId = raw.target_id;
    if (!targetId) continue;
    const details = raw.details ?? {};
    const evEmail = typeof details.email === "string" ? details.email.toLowerCase().trim() : "";
    if (evEmail !== email) continue;
    const evRole = typeof details.role === "string" ? details.role : "developer";
    const evExpires =
      typeof details.expires_at === "string"
        ? details.expires_at
        : new Date(new Date(raw.occurred_at).getTime() + 60 * 60 * 1000).toISOString();

    if (raw.action === "platform.invitation.created") {
      byId.set(targetId, {
        id: targetId,
        email: evEmail,
        role: evRole,
        status: "pending",
        createdAt: raw.occurred_at,
        expiresAt: evExpires,
        invitedBy: raw.actor_user_id ?? null,
      });
    } else if (raw.action.startsWith("platform.invitation.")) {
      const newStatus = raw.action.replace("platform.invitation.", "");
      const existing = byId.get(targetId);
      if (existing && ["accepted", "revoked", "expired"].includes(newStatus)) {
        existing.status = newStatus as "accepted" | "revoked" | "expired";
      }
    }
  }

  const matchingPlatformInvites = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (matchingPlatformInvites.length > 0) {
    const latest = matchingPlatformInvites[0];
    const alreadyAssigned = (rolesRes.data ?? []).some((r) => r.role === latest.role);
    if (alreadyAssigned || latest.status === "accepted") {
      return {
        invitationVerified: false,
        status: "accepted",
        source: "platform_audit_fallback",
        invitationId: latest.id,
        email,
        role: latest.role,
      };
    }
    if (latest.status === "revoked") {
      return {
        invitationVerified: false,
        status: "revoked",
        source: "platform_audit_fallback",
        invitationId: latest.id,
        email,
        role: latest.role,
      };
    }
    if (new Date(latest.expiresAt).getTime() <= Date.now()) {
      return {
        invitationVerified: false,
        status: "expired",
        source: "platform_audit_fallback",
        invitationId: latest.id,
        email,
        role: latest.role,
      };
    }
    return {
      invitationVerified: true,
      status: "pending",
      source: "platform_audit_fallback",
      invitationId: latest.id,
      email,
      role: latest.role,
      invitedBy: latest.invitedBy,
    };
  }

  // Check Client Portal organization invitation audit events first so accepted/revoked/expired
  // states and invited role metadata take precedence.
  const activeOrgMembership = (orgMemberRes.data ?? []).find((m) => m.status === "active");

  for (const raw of (orgInviteAuditRes.data ?? []) as AuditInvitationEvent[]) {
    const details = raw.details ?? {};
    const invitedEmail =
      typeof details.email === "string"
        ? details.email.toLowerCase().trim()
        : typeof details.client_email === "string"
          ? details.client_email.toLowerCase().trim()
          : "";
    if (invitedEmail !== email) continue;

    const orgId =
      typeof details.organization_id === "string"
        ? details.organization_id
        : raw.target_type === "organizations" && typeof raw.target_id === "string"
          ? raw.target_id
          : activeOrgMembership?.organization_id;
    const orgRole = typeof details.role === "string" ? details.role : "client_owner";

    if (raw.action === "organization.invitation.accepted") {
      return {
        invitationVerified: false,
        status: "accepted",
        source: "organization_invite_fallback",
        email,
        organizationId: orgId,
        organizationRole: orgRole,
      };
    }
    if (raw.action === "organization.invitation.revoked") {
      return {
        invitationVerified: false,
        status: "revoked",
        source: "organization_invite_fallback",
        email,
        organizationId: orgId,
        organizationRole: orgRole,
      };
    }
    if (raw.action === "organization.invitation.expired") {
      return {
        invitationVerified: false,
        status: "expired",
        source: "organization_invite_fallback",
        email,
        organizationId: orgId,
        organizationRole: orgRole,
      };
    }

    const expiresAtIso =
      typeof details.expires_at === "string"
        ? details.expires_at
        : new Date(new Date(raw.occurred_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      return {
        invitationVerified: false,
        status: "expired",
        source: "organization_invite_fallback",
        email,
        organizationId: orgId,
        organizationRole: orgRole,
      };
    }

    return {
      invitationVerified: true,
      status: "valid",
      source: "organization_invite_fallback",
      email,
      invitedBy: raw.actor_user_id ?? activeOrgMembership?.created_by ?? null,
      organizationId: orgId,
      organizationRole: orgRole,
    };
  }

  if (activeOrgMembership) {
    return {
      invitationVerified: true,
      status: "valid",
      source: "organization_invite_fallback",
      email,
      invitedBy: activeOrgMembership.created_by ?? null,
      organizationId: activeOrgMembership.organization_id,
    };
  }

  if (rpcStatus === "valid") {
    return {
      invitationVerified: true,
      status: "valid",
      source: "rpc",
      email,
    };
  }

  const metaRole =
    typeof authUser.user_metadata?.invited_role === "string"
      ? authUser.user_metadata.invited_role
      : null;
  if (metaRole && ["platform_admin", "developer", "support_staff"].includes(metaRole)) {
    const alreadyAssigned = (rolesRes.data ?? []).some((r) => r.role === metaRole);
    if (alreadyAssigned) {
      return {
        invitationVerified: false,
        status: "accepted",
        source: "platform_audit_fallback",
        email,
        role: metaRole,
      };
    }
    const invitedAtMs = new Date(authUser.invited_at).getTime();
    if (Number.isFinite(invitedAtMs) && invitedAtMs + 24 * 60 * 60 * 1000 <= Date.now()) {
      return {
        invitationVerified: false,
        status: "expired",
        source: "platform_audit_fallback",
        email,
        role: metaRole,
      };
    }
    return {
      invitationVerified: true,
      status: "pending",
      source: "platform_audit_fallback",
      email,
      role: metaRole,
    };
  }

  return { invitationVerified: false, status: "invalid", source: "none" };
}

/**
 * Completes role assignment when `accept_platform_invitation` RPC cannot complete due to
 * GoTrue's `{"method": "otp"}` AMR claim or when accepting a Client Portal organization invitation.
 */
export async function completeInvitationAcceptanceFallback(options: {
  userId: string;
  fallbackState: VerifiedInvitationFallbackState;
  adminClientOverride?: SupabaseClient;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, fallbackState } = options;
  let admin: SupabaseClient;
  try {
    admin = await resolveAdminClient(options.adminClientOverride);
  } catch {
    return { ok: false, error: "Server-only Supabase admin client is unavailable." };
  }

  const defaultDisplayName = (fallbackState.email ?? "Member").split("@")[0] || "Member";

  if (
    fallbackState.source === "platform_audit_fallback" &&
    fallbackState.role &&
    ["platform_admin", "developer", "support_staff"].includes(fallbackState.role)
  ) {
    // Ensure profile exists for userId using canonical public.profiles columns
    await admin
      .from("profiles")
      .upsert(
        { id: userId, display_name: defaultDisplayName },
        { onConflict: "id", ignoreDuplicates: true },
      );

    let assignedByUserId = userId;
    if (fallbackState.invitedBy) {
      const { data: inviterProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", fallbackState.invitedBy)
        .maybeSingle();
      if (inviterProfile?.id) {
        assignedByUserId = inviterProfile.id;
      }
    }

    const { data: existingRole } = await admin
      .from("platform_role_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("role", fallbackState.role)
      .is("revoked_at", null)
      .maybeSingle();

    if (!existingRole) {
      const { error: insertErr } = await admin
        .from("platform_role_assignments")
        .insert({
          user_id: userId,
          role: fallbackState.role,
          assigned_by: assignedByUserId,
        });
      if (insertErr) {
        logSanitizedOperationalEvent({
          level: "error",
          scope: "auth.invitation_fallback",
          action: "platform_role_insert_failed",
          message: "Failed to assign platform role during invitation acceptance fallback",
          metadata: { code: insertErr.code },
        });
        return { ok: false, error: "Could not assign the authorized platform role." };
      }
    }

    if (fallbackState.invitationId) {
      await admin.from("audit_events").insert({
        actor_user_id: userId,
        scope: "platform",
        action: "platform.invitation.accepted",
        target_type: "platform_invitations",
        target_id: fallbackState.invitationId,
        details: {
          email: fallbackState.email,
          role: fallbackState.role,
          accepted_via: "otp_amr_verified_fallback",
        },
      });
    }
    return { ok: true };
  }

  if (fallbackState.source === "organization_invite_fallback" && fallbackState.organizationId) {
    const mappedOrgRole = mapClientInviteRoleToOrganizationRole(fallbackState.organizationRole);

    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        { id: userId, display_name: defaultDisplayName },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (profileErr) {
      logSanitizedOperationalEvent({
        level: "error",
        scope: "auth.invitation_fallback",
        action: "org_profile_upsert_failed",
        message: "Failed to provision user profile during organization invitation acceptance",
        metadata: { code: profileErr.code },
      });
      return { ok: false, error: "Could not initialize user profile for organization membership." };
    }

    let actorProfileId = userId;
    if (fallbackState.invitedBy) {
      const { data: inviterProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", fallbackState.invitedBy)
        .maybeSingle();
      if (inviterProfile?.id) {
        actorProfileId = inviterProfile.id;
      }
    }

    const { error: membershipErr } = await admin.from("organization_memberships").upsert(
      {
        organization_id: fallbackState.organizationId,
        user_id: userId,
        status: "active",
        created_by: actorProfileId,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (membershipErr) {
      logSanitizedOperationalEvent({
        level: "error",
        scope: "auth.invitation_fallback",
        action: "org_membership_upsert_failed",
        message: "Failed to upsert organization membership during invitation acceptance",
        metadata: { code: membershipErr.code },
      });
      return { ok: false, error: "Could not activate organization membership." };
    }

    const { data: existingOrgRole } = await admin
      .from("organization_role_assignments")
      .select("id, role")
      .eq("organization_id", fallbackState.organizationId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!existingOrgRole) {
      const { error: roleInsertErr } = await admin.from("organization_role_assignments").insert({
        organization_id: fallbackState.organizationId,
        user_id: userId,
        role: mappedOrgRole,
        assigned_by: actorProfileId,
      });
      if (roleInsertErr) {
        logSanitizedOperationalEvent({
          level: "error",
          scope: "auth.invitation_fallback",
          action: "org_role_insert_failed",
          message: "Failed to assign organization role during invitation acceptance",
          metadata: { code: roleInsertErr.code },
        });
        return { ok: false, error: "Could not assign organization role." };
      }
    } else if (existingOrgRole.role !== mappedOrgRole) {
      const { error: roleUpdateErr } = await admin
        .from("organization_role_assignments")
        .update({ role: mappedOrgRole, assigned_by: actorProfileId })
        .eq("id", existingOrgRole.id);
      if (roleUpdateErr) {
        logSanitizedOperationalEvent({
          level: "error",
          scope: "auth.invitation_fallback",
          action: "org_role_update_failed",
          message: "Failed to update organization role during invitation acceptance",
          metadata: { code: roleUpdateErr.code },
        });
        return { ok: false, error: "Could not update organization role." };
      }
    }

    await admin.from("audit_events").insert({
      actor_user_id: userId,
      scope: "platform",
      action: "organization.invitation.accepted",
      target_type: "organizations",
      target_id: fallbackState.organizationId,
      details: {
        email: fallbackState.email,
        organization_id: fallbackState.organizationId,
        role: mappedOrgRole,
      },
    });

    return { ok: true };
  }

  return { ok: true };
}

