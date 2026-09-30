import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole =
  | "super_admin"
  | "platform_admin"
  | "developer"
  | "support_staff"
  | "organization_owner"
  | "organization_admin"
  | "project_manager"
  | "client_member";

const privilegedRoles = new Set<WorkspaceRole>([
  "super_admin", "platform_admin", "organization_owner", "organization_admin",
]);

const adminSectionRoles: Record<string, WorkspaceRole[]> = {
  overview: ["super_admin", "platform_admin", "developer", "support_staff"],
  leads: ["super_admin", "platform_admin"],
  clients: ["super_admin", "platform_admin"],
  projects: ["super_admin", "platform_admin", "developer"],
  tasks: ["super_admin", "platform_admin", "developer"],
  team: ["super_admin", "platform_admin"],
  roles: ["super_admin", "platform_admin"],
  content: ["super_admin", "platform_admin"],
  blog: ["super_admin", "platform_admin"],
  portfolio: ["super_admin", "platform_admin"],
  support: ["super_admin", "platform_admin", "support_staff"],
  files: ["super_admin", "platform_admin", "developer"],
  billing: ["super_admin", "platform_admin"],
  analytics: ["super_admin", "platform_admin"],
  notifications: ["super_admin", "platform_admin", "developer", "support_staff"],
  settings: ["super_admin", "platform_admin"],
  "audit-logs": ["super_admin"],
};

const portalSectionRoles: Record<string, WorkspaceRole[]> = {
  overview: ["organization_owner", "organization_admin", "project_manager", "client_member"],
  projects: ["organization_owner", "organization_admin", "project_manager", "client_member"],
  tasks: ["organization_owner", "organization_admin", "project_manager", "client_member"],
  files: ["organization_owner", "organization_admin", "client_member"],
  invoices: ["organization_owner", "organization_admin", "client_member"],
  support: ["organization_owner", "organization_admin", "client_member"],
  notifications: ["organization_owner", "organization_admin", "project_manager", "client_member"],
  settings: ["organization_owner", "organization_admin", "client_member"],
};

export async function requireWorkspace(kind: "admin" | "portal", section: string[] = []) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: platformOperational, error: operationalError } = await supabase.rpc("platform_is_operational");
  if (operationalError) redirect("/setup-required?area=identity-schema");
  if (!platformOperational) redirect("/setup-required?area=super-admin-bootstrap");

  const [platformResult, superAdminResult, orgRolesResult] = await Promise.all([
    supabase.from("platform_role_assignments").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase.from("platform_super_admin_designation").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("organization_role_assignments").select("role, organization_id").eq("user_id", user.id).is("revoked_at", null),
  ]);

  if (platformResult.error || superAdminResult.error || orgRolesResult.error) {
    redirect("/setup-required?area=identity-schema");
  }

  const roles = new Set<WorkspaceRole>();
  for (const assignment of platformResult.data ?? []) {
    if (["platform_admin", "developer", "support_staff"].includes(assignment.role)) {
      roles.add(assignment.role as WorkspaceRole);
    }
  }
  if (superAdminResult.data) roles.add("super_admin");
  for (const assignment of orgRolesResult.data ?? []) {
    if (["organization_owner", "organization_admin", "project_manager", "client_member"].includes(assignment.role)) {
      roles.add(assignment.role as WorkspaceRole);
    }
  }

  if (roles.size === 0) redirect("/access-pending");
  const isAdmin = [...roles].some((role) => ["super_admin", "platform_admin", "developer", "support_staff"].includes(role));
  const isPortal = [...roles].some((role) => role.startsWith("organization_") || role === "project_manager" || role === "client_member");
  if ((kind === "admin" && !isAdmin) || (kind === "portal" && !isPortal)) redirect("/access-denied");

  const currentSection = section[0] ?? "overview";
  const sectionRoles = (kind === "admin" ? adminSectionRoles : portalSectionRoles)[currentSection];
  if (!sectionRoles || ![...roles].some((role) => sectionRoles.includes(role))) redirect("/access-denied");

  if ([...roles].some((role) => privilegedRoles.has(role))) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") redirect("/mfa?next=" + encodeURIComponent(kind === "admin" ? "/admin" : "/portal"));
  }

  const organizationRoles = [...roles].filter((role) => role.startsWith("organization_") || role === "project_manager" || role === "client_member");
  if (organizationRoles.length > 0) {
    const { data: activeMemberships, error: membershipError } = await supabase.from("organization_memberships").select("organization_id, organizations!inner(status)").eq("user_id", user.id).eq("status", "active").eq("organizations.status", "active");
    if (membershipError) redirect("/setup-required?area=identity-schema");
    if (!activeMemberships?.length) {
      for (const role of organizationRoles) roles.delete(role);
    }
  }

  if (roles.size === 0) redirect("/access-pending");

  return { user, roles: [...roles] };
}
