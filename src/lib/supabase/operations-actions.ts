"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";
import {
  calculateProjectTaskProgress,
  formatDeliveryDescription,
  parseDeliveryDescription,
  parseInvoiceItems,
  type InvoiceLineItem,
  type InvoicePaymentRecord,
} from "@/lib/supabase/delivery-operations-helper";

async function syncProjectTaskProgress(projectId: string) {
  try {
    const adminSupabase = createAdminClient();
    const { data: tasks } = await adminSupabase
      .from("tenant_tasks")
      .select("status")
      .eq("project_id", projectId);

    if (!tasks || tasks.length === 0) return;

    const summary = calculateProjectTaskProgress(tasks);
    await adminSupabase
      .from("tenant_projects")
      .update({
        progress_pct: summary.computedProgressPct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  } catch {
    // Non-blocking progress sync
  }
}

async function notifyOrganizationClients(params: {
  organizationId: string;
  excludeUserId: string;
  title: string;
  message: string;
  type: "project" | "billing" | "system" | "security";
  linkUrl: string;
}) {
  try {
    const adminSupabase = createAdminClient();
    const { data: members } = await adminSupabase
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", params.organizationId)
      .eq("status", "active");

    if (!members || members.length === 0) return;

    const rows = members
      .filter((m) => m.user_id && m.user_id !== params.excludeUserId)
      .map((m) => ({
        user_id: m.user_id,
        title: params.title,
        message: params.message.slice(0, 240),
        type: params.type,
        link_url: params.linkUrl,
        is_read: false,
      }));

    if (rows.length > 0) {
      await adminSupabase.from("user_notifications").insert(rows);
    }
  } catch {
    // Notification dispatch is non-blocking
  }
}

// ============================================================================
// 1. Support Tickets
// ============================================================================

const createTicketSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["technical", "billing", "feature_request", "general"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  message: z.string().trim().min(2).max(10000),
  organization_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createSupportTicketAction(formData: FormData) {
  const returnParam = formData.get("return_path");
  const isAdmin = returnParam === "admin";
  const { user } = await requireWorkspace(isAdmin ? "admin" : "portal", ["support"]);
  const returnPath = isAdmin ? "/admin/support" : "/portal/support";

  const rawOrgId = formData.get("organization_id");
  const organizationId = typeof rawOrgId === "string" && rawOrgId.trim() ? rawOrgId.trim() : undefined;

  const parsed = createTicketSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    message: formData.get("message"),
    organization_id: organizationId,
  });

  if (!parsed.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();

  // Generate readable ticket number
  const ticketNumber = `TICK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      ticket_number: ticketNumber,
      organization_id: parsed.data.organization_id || null,
      customer_id: user.id,
      title: parsed.data.title,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: "new",
    })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    redirect(`${returnPath}?error=save`);
  }

  // Create initial message in the ticket thread
  await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    is_staff: isAdmin,
    message: parsed.data.message,
  });

  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  redirect(`${returnPath}?created=1`);
}

export async function addTicketMessageAction(formData: FormData) {
  const ticketId = z.string().uuid().safeParse(formData.get("ticket_id"));
  const message = z.string().trim().min(1).max(10000).safeParse(formData.get("message"));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Zero-trust verification of staff status from platform roles
  const [platformRoles, superAdmin] = await Promise.all([
    supabase
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null),
    supabase
      .from("platform_super_admin_designation")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isStaff = Boolean(
    superAdmin.data ||
    platformRoles.data?.some((r) =>
      ["super_admin", "platform_admin", "developer", "support_staff"].includes(r.role)
    )
  );

  const requestedReturnPath = formData.get("return_path");
  const returnPath = isStaff && requestedReturnPath === "admin"
    ? "/admin/support"
    : (isStaff ? "/admin/support" : "/portal/support");

  if (!ticketId.success || !message.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId.data,
    sender_id: user.id,
    is_staff: isStaff,
    message: message.data,
  });

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  // Automatic ticket lifecycle transition
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("status, ticket_number, customer_id, assigned_to")
    .eq("id", ticketId.data)
    .single();

  if (ticket && ticket.status !== "closed") {
    let nextStatus: string | null = null;
    if (isStaff && ticket.status !== "waiting_on_client") {
      nextStatus = "waiting_on_client";
    } else if (!isStaff && (ticket.status === "waiting_on_client" || ticket.status === "resolved")) {
      nextStatus = "in_progress";
    }

    if (nextStatus) {
      await supabase
        .from("support_tickets")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId.data);
    }

    // Dispatch real in-app notification to the counterparty
    try {
      const adminSupabase = createAdminClient();
      if (isStaff && ticket.customer_id && ticket.customer_id !== user.id) {
        await adminSupabase.from("user_notifications").insert({
          user_id: ticket.customer_id,
          title: `Response on Support Ticket #${ticket.ticket_number}`,
          message: message.data.slice(0, 200),
          type: "ticket",
          link_url: "/portal/support",
          is_read: false,
        });
      } else if (!isStaff && ticket.assigned_to && ticket.assigned_to !== user.id) {
        await adminSupabase.from("user_notifications").insert({
          user_id: ticket.assigned_to,
          title: `Client update on Support Ticket #${ticket.ticket_number}`,
          message: message.data.slice(0, 200),
          type: "ticket",
          link_url: "/admin/support",
          is_read: false,
        });
      }
    } catch {
      // Notification dispatch is non-blocking to core thread reply
    }
  }

  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  revalidatePath("/portal/notifications");
  revalidatePath("/admin/notifications");
  redirect(`${returnPath}?message_sent=1`);
}

