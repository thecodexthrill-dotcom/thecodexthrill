"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";
import { extractLeadService } from "@/lib/supabase/lead-service-helper";

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
  const { error } = await supabase.from("organizations").insert({ name: parsed.data.name, created_by: user.id });
  if (error) redirect("/admin/clients?error=save");
  revalidatePath("/admin/clients");
  redirect("/admin/clients?created=1");
}

export async function updateOrganizationAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["clients"]);
  if (!canManage(roles)) redirect("/access-denied");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const name = organizationSchema.shape.name.safeParse(formData.get("name"));
  const status = organizationStatusSchema.safeParse(formData.get("status"));
  if (!id.success || !name.success || !status.success) redirect("/admin/clients?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({
    name: name.data,
    status: status.data,
    deleted_at: status.data === "deleted" ? new Date().toISOString() : null,
  }).eq("id", id.data);
  if (error) redirect("/admin/clients?error=save");
  revalidatePath("/admin/clients");
  redirect("/admin/clients?updated=1");
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
    console.error("[convertLead] Failed to create organization", orgErr);
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
    console.warn("[convertLead] Handover project warning", projectErr);
  }

  // 5. Advance lead stage to 'converted'
  await supabase
    .from("platform_sales_leads")
    .update({ stage: "converted" })
    .eq("id", lead.id);

  // 6. Supabase Auth client portal invitation
  let onboardingStatus = "smtp_pending";
  try {
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      lead.email,
      { redirectTo: "https://thecodexthrill.com/auth/callback?type=invite" },
    );
    if (!inviteErr) {
      onboardingStatus = "invited";
    } else {
      console.warn("[convertLead] Auth invitation status:", inviteErr.message || inviteErr);
      onboardingStatus = "smtp_pending";
    }
  } catch (err) {
    console.warn("[convertLead] SMTP dispatch error handled gracefully:", err);
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
    console.warn("[convertLead] Audit trail warning:", auditErr);
  }

  revalidatePath("/admin/leads");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/projects");

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
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      parsed.data.email,
      { redirectTo: "https://thecodexthrill.com/auth/callback?type=invite" },
    );
    if (!inviteErr) {
      onboardingStatus = "invited";
    }
  } catch (err) {
    console.warn("[onboardMember] SMTP dispatch error:", err);
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
    console.warn("[onboardMember] Audit log warning:", err);
  }

  revalidatePath("/admin/clients");
  const noticeParam = onboardingStatus === "smtp_pending" ? "&notice=smtp_pending" : "";
  redirect(`/admin/clients?id=${parsed.data.organization_id}&invited=1${noticeParam}`);
}

