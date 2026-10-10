import "server-only";
import { createAdminClient } from "./admin";
import {
  type AutomationReminderCandidate,
  evaluateInvoiceDueReminders,
  evaluateLeadFollowUpReminders,
  evaluatePendingInvitationReminders,
  evaluateSupportTicketAttentionReminders,
  evaluateTaskDeadlineReminders,
} from "./notification-helper";
import {
  type NotificationDispatchOutcome,
  dispatchOrganizationClientNotifications,
  dispatchPlatformStaffNotifications,
  dispatchUserNotification,
} from "./notification-service";

export type WorkflowAutomationSweepSummary = {
  executedAt: string;
  triggeredBy: "cron_endpoint" | "admin_manual";
  actorUserId?: string | null;
  evaluatedCounts: {
    leadsChecked: number;
    tasksChecked: number;
    invoicesChecked: number;
    ticketsChecked: number;
    invitationsChecked: number;
    totalCandidates: number;
  };
  dispatchSummary: {
    inserted: number;
    duplicatesSuppressed: number;
    skippedByPreference: number;
    errors: number;
  };
};

async function dispatchCandidate(
  candidate: AutomationReminderCandidate,
): Promise<NotificationDispatchOutcome[]> {
  const dedupeWindowMinutes = 24 * 60; // 24h idempotent window for daily/scheduled reminders

  if (candidate.recipientScope === "specific_user" && candidate.userId) {
    const outcome = await dispatchUserNotification({
      userId: candidate.userId,
      title: candidate.title,
      message: candidate.message,
      type: candidate.type,
      linkUrl: candidate.linkUrl,
      recipientWorkspace: candidate.linkUrl.startsWith("/admin")
        ? "admin"
        : "portal",
      dedupeWindowMinutes,
      eventKey: candidate.eventKey,
    });
    return [outcome];
  }

  if (candidate.recipientScope === "org_clients" && candidate.organizationId) {
    return dispatchOrganizationClientNotifications({
      organizationId: candidate.organizationId,
      title: candidate.title,
      message: candidate.message,
      type: candidate.type,
      linkUrl: candidate.linkUrl,
      dedupeWindowMinutes,
      eventKey: candidate.eventKey,
    });
  }

  if (candidate.recipientScope === "support_staff") {
    return dispatchPlatformStaffNotifications({
      title: candidate.title,
      message: candidate.message,
      type: candidate.type,
      linkUrl: candidate.linkUrl,
      roles: [
        "super_admin",
        "platform_admin",
        "operations_admin",
        "support_admin",
      ],
      dedupeWindowMinutes,
      eventKey: candidate.eventKey,
    });
  }

  return dispatchPlatformStaffNotifications({
    title: candidate.title,
    message: candidate.message,
    type: candidate.type,
    linkUrl: candidate.linkUrl,
    roles: ["super_admin", "platform_admin", "operations_admin"],
    dedupeWindowMinutes,
    eventKey: candidate.eventKey,
  });
}

export async function runWorkflowAutomationSweep(params?: {
  now?: Date;
  triggeredBy?: "cron_endpoint" | "admin_manual";
  actorUserId?: string | null;
}): Promise<WorkflowAutomationSweepSummary> {
  const now = params?.now ?? new Date();
  const triggeredBy = params?.triggeredBy ?? "cron_endpoint";
  const adminClient = createAdminClient();

  const [leadsRes, tasksRes, invoicesRes, ticketsRes, invitationsRes] =
    await Promise.all([
      adminClient
        .from("platform_sales_leads")
        .select("id, contact_name, company_name, stage, follow_up_at")
        .not("follow_up_at", "is", null)
        .not("stage", "in", '("converted","closed")')
        .order("follow_up_at", { ascending: true })
        .limit(50),
      adminClient
        .from("tenant_tasks")
        .select(
          "id, project_id, organization_id, title, status, priority, assigned_to, due_date",
        )
        .not("due_date", "is", null)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(50),
      adminClient
        .from("tenant_invoices")
        .select(
          "id, organization_id, invoice_number, amount_cents, status, due_date, paid_at, items",
        )
        .not("due_date", "is", null)
        .not("status", "in", '("paid","cancelled")')
        .order("due_date", { ascending: true })
        .limit(50),
      adminClient
        .from("support_tickets")
        .select(
          "id, ticket_number, title, status, priority, assigned_to, created_at",
        )
        .in("status", ["new", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient
        .from("platform_invitations")
        .select("id, email, role, status, expires_at, archived_at")
        .eq("status", "pending")
        .is("archived_at", null)
        .limit(50),
    ]);

  const leads = leadsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const tickets = ticketsRes.data ?? [];
  const invitations = invitationsRes.data ?? [];

  const candidates: AutomationReminderCandidate[] = [
    ...evaluateLeadFollowUpReminders(leads, now),
    ...evaluateTaskDeadlineReminders(tasks, now),
    ...evaluateInvoiceDueReminders(invoices, now),
    ...evaluateSupportTicketAttentionReminders(tickets, now),
    ...evaluatePendingInvitationReminders(invitations, now),
  ];

  let inserted = 0;
  let duplicatesSuppressed = 0;
  let skippedByPreference = 0;
  let errors = 0;

  for (const candidate of candidates) {
    const outcomes = await dispatchCandidate(candidate);
    for (const outcome of outcomes) {
      if (outcome.inserted) {
        inserted += 1;
      } else if (outcome.suppressedReason === "duplicate_in_window") {
        duplicatesSuppressed += 1;
      } else if (outcome.suppressedReason === "disabled_by_preference") {
        skippedByPreference += 1;
      } else if (outcome.suppressedReason === "insert_error") {
        errors += 1;
      }
    }
  }

  const summary: WorkflowAutomationSweepSummary = {
    executedAt: now.toISOString(),
    triggeredBy,
    actorUserId: params?.actorUserId ?? null,
    evaluatedCounts: {
      leadsChecked: leads.length,
      tasksChecked: tasks.length,
      invoicesChecked: invoices.length,
      ticketsChecked: tickets.length,
      invitationsChecked: invitations.length,
      totalCandidates: candidates.length,
    },
    dispatchSummary: {
      inserted,
      duplicatesSuppressed,
      skippedByPreference,
      errors,
    },
  };

  try {
    await adminClient.from("audit_events").insert({
      actor_user_id: params?.actorUserId ?? null,
      scope: "platform",
      action: "workflow.automation_sweep",
      target_type: "workflow_automation",
      target_id: summary.executedAt.slice(0, 10),
      details: summary,
    });
  } catch {
    // Non-fatal if audit log write fails
  }

  return summary;
}