export async function updateTicketStatusAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["support"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin" || r === "support_staff");
  if (!canManage) redirect("/access-denied");

  const ticketId = z.string().uuid().safeParse(formData.get("ticket_id"));
  const status = z.enum(["new", "in_progress", "waiting_on_client", "resolved", "closed"]).safeParse(formData.get("status"));
  const priority = z.enum(["low", "medium", "high", "urgent"]).safeParse(formData.get("priority"));

  if (!ticketId.success || !status.success) {
    redirect("/admin/support?error=invalid");
  }

  const supabase = await createClient();
  const updateData: Record<string, unknown> = {
    status: status.data,
    updated_at: new Date().toISOString(),
  };

  if (priority.success) {
    updateData.priority = priority.data;
  }

  if (status.data === "resolved" || status.data === "closed") {
    updateData.resolved_at = new Date().toISOString();
  } else {
    updateData.resolved_at = null;
  }

  const { error } = await supabase
    .from("support_tickets")
    .update(updateData)
    .eq("id", ticketId.data);

  if (error) {
    redirect("/admin/support?error=save");
  }

  revalidatePath("/admin/support");
  revalidatePath("/portal/support");
  redirect("/admin/support?updated=1");
}

// ============================================================================
// 2. Tenant Projects & Tasks
// ============================================================================

const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().default(""),
  milestone: z.string().default(""),
  handover_checklist: z.string().default(""),
  internal_notes: z.string().default(""),
  has_structured_fields: z.string().optional(),
  organization_id: z.string().uuid(),
  status: z.enum(["planning", "in_progress", "in_review", "completed", "on_hold"]),
  progress_pct: z.coerce.number().min(0).max(100).default(0),
  start_date: z.string().optional().or(z.literal("")),
  target_date: z.string().optional().or(z.literal("")),
});

export async function createProjectAction(formData: FormData) {
  const { user } = await requireWorkspace("admin", ["projects"]);
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/admin/projects?error=invalid");
  }

  const parsedDesc = parseDeliveryDescription(parsed.data.description);
  const formattedDescription = formatDeliveryDescription({
    milestone: parsed.data.milestone || parsedDesc.milestone,
    clientDescription: parsedDesc.clientDescription,
    handoverChecklist: parsed.data.handover_checklist || parsedDesc.handoverChecklist,
    internalNotes: parsed.data.internal_notes || parsedDesc.internalNotes,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_projects").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    description: formattedDescription,
    status: parsed.data.status,
    progress_pct: parsed.data.progress_pct,
    start_date: parsed.data.start_date ? parsed.data.start_date : null,
    target_date: parsed.data.target_date ? parsed.data.target_date : null,
    created_by: user.id,
  });

  if (error) {
    redirect("/admin/projects?error=save");
  }

  await notifyOrganizationClients({
    organizationId: parsed.data.organization_id,
    excludeUserId: user.id,
    title: `New Project Initialized: ${parsed.data.name}`,
    message: parsedDesc.clientDescription || `Project "${parsed.data.name}" is now active in your client portal.`,
    type: "project",
    linkUrl: "/portal/projects",
  });

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect("/admin/projects?created=1");
}

