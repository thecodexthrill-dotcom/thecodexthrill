"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";

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
  organization_id: z.string().uuid(),
  status: z.enum(["planning", "in_progress", "in_review", "completed", "on_hold"]),
  progress_pct: z.coerce.number().min(0).max(100).default(0),
  target_date: z.string().optional().or(z.literal("")),
});

export async function createProjectAction(formData: FormData) {
  const { user } = await requireWorkspace("admin", ["projects"]);
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/admin/projects?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_projects").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    description: parsed.data.description,
    status: parsed.data.status,
    progress_pct: parsed.data.progress_pct,
    target_date: parsed.data.target_date ? parsed.data.target_date : null,
    created_by: user.id,
  });

  if (error) {
    redirect("/admin/projects?error=save");
  }

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  redirect("/admin/projects?created=1");
}

export async function updateProjectAction(formData: FormData) {
  await requireWorkspace("admin", ["projects"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));

  if (!id.success || !parsed.success) {
    redirect("/admin/projects?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_projects")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
      progress_pct: parsed.data.progress_pct,
      target_date: parsed.data.target_date ? parsed.data.target_date : null,
    })
    .eq("id", id.data);

  if (error) {
    redirect("/admin/projects?error=save");
  }

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
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
  redirect("/admin/projects?deleted=1");
}


const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().default(""),
  project_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional().or(z.literal("")),
});

export async function createTaskAction(formData: FormData) {
  const returnPath = formData.get("return_path") === "portal" ? "/portal/tasks" : "/admin/tasks";
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

  const effectiveOrgId = project?.organization_id || parsed.data.organization_id;

  const { error } = await supabase.from("tenant_tasks").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    project_id: parsed.data.project_id,
    organization_id: effectiveOrgId,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
  });

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  redirect(`${returnPath}?created=1`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const taskId = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["todo", "in_progress", "review", "done"]).safeParse(formData.get("status"));
  const returnPath = formData.get("return_path") === "portal" ? "/portal/tasks" : "/admin/tasks";

  if (!taskId.success || !status.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_tasks")
    .update({ status: status.data })
    .eq("id", taskId.data);

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  redirect(`${returnPath}?updated=1`);
}

export async function updateTaskAction(formData: FormData) {
  const taskId = z.string().uuid().safeParse(formData.get("id"));
  const returnPath = formData.get("return_path") === "portal" ? "/portal/tasks" : "/admin/tasks";

  const parsed = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().default(""),
    status: z.enum(["todo", "in_progress", "review", "done"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    due_date: z.string().optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));

  if (!taskId.success || !parsed.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date ? parsed.data.due_date : null,
    })
    .eq("id", taskId.data);

  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  redirect(`${returnPath}?updated=1`);
}

export async function deleteTaskAction(formData: FormData) {
  const taskId = z.string().uuid().safeParse(formData.get("id"));
  const returnPath = formData.get("return_path") === "portal" ? "/portal/tasks" : "/admin/tasks";

  if (!taskId.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_tasks").delete().eq("id", taskId.data);
  if (error) {
    redirect(`${returnPath}?error=save`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/tasks");
  redirect(`${returnPath}?deleted=1`);
}


// ============================================================================
// 3. Shared Documents
// ============================================================================

const documentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  file_url: z.string().trim().min(1),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(["contract", "deliverable", "invoice", "asset", "specification", "other"]),
});

export async function createDocumentRecordAction(formData: FormData) {
  const rawProjectId = formData.get("project_id");
  const projectId = typeof rawProjectId === "string" && rawProjectId.trim() ? rawProjectId.trim() : undefined;
  const returnPath = formData.get("return_path") === "portal" ? "/portal/files" : "/admin/files";

  const organizationId = z.string().uuid().safeParse(formData.get("organization_id"));
  const name = z.string().trim().min(1).max(255).safeParse(formData.get("name"));
  const category = z.enum(["contract", "deliverable", "invoice", "asset", "specification", "other"]).safeParse(formData.get("category"));

  if (!organizationId.success || !name.success || !category.success) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  revalidatePath("/admin/files");
  revalidatePath("/portal/files");
  redirect(`${returnPath}?created=1`);
}

export async function deleteDocumentAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const returnPath = formData.get("return_path") === "portal" ? "/portal/files" : "/admin/files";

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
  redirect(`${returnPath}?deleted=1`);
}

// ============================================================================
// 4. Invoices / Billing
// ============================================================================

const invoiceSchema = z.object({
  organization_id: z.string().uuid(),
  invoice_number: z.string().trim().min(3).max(64),
  amount_dollars: z.coerce.number().min(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().default(""),
});

export async function createInvoiceAction(formData: FormData) {
  const { roles } = await requireWorkspace("admin", ["billing"]);
  const canManage = roles.some((r) => r === "super_admin" || r === "platform_admin");
  if (!canManage) redirect("/access-denied");

  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/admin/billing?error=invalid");
  }

  const supabase = await createClient();
  const amountCents = Math.round(parsed.data.amount_dollars * 100);

  const { error } = await supabase.from("tenant_invoices").insert({
    organization_id: parsed.data.organization_id,
    invoice_number: parsed.data.invoice_number,
    amount_cents: amountCents,
    currency: parsed.data.currency,
    status: parsed.data.status,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
    notes: parsed.data.notes || null,
    items: [{ description: "Professional Software Engineering Services", amount_cents: amountCents }],
  });

  if (error) {
    redirect("/admin/billing?error=save");
  }

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
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
  const updateData: Record<string, unknown> = { status: status.data };
  if (status.data === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { error } = await supabase.from("tenant_invoices").update(updateData).eq("id", id.data);
  if (error) {
    redirect("/admin/billing?error=save");
  }

  revalidatePath("/admin/billing");
  revalidatePath("/portal/invoices");
  redirect("/admin/billing?updated=1");
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


