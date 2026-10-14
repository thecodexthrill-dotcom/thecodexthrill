"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";
import { resolveAppOrigin } from "@/lib/app-origin";
import { invitationRedirectTo } from "@/lib/supabase/invitation-link";
import { extractLeadService } from "@/lib/supabase/lead-service-helper";
import { dispatchPlatformStaffNotifications } from "@/lib/supabase/notification-service";
import { logSanitizedOperationalEvent } from "@/lib/supabase/platform-health-helper";
import { permanentlyDeleteOrganization } from "@/lib/supabase/organization-lifecycle-service";

export type OrganizationActionState = {
  error?: string;
  message?: string;
  deletedOrganizationId?: string;
  timestamp?: string;
};

const managerRoles = ["super_admin", "platform_admin"] as const;
const leadSchema = z.object({
  contact_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  company_name: z.string().trim().max(160).optional(),
  message: z.string().max(10000).optional(),
  source: z.enum(["website", "admin", "referral", "import", "other"]),
  stage: z.enum(["new", "contacted", "qualified", "converted", "closed"]),
  follow_up_at: z.string().optional(),
});

function canManage(roles: string[]) {
  return roles.some((role) => managerRoles.includes(role as (typeof managerRoles)[number]));
}

async function verifySameOriginRequest(): Promise<boolean> {
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  if (!origin) return true;
  const rawForwardedHost = hdrs.get("x-forwarded-host") ?? "";
  const rawHost = hdrs.get("host") ?? "";
  const candidateHosts = [
    ...rawForwardedHost.split(","),
    ...rawHost.split(","),
  ]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (candidateHosts.length === 0) return false;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    return candidateHosts.includes(originHost);
  } catch {
    return false;
  }
}

export async function createLeadAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["leads"]);
  if (!canManage(roles)) redirect("/access-denied");
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/leads?error=invalid");
  const rawFollowUp = parsed.data.follow_up_at?.trim();
  const followUpIso = rawFollowUp ? new Date(rawFollowUp).toISOString() : null;

  const supabase = await createClient();
  const { error } = await supabase.from("platform_sales_leads").insert({
    ...parsed.data,
    company_name: parsed.data.company_name || null,
    message: parsed.data.message || null,
    follow_up_at: followUpIso,
    created_by: user.id,
  });
  if (error) redirect("/admin/leads?error=save");
  revalidatePath("/admin/leads");
  redirect("/admin/leads?created=1");
}

export async function updateLeadAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["leads"]);
  if (!canManage(roles)) redirect("/access-denied");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!id.success || !parsed.success) redirect("/admin/leads?error=invalid");
  const rawFollowUp = parsed.data.follow_up_at?.trim();
  const followUpIso = rawFollowUp ? new Date(rawFollowUp).toISOString() : null;

  const supabase = await createClient();
  const { error } = await supabase.from("platform_sales_leads").update({
    ...parsed.data,
    company_name: parsed.data.company_name || null,
    message: parsed.data.message || null,
    follow_up_at: followUpIso,
  }).eq("id", id.data);
  if (error) redirect(`/admin/leads?id=${id.data}&error=save`);
  revalidatePath("/admin/leads");
  redirect(`/admin/leads?id=${id.data}&updated=1`);
}

export async function deleteLeadAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["leads"]);
  if (!canManage(roles)) redirect("/access-denied");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/leads?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.from("platform_sales_leads").delete().eq("id", id.data);
  if (error) redirect("/admin/leads?error=save");
  revalidatePath("/admin/leads");
  redirect("/admin/leads?deleted=1");
}


const organizationSchema = z.object({ name: z.string().trim().min(1).max(160) });
const organizationStatusSchema = z.enum(["active", "suspended", "deleted"]);

