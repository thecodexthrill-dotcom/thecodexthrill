"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/supabase/access";

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

