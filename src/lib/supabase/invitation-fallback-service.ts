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
  if (rpcStatus === "pending" || rpcStatus === "valid") {
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
      .select("organization_id, status")
      .eq("user_id", userId),
    admin
      .from("audit_events")
      .select("id, occurred_at, actor_user_id, action, target_type, target_id, details")
      .in("action", ["organization.member_invited", "lead.converted_to_client"])
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

  // Check if invited via Client Portal Onboarding
  const activeOrgMembership = (orgMemberRes.data ?? []).find((m) => m.status === "active");
  if (activeOrgMembership) {
    return {
      invitationVerified: true,
      status: "valid",
      source: "organization_invite_fallback",
      email,
      organizationId: activeOrgMembership.organization_id,
    };
  }

  for (const raw of (orgInviteAuditRes.data ?? []) as AuditInvitationEvent[]) {
    const details = raw.details ?? {};
    const invitedEmail =
      typeof details.email === "string"
        ? details.email.toLowerCase().trim()
        : typeof details.client_email === "string"
          ? details.client_email.toLowerCase().trim()
          : "";
    if (invitedEmail === email) {
      const orgId =
        typeof details.organization_id === "string"
          ? details.organization_id
          : raw.target_type === "organizations" && typeof raw.target_id === "string"
            ? raw.target_id
            : undefined;
      const orgRole = typeof details.role === "string" ? details.role : "client_owner";
      return {
        invitationVerified: true,
        status: "valid",
        source: "organization_invite_fallback",
        email,
        invitedBy: raw.actor_user_id ?? null,
        organizationId: orgId,
        organizationRole: orgRole,
      };
    }
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

  if (
    fallbackState.source === "platform_audit_fallback" &&
    fallbackState.role &&
    ["platform_admin", "developer", "support_staff"].includes(fallbackState.role)
  ) {
    // Ensure profile exists for userId
    if (fallbackState.email) {
      await admin
        .from("profiles")
        .upsert(
          { id: userId, email: fallbackState.email },
          { onConflict: "id", ignoreDuplicates: true },
        );
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
          assigned_by: fallbackState.invitedBy ?? userId,
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
    const mappedOrgRole =
      fallbackState.organizationRole === "client_owner"
        ? "organization_owner"
        : fallbackState.organizationRole === "client_manager"
          ? "organization_admin"
          : fallbackState.organizationRole === "client_collaborator"
            ? "project_manager"
            : "client_member";

    if (fallbackState.email) {
      await admin
        .from("profiles")
        .upsert(
          { id: userId, email: fallbackState.email },
          { onConflict: "id", ignoreDuplicates: true },
        );
    }

    await admin.from("organization_memberships").upsert(
      {
        organization_id: fallbackState.organizationId,
        user_id: userId,
        status: "active",
        invited_by: fallbackState.invitedBy ?? userId,
      },
      { onConflict: "organization_id,user_id" },
    );

    const { data: existingOrgRole } = await admin
      .from("organization_role_assignments")
      .select("id")
      .eq("organization_id", fallbackState.organizationId)
      .eq("user_id", userId)
      .eq("role", mappedOrgRole)
      .is("revoked_at", null)
      .maybeSingle();

    if (!existingOrgRole) {
      await admin.from("organization_role_assignments").insert({
        organization_id: fallbackState.organizationId,
        user_id: userId,
        role: mappedOrgRole,
        assigned_by: fallbackState.invitedBy ?? userId,
      });
    }
    return { ok: true };
  }

  return { ok: true };
}