export async function createOrganizationAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["clients"]);
  if (!canManage(roles)) redirect("/access-denied");
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect("/admin/clients?error=invalid");
  const supabase = await createClient();
  const { data: createdOrg, error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, created_by: user.id })
    .select("id, name, status")
    .maybeSingle();
  if (error) redirect("/admin/clients?error=save");
  try {
    const adminClient = createAdminClient();
    await adminClient.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "organization.created",
      target_type: "organizations",
      target_id: createdOrg?.id ?? parsed.data.name,
      details: {
        organization_name: parsed.data.name,
        status: createdOrg?.status ?? "active",
      },
    });
  } catch {
    // Non-blocking audit fallback
  }
  revalidatePath("/admin/clients");
  redirect("/admin/clients?created=1");
}

export async function updateOrganizationAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["clients"]);
  if (!canManage(roles)) redirect("/access-denied");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const name = organizationSchema.shape.name.safeParse(formData.get("name"));
  const status = organizationStatusSchema.safeParse(formData.get("status"));
  const returnToDetail = formData.get("return_to") === "detail";
  if (!id.success || !name.success || !status.success) redirect("/admin/clients?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({
    name: name.data,
    status: status.data,
    deleted_at: status.data === "deleted" ? new Date().toISOString() : null,
  }).eq("id", id.data);
  if (error) redirect(returnToDetail ? `/admin/clients?id=${id.data}&error=save` : "/admin/clients?error=save");
  try {
    const adminClient = createAdminClient();
    await adminClient.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "organization.lifecycle_updated",
      target_type: "organizations",
      target_id: id.data,
      details: {
        organization_name: name.data,
        status: status.data,
        archived: status.data === "deleted",
      },
    });
  } catch {
    // Non-blocking audit fallback
  }
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
  redirect(returnToDetail ? `/admin/clients?id=${id.data}&updated=1` : "/admin/clients?updated=1");
}

export async function permanentlyDeleteOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  if (!(await verifySameOriginRequest())) {
    return { error: "Cross-origin request rejected." };
  }

  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      confirmationName: z.string().trim().min(1).max(160),
      typedConfirmation: z.string().trim().min(1).max(180),
    })
    .safeParse({
      organizationId: formData.get("organization-id"),
      confirmationName: formData.get("confirmation-name"),
      typedConfirmation: formData.get("typed-confirmation"),
    });

  if (!parsed.success) {
    return {
      error: "Provide a valid organization ID, exact organization name, and confirmation phrase.",
    };
  }

  const { user, roles } = await requireWorkspace("admin", ["clients"]);
  if (!roles.includes("super_admin")) {
    return {
      error: "Only the Global Super Admin is authorized to permanently delete organizations.",
    };
  }

  const supabase = await createClient();
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return {
      error: "A verified MFA (AAL2) session is required before permanently deleting an organization.",
    };
  }

  const result = await permanentlyDeleteOrganization({
    actorUserId: user.id,
    actorRoles: roles,
    actorMfaLevel: assurance.currentLevel,
    organizationId: parsed.data.organizationId,
    confirmationName: parsed.data.confirmationName,
    typedConfirmation: parsed.data.typedConfirmation,
  });

  if (!result.ok) {
    return {
      error:
        result.error ??
        "Permanent organization deletion was rejected. Review dependent records and retry.",
    };
  }

  revalidatePath("/admin/[[...section]]", "page");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/analytics");
  return {
    message: result.message ?? "Organization permanently deleted.",
    deletedOrganizationId: result.deletedOrganizationId ?? parsed.data.organizationId,
    timestamp: new Date().toISOString(),
  };
}

async function provisionClientOrganizationMember(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  invitedUserId: string;
  email: string;
  role: "client_owner" | "client_manager" | "client_collaborator" | "client_viewer";
  actorUserId: string;
}) {
  const mappedOrgRole =
    params.role === "client_owner"
      ? "organization_owner"
      : params.role === "client_manager"
        ? "organization_admin"
        : params.role === "client_collaborator"
          ? "project_manager"
          : "client_member";

  const { error: rpcErr } = await params.adminClient.rpc("provision_organization_membership", {
    p_organization_id: params.organizationId,
    p_user_id: params.invitedUserId,
    p_role: mappedOrgRole,
    p_actor_user_id: params.actorUserId,
    p_display_name: params.email.split("@")[0] ?? "Client Member",
  });
  if (rpcErr) {
    throw new Error(`Failed to provision client organization member via atomic RPC: ${rpcErr.message}`);
  }
}