export async function updateProjectAction(formData: FormData) {
  const { user } = await requireWorkspace("admin", ["projects"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));

  if (!id.success || !parsed.success) {
    redirect("/admin/projects?error=invalid");
  }

  const parsedDesc = parseDeliveryDescription(parsed.data.description);
  const isStructured = parsed.data.has_structured_fields === "1";

  const formattedDescription = formatDeliveryDescription({
    milestone: isStructured ? parsed.data.milestone : (parsed.data.milestone || parsedDesc.milestone),
    clientDescription: parsedDesc.clientDescription,
    handoverChecklist: isStructured
      ? parsed.data.handover_checklist
      : (parsed.data.handover_checklist || parsedDesc.handoverChecklist),
    internalNotes: isStructured
      ? parsed.data.internal_notes
      : (parsed.data.internal_notes || parsedDesc.internalNotes),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_projects")
    .update({
      name: parsed.data.name,
      description: formattedDescription,
      status: parsed.data.status,
      progress_pct: parsed.data.progress_pct,
      start_date: parsed.data.start_date ? parsed.data.start_date : null,
      target_date: parsed.data.target_date ? parsed.data.target_date : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data);

  if (error) {
    redirect("/admin/projects?error=save");
  }

  if (parsed.data.status === "completed" || parsed.data.status === "in_review") {
    await notifyOrganizationClients({
      organizationId: parsed.data.organization_id,
      excludeUserId: user.id,
      title:
        parsed.data.status === "completed"
          ? `Project Delivered: ${parsed.data.name}`
          : `Project Ready for Client Review: ${parsed.data.name}`,
      message:
        parsed.data.handover_checklist ||
        parsedDesc.clientDescription ||
        `Status updated to ${parsed.data.status.replace("_", " ")} (${parsed.data.progress_pct}%).`,
      type: "project",
      linkUrl: "/portal/projects",
    });
  }

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect("/admin/projects?updated=1");
}

export async function deleteProjectAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["projects"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin" || r === "developer");
  if (!canManage) redirect("/access-denied");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) {
    redirect("/admin/projects?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_projects").delete().eq("id", id.data);
  if (error) {
    redirect("/admin/projects?error=save");
  }

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect("/admin/projects?deleted=1");
}


const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().default(""),
  milestone: z.string().default(""),
  internal_notes: z.string().default(""),
  has_structured_fields: z.string().optional(),
  project_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
});

export async function createTaskAction(formData: FormData) {
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/tasks" : "/admin/tasks";
  const { roles } = await requireWorkspace(isPortal ? "portal" : "admin", ["tasks"]);
  const isStaff = !isPortal && roles.some((r) =>
    ["super_admin", "platform_admin", "developer", "support_staff"].includes(r)
  );

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("tenant_projects")
    .select("organization_id")
    .eq("id", parsed.data.project_id)
    .single();

  if (!project) {
    redirect(`${returnPath}?error=invalid`);
  }

  const parsedDesc = parseDeliveryDescription(parsed.data.description);
  const formattedDescription = formatDeliveryDescription({
    milestone: parsed.data.milestone || parsedDesc.milestone,
    clientDescription: parsedDesc.clientDescription,
    internalNotes: isStaff ? (parsed.data.internal_notes || parsedDesc.internalNotes) : null,
  });

  const { error } = await supabase.from("tenant_tasks").insert({
    title: parsed.data.title,
    description: formattedDescription,
    project_id: parsed.data.project_id,
    organization_id: project.organization_id,
    status: parsed.data.status,
    priority: parsed.data.priority,
    assigned_to: isStaff && parsed.data.assigned_to ? parsed.data.assigned_to : null,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
  });

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  await syncProjectTaskProgress(parsed.data.project_id);

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?created=1`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/tasks" : "/admin/tasks";
  await requireWorkspace(isPortal ? "portal" : "admin", ["tasks"]);

  const taskId = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["todo", "in_progress", "review", "done"]).safeParse(formData.get("status"));

  if (!taskId.success || !status.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: existingTask } = await supabase
    .from("tenant_tasks")
    .select("project_id")
    .eq("id", taskId.data)
    .single();

  const { error } = await supabase
    .from("tenant_tasks")
    .update({ status: status.data, updated_at: new Date().toISOString() })
    .eq("id", taskId.data);

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  if (existingTask?.project_id) {
    await syncProjectTaskProgress(existingTask.project_id);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?updated=1`);
}