const convertLeadSchema = z.object({
  lead_id: z.string().uuid(),
  organization_name: z.string().trim().max(160).optional(),
  project_name: z.string().trim().max(200).optional(),
  project_description: z.string().trim().max(5000).optional(),
  target_date: z.string().trim().optional(),
});

export async function convertLeadToClientAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["leads", "clients"]);
  if (!canManage(roles)) redirect("/access-denied");

  const parsed = convertLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/leads?error=invalid");

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. Fetch Lead
  const { data: lead, error: leadFetchErr } = await supabase
    .from("platform_sales_leads")
    .select("id, contact_name, email, company_name, message, stage")
    .eq("id", parsed.data.lead_id)
    .single();

  if (leadFetchErr || !lead) {
    redirect("/admin/leads?error=not_found");
  }

  // 2. Prepare Organization Name
  const targetOrgName =
    parsed.data.organization_name?.trim() ||
    lead.company_name?.trim() ||
    `${lead.contact_name}'s Organization`;

  // 3. Create Organization
  const { data: newOrg, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: targetOrgName,
      status: "active",
      created_by: user.id,
    })
    .select()
    .single();

  if (orgErr || !newOrg) {
    logSanitizedOperationalEvent({
      level: "error",
      scope: "crm.convert_lead",
      action: "organization_create_failed",
      message: "Failed to create client organization during lead conversion",
      metadata: { code: orgErr?.code, message: orgErr?.message },
    });
    redirect(`/admin/leads?id=${lead.id}&error=save`);
  }

  // 4. Create Delivery Handover Project in tenant_projects
  const parsedLeadService = extractLeadService(lead.message);
  const targetProjectName =
    parsed.data.project_name?.trim() ||
    `${newOrg.name} — ${parsedLeadService.requestedService !== "General Technical Inquiry" ? parsedLeadService.requestedService : "Client Delivery"}`;

  const targetDescription =
    parsed.data.project_description?.trim() ||
    parsedLeadService.notes ||
    lead.message ||
    "Initial handover delivery project for converted client.";

  const rawTargetDate = parsed.data.target_date?.trim();
  const targetDateIso = rawTargetDate ? new Date(rawTargetDate).toISOString().slice(0, 10) : null;

  const { data: newProject, error: projectErr } = await supabase
    .from("tenant_projects")
    .insert({
      organization_id: newOrg.id,
      name: targetProjectName,
      description: targetDescription,
      status: "planning",
      progress_pct: 0,
      target_date: targetDateIso,
      created_by: user.id,
    })
    .select()
    .single();

  if (projectErr) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "crm.convert_lead",
      action: "handover_project_warning",
      message: "Handover project creation warning during lead conversion",
      metadata: { code: projectErr.code, message: projectErr.message },
    });
  }

  // 5. Advance lead stage to 'converted'
  await supabase
    .from("platform_sales_leads")
    .update({ stage: "converted" })
    .eq("id", lead.id);

  // 6. Supabase Auth client portal invitation
  let onboardingStatus = "smtp_pending";
  try {
    const appBase = resolveAppOrigin() ?? new URL("https://thecodexthrill.com");
    const redirectTo = invitationRedirectTo(appBase);
    const { data: invitedData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      lead.email,
      { redirectTo },
    );
    if (!inviteErr) {
      onboardingStatus = "invited";
      if (invitedData?.user?.id) {
        await provisionClientOrganizationMember({
          adminClient,
          organizationId: newOrg.id,
          invitedUserId: invitedData.user.id,
          email: lead.email,
          role: "client_owner",
          actorUserId: user.id,
        });
      }
    } else {
      logSanitizedOperationalEvent({
        level: "info",
        scope: "crm.convert_lead",
        action: "auth_invite_deferred",
        message: "Auth invitation deferred to pending state",
        metadata: { code: inviteErr.code, status: inviteErr.status, message: inviteErr.message },
        throttleKey: `crm.invite_deferred.${inviteErr.code || "smtp"}`,
      });
      onboardingStatus = "smtp_pending";
    }
  } catch (err) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "crm.convert_lead",
      action: "auth_invite_error",
      message: "Auth invitation dispatch error handled gracefully",
      metadata: err,
      throttleKey: "crm.invite_error",
    });
    onboardingStatus = "smtp_pending";
  }

  // 7. Immutable audit trail
  try {
    await adminClient.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "lead.converted_to_client",
      target_type: "platform_sales_leads",
      target_id: lead.id,
      details: {
        organization_id: newOrg.id,
        organization_name: newOrg.name,
        project_id: newProject?.id || null,
        project_name: newProject?.name || null,
        client_email: lead.email,
        onboarding_status: onboardingStatus,
      },
    });
  } catch (auditErr) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "crm.convert_lead",
      action: "audit_warning",
      message: "Failed to write lead conversion audit event",
      metadata: auditErr,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/notifications");

  await dispatchPlatformStaffNotifications({
    title: `Lead Converted to Client: ${newOrg.name}`,
    message: `Organization "${newOrg.name}" and handover project initialized (${onboardingStatus === "invited" ? "Auth invite sent" : "SMTP pending manual invite"}).`,
    type: "system",
    linkUrl: `/admin/clients?id=${newOrg.id}`,
    dedupeWindowMinutes: 5,
  });

  const noticeParam = onboardingStatus === "smtp_pending" ? "&notice=smtp_pending" : "";
  redirect(`/admin/clients?id=${newOrg.id}&converted=1${noticeParam}`);
}

const onboardMemberSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().trim().email().max(320),
  role: z.enum(["client_owner", "client_manager", "client_collaborator", "client_viewer"]).default("client_owner"),
});

export async function onboardOrganizationMemberAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["clients"]);
  if (!canManage(roles)) redirect("/access-denied");

  const parsed = onboardMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/clients?id=${formData.get("organization_id")}&error=invalid`);

  const adminClient = createAdminClient();

  let onboardingStatus = "smtp_pending";
  try {
    const appBase = resolveAppOrigin() ?? new URL("https://thecodexthrill.com");
    const redirectTo = invitationRedirectTo(appBase);
    const { data: invitedData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      parsed.data.email,
      { redirectTo },
    );
    if (!inviteErr) {
      onboardingStatus = "invited";
      if (invitedData?.user?.id) {
        await provisionClientOrganizationMember({
          adminClient,
          organizationId: parsed.data.organization_id,
          invitedUserId: invitedData.user.id,
          email: parsed.data.email,
          role: parsed.data.role,
          actorUserId: user.id,
        });
      }
    }
  } catch (err) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "crm.onboard_member",
      action: "auth_invite_error",
      message: "Auth member invitation dispatch error",
      metadata: err,
      throttleKey: "crm.onboard_member.invite_error",
    });
    onboardingStatus = "smtp_pending";
  }

  try {
    await adminClient.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "organization.member_invited",
      target_type: "organizations",
      target_id: parsed.data.organization_id,
      details: {
        email: parsed.data.email,
        role: parsed.data.role,
        onboarding_status: onboardingStatus,
      },
    });
  } catch (err) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "crm.onboard_member",
      action: "audit_warning",
      message: "Failed to write organization member invite audit event",
      metadata: err,
    });
  }

  await dispatchPlatformStaffNotifications({
    title: `Client Portal Invitation: ${parsed.data.email}`,
    message: `Invitation for ${parsed.data.email} (${parsed.data.role.replace("_", " ")}) recorded with status: ${onboardingStatus === "invited" ? "accepted by Auth SMTP" : "pending custom SMTP"}.`,
    type: "system",
    linkUrl: `/admin/clients?id=${parsed.data.organization_id}`,
    dedupeWindowMinutes: 5,
  });

  revalidatePath("/admin/clients");
  revalidatePath("/admin/notifications");
  const noticeParam = onboardingStatus === "smtp_pending" ? "&notice=smtp_pending" : "";
  redirect(`/admin/clients?id=${parsed.data.organization_id}&invited=1${noticeParam}`);
}