export async function updateTaskAction(formData: FormData) {
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/tasks" : "/admin/tasks";
  const { roles } = await requireWorkspace(isPortal ? "portal" : "admin", ["tasks"]);
  const isStaff = !isPortal && roles.some((r) =>
    ["super_admin", "platform_admin", "developer", "support_staff"].includes(r)
  );

  const taskId = z.string().uuid().safeParse(formData.get("id"));

  const parsed = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().default(""),
    milestone: z.string().default(""),
    internal_notes: z.string().default(""),
    has_structured_fields: z.string().optional(),
    status: z.enum(["todo", "in_progress", "review", "done"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    assigned_to: z.string().uuid().optional().or(z.literal("")),
    due_date: z.string().optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));

  if (!taskId.success || !parsed.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: existingTask } = await supabase
    .from("tenant_tasks")
    .select("project_id, description, assigned_to")
    .eq("id", taskId.data)
    .single();

  if (!existingTask) {
    redirect(`${returnPath}?error=invalid`);
  }

  const existingParsed = parseDeliveryDescription(existingTask.description);
  const inputParsed = parseDeliveryDescription(parsed.data.description);
  const isStructured = parsed.data.has_structured_fields === "1";

  const formattedDescription = formatDeliveryDescription({
    milestone: isStructured
      ? parsed.data.milestone
      : (parsed.data.milestone || inputParsed.milestone || existingParsed.milestone),
    clientDescription: inputParsed.clientDescription,
    // Client portal edits NEVER overwrite or clear internal staff notes
    internalNotes: isStaff
      ? (isStructured ? parsed.data.internal_notes : (parsed.data.internal_notes || inputParsed.internalNotes))
      : existingParsed.internalNotes,
  });

  const updatePayload: Record<string, unknown> = {
    title: parsed.data.title,
    description: formattedDescription,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
    updated_at: new Date().toISOString(),
  };

  if (isStaff && formData.has("assigned_to")) {
    updatePayload.assigned_to = parsed.data.assigned_to ? parsed.data.assigned_to : null;
  }

  const { error } = await supabase
    .from("tenant_tasks")
    .update(updatePayload)
    .eq("id", taskId.data);

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  if (existingTask.project_id) {
    await syncProjectTaskProgress(existingTask.project_id);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?updated=1`);
}

export async function deleteTaskAction(formData: FormData) {
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/tasks" : "/admin/tasks";
  await requireWorkspace(isPortal ? "portal" : "admin", ["tasks"]);

  const taskId = z.string().uuid().safeParse(formData.get("id"));

  if (!taskId.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: existingTask } = await supabase
    .from("tenant_tasks")
    .select("project_id")
    .eq("id", taskId.data)
    .single();

  const { error } = await supabase.from("tenant_tasks").delete().eq("id", taskId.data);
  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  if (existingTask?.project_id) {
    await syncProjectTaskProgress(existingTask.project_id);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?deleted=1`);
}


// ============================================================================
// 3. Shared Documents & Deliverables
// ============================================================================

export async function createDocumentRecordAction(formData: FormData) {
  const rawProjectId = formData.get("project_id");
  const projectId =
    typeof rawProjectId === "string" && z.string().uuid().safeParse(rawProjectId.trim()).success
      ? rawProjectId.trim()
      : undefined;
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/files" : "/admin/files";

  const { user } = await requireWorkspace(isPortal ? "portal" : "admin", ["files"]);

  const organizationId = z.string().uuid().safeParse(formData.get("organization_id"));
  const name = z.string().trim().min(1).max(255).safeParse(formData.get("name"));
  const category = z
    .enum(["contract", "deliverable", "invoice", "asset", "specification", "other"])
    .safeParse(formData.get("category"));

  if (!organizationId.success || !name.success || !category.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();

  const file = formData.get("file");
  let fileUrl = (formData.get("file_url") as string)?.trim() || "";
  let fileSizeBytes = 0;
  let fileType = "application/octet-stream";

  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    const uploadedFile = file as File;
    const adminSupabase = createAdminClient();
    const sanitizedFileName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${organizationId.data}/${Date.now()}-${sanitizedFileName}`;
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await adminSupabase.storage
      .from("tenant-documents")
      .upload(storagePath, buffer, {
        contentType: uploadedFile.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      redirect(`${returnPath}?error=save`);
    }

    const { data: signedData } = await adminSupabase.storage
      .from("tenant-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days signed URL

    fileUrl = signedData?.signedUrl || storagePath;
    fileSizeBytes = uploadedFile.size;
    fileType = uploadedFile.type || "application/octet-stream";
  } else if (!fileUrl) {
    redirect(`${returnPath}?error=invalid`);
  }

  const { error } = await supabase.from("tenant_documents").insert({
    name: name.data,
    file_url: fileUrl,
    file_size_bytes: fileSizeBytes,
    file_type: fileType,
    organization_id: organizationId.data,
    project_id: projectId || null,
    category: category.data,
    uploaded_by: user.id,
  });

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  if (!isPortal) {
    await notifyOrganizationClients({
      organizationId: organizationId.data,
      excludeUserId: user.id,
      title:
        category.data === "deliverable"
          ? `New Project Deliverable Shared: ${name.data}`
          : `New ${category.data.toUpperCase()} Document Shared: ${name.data}`,
      message: `${name.data} is now available in your secure client portal.`,
      type: "project",
      linkUrl: "/portal/files",
    });
  }

  revalidatePath("/admin/files");
  revalidatePath("/portal/files");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?created=1`);
}

export async function deleteDocumentAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const isPortal = formData.get("return_path") === "portal";
  const returnPath = isPortal ? "/portal/files" : "/admin/files";

  await requireWorkspace(isPortal ? "portal" : "admin", ["files"]);

  if (!id.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("tenant_documents")
    .select("file_url")
    .eq("id", id.data)
    .single();

  const { error } = await supabase.from("tenant_documents").delete().eq("id", id.data);
  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  if (doc?.file_url?.includes("tenant-documents/")) {
    try {
      const adminClient = createAdminClient();
      const storagePath = doc.file_url.split("tenant-documents/")[1]?.split("?")[0];
      if (storagePath) {
        await adminClient.storage.from("tenant-documents").remove([storagePath]);
      }
    } catch {
      // Non-blocking cleanup
    }
  }

  revalidatePath("/admin/files");
  revalidatePath("/portal/files");
  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  revalidatePath("/portal");
  redirect(`${returnPath}?deleted=1`);
}

// ============================================================================
// 4. Invoices / Billing & Verified Payment Settlement
// ============================================================================

const invoiceSchema = z.object({
  organization_id: z.string().uuid(),
  project_id: z.string().uuid().optional().or(z.literal("")),
  invoice_number: z.string().trim().min(3).max(64),
  amount_dollars: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().default(""),
});

export async function createInvoiceAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["billing"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/admin/billing?error=invalid");
  }

  // Never allow creating an invoice directly as 'paid' without a verified payment record
  if (parsed.data.status === "paid") {
    redirect("/admin/billing?error=payment_record_required");
  }

  const supabase = await createClient();

  let linkedProject: { id: string; name: string } | null = null;
  if (parsed.data.project_id) {
    const { data: projectRow } = await supabase
      .from("tenant_projects")
      .select("id, name, organization_id")
      .eq("id", parsed.data.project_id)
      .single();

    if (projectRow && projectRow.organization_id === parsed.data.organization_id) {
      linkedProject = { id: projectRow.id, name: projectRow.name };
    }
  }

  // Parse multi-line items if provided, otherwise use primary description + amount_dollars
  const rawDescriptions = formData.getAll("item_description").map((v) => String(v).trim());
  const rawAmounts = formData.getAll("item_amount").map((v) => Number(v));

  const lineItems: InvoiceLineItem[] = [];
  for (let i = 0; i < rawDescriptions.length; i++) {
    const desc = rawDescriptions[i];
    const amtDollars = rawAmounts[i];
    if (desc && Number.isFinite(amtDollars) && amtDollars > 0) {
      const itemCents = Math.round(amtDollars * 100);
      lineItems.push({
        kind: "line_item",
        description: desc,
        quantity: 1,
        unit_price_cents: itemCents,
        amount_cents: itemCents,
        project_id: linkedProject?.id ?? null,
        project_name: linkedProject?.name ?? null,
      });
    }
  }

  let totalAmountCents = Math.round(parsed.data.amount_dollars * 100);
  if (lineItems.length > 0) {
    totalAmountCents = lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  } else {
    if (totalAmountCents <= 0) {
      redirect("/admin/billing?error=invalid");
    }
    lineItems.push({
      kind: "line_item",
      description: linkedProject
        ? `${linkedProject.name} — Software Engineering & Delivery Services`
        : "Professional Software Engineering Services",
      quantity: 1,
      unit_price_cents: totalAmountCents,
      amount_cents: totalAmountCents,
      project_id: linkedProject?.id ?? null,
      project_name: linkedProject?.name ?? null,
    });
  }

  const { error } = await supabase.from("tenant_invoices").insert({
    organization_id: parsed.data.organization_id,
    invoice_number: parsed.data.invoice_number,
    amount_cents: totalAmountCents,
    currency: parsed.data.currency,
    status: parsed.data.status,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
    notes: parsed.data.notes || null,
    items: lineItems,
  });

  if (error) {
    redirect("/admin/billing?error=save");
  }

  if (parsed.data.status === "sent" || parsed.data.status === "overdue") {
    await notifyOrganizationClients({
      organizationId: parsed.data.organization_id,
      excludeUserId: user.id,
      title: `Invoice Issued: ${parsed.data.invoice_number}`,
      message: `Invoice ${parsed.data.invoice_number} for $${(totalAmountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} is available in your billing portal.`,
      type: "billing",
      linkUrl: "/portal/invoices",
    });
  }

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
  revalidatePath("/portal");
  redirect("/admin/billing?created=1");
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["billing"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).safeParse(formData.get("status"));

  if (!id.success || !status.success) {
    redirect("/admin/billing?error=invalid");
  }

  const supabase = await createClient();
  const { data: existingInvoice } = await supabase
    .from("tenant_invoices")
    .select("id, amount_cents, items")
    .eq("id", id.data)
    .single();

  if (!existingInvoice) {
    redirect("/admin/billing?error=invalid");
  }

  // Strictly enforce verified payment record before marking invoice as paid
  if (status.data === "paid") {
    const parsedItems = parseInvoiceItems(existingInvoice.items, existingInvoice.amount_cents);
    if (
      parsedItems.paymentRecords.length === 0 ||
      parsedItems.recordedPaidCents < existingInvoice.amount_cents
    ) {
      redirect("/admin/billing?error=payment_record_required");
    }
  }

  const updateData: Record<string, unknown> = {
    status: status.data,
    updated_at: new Date().toISOString(),
  };
  if (status.data === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { error } = await supabase.from("tenant_invoices").update(updateData).eq("id", id.data);
  if (error) {
    redirect("/admin/billing?error=save");
  }

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
  revalidatePath("/portal");
  redirect("/admin/billing?updated=1");
}

const recordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount_dollars: z.coerce.number().positive(),
  method: z.enum(["wire_transfer", "ach", "check", "manual_settlement"]),
  reference: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  confirmed: z.literal("yes"),
});

export async function recordInvoicePaymentAction(formData: FormData) {
  const { user, roles } = await requireWorkspace("admin", ["billing"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/admin/billing?error=invalid_payment");
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("tenant_invoices")
    .select("id, organization_id, invoice_number, amount_cents, currency, status, due_date, items")
    .eq("id", parsed.data.invoice_id)
    .single();

  if (!invoice || invoice.status === "cancelled") {
    redirect("/admin/billing?error=invalid_payment");
  }

  const parsedItems = parseInvoiceItems(invoice.items, invoice.amount_cents);
  const paymentCents = Math.round(parsed.data.amount_dollars * 100);
  const nowIso = new Date().toISOString();

  const paymentRecord: InvoicePaymentRecord = {
    kind: "payment_record",
    amount_cents: paymentCents,
    method: parsed.data.method,
    reference: parsed.data.reference,
    recorded_at: nowIso,
    recorded_by_email: user.email ?? user.id,
    notes: parsed.data.notes ? parsed.data.notes : undefined,
  };

  const newTotalPaidCents = parsedItems.recordedPaidCents + paymentCents;
  const isFullySettled = newTotalPaidCents >= invoice.amount_cents;

  const nextStatus = isFullySettled
    ? "paid"
    : invoice.status === "overdue"
      ? "overdue"
      : "sent";

  const updatedItems = [
    ...parsedItems.lineItems,
    ...parsedItems.paymentRecords,
    paymentRecord,
  ];

  const { error: updateErr } = await supabase
    .from("tenant_invoices")
    .update({
      items: updatedItems,
      status: nextStatus,
      paid_at: isFullySettled ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("id", invoice.id);

  if (updateErr) {
    redirect("/admin/billing?error=save");
  }

  // Write explicit audited payment confirmation event
  try {
    const adminSupabase = createAdminClient();
    await adminSupabase.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "invoice.payment_recorded",
      target_type: "tenant_invoices",
      target_id: invoice.id,
      details: {
        organization_id: invoice.organization_id,
        invoice_number: invoice.invoice_number,
        payment_cents: paymentCents,
        total_paid_cents: newTotalPaidCents,
        invoice_total_cents: invoice.amount_cents,
        method: parsed.data.method,
        reference: parsed.data.reference,
        resulting_status: nextStatus,
        confirmed_by_email: user.email ?? null,
      },
    });
  } catch {
    // Audit trigger on tenant_invoices also records the row update
  }

  await notifyOrganizationClients({
    organizationId: invoice.organization_id,
    excludeUserId: user.id,
    title: isFullySettled
      ? `Payment Settled: Invoice ${invoice.invoice_number}`
      : `Partial Payment Recorded: Invoice ${invoice.invoice_number}`,
    message: `Payment of $${(paymentCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${parsed.data.method.replace("_", " ").toUpperCase()} Ref: ${parsed.data.reference}) has been recorded.`,
    type: "billing",
    linkUrl: "/portal/invoices",
  });

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
  revalidatePath("/portal");
  revalidatePath("/admin");
  redirect("/admin/billing?payment_recorded=1");
}

export async function deleteInvoiceAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["billing"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) {
    redirect("/admin/billing?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_invoices").delete().eq("id", id.data);
  if (error) {
    redirect("/admin/billing?error=save");
  }

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
  revalidatePath("/portal");
  redirect("/admin/billing?deleted=1");
}

// ============================================================================
// 5. Notifications
// ============================================================================

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = z.string().uuid().safeParse(formData.get("id"));
  const returnPath = formData.get("return_path") === "portal" ? "/portal/notifications" : "/admin/notifications";

  if (!notificationId.success) {
    redirect(returnPath);
  }

  const supabase = await createClient();
  await supabase
    .from("user_notifications")
    .update({ is_read: true })
    .eq("id", notificationId.data);

  revalidatePath("/portal/notifications");
  revalidatePath("/admin/notifications");
  redirect(`${returnPath}?notice=read`);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const returnPath = formData.get("return_path") === "portal" ? "/portal/notifications" : "/admin/notifications";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("user_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  revalidatePath("/portal/notifications");
  revalidatePath("/admin/notifications");
  redirect(`${returnPath}?notice=all_read`);
}

// ============================================================================
// 6. Delete Support Ticket
// ============================================================================

export async function deleteTicketAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["support"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const id = z.string().uuid().safeParse(formData.get("ticket_id"));
  if (!id.success) {
    redirect("/admin/support?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").delete().eq("id", id.data);
  if (error) {
    redirect("/admin/support?error=save");
  }

  revalidatePath("/admin/support");
  revalidatePath("/portal/support");
  redirect("/admin/support?deleted=1");
}


