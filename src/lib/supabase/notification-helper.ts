import { createHash, timingSafeEqual } from "node:crypto";
import {
  classifyInvoiceLifecycleStatus,
  parseDeliveryDescription,
} from "./delivery-operations-helper.ts";

export type NotificationCategory =
  | "system"
  | "security"
  | "ticket"
  | "project"
  | "billing";

export type NotificationPreferences = {
  security: true; // Security & MFA alerts are mandatory and cannot be disabled
  system: boolean;
  project: boolean;
  billing: boolean;
  ticket: boolean;
  email_enabled: boolean;
  updated_at?: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  security: true,
  system: true,
  project: true,
  billing: true,
  ticket: true,
  email_enabled: true,
};

export function normalizeNotificationPreferences(
  raw?: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const obj = raw as Record<string, unknown>;
  return {
    security: true,
    system: typeof obj.system === "boolean" ? obj.system : true,
    project: typeof obj.project === "boolean" ? obj.project : true,
    billing: typeof obj.billing === "boolean" ? obj.billing : true,
    ticket: typeof obj.ticket === "boolean" ? obj.ticket : true,
    email_enabled:
      typeof obj.email_enabled === "boolean" ? obj.email_enabled : true,
    updated_at:
      typeof obj.updated_at === "string" ? obj.updated_at : undefined,
  };
}

export function isNotificationCategoryEnabled(
  prefs: NotificationPreferences,
  category: NotificationCategory,
): boolean {
  if (category === "security") return true;
  return Boolean(prefs[category]);
}

/**
 * Ensures notification links point only to valid internal routes for the target workspace.
 */
export function sanitizeNotificationLink(
  linkUrl: string | null | undefined,
  workspace: "admin" | "portal",
): string {
  const fallback =
    workspace === "admin" ? "/admin/notifications" : "/portal/notifications";
  if (!linkUrl || typeof linkUrl !== "string") return fallback;
  const trimmed = linkUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  if (workspace === "portal") {
    if (
      trimmed.startsWith("/portal") ||
      trimmed.startsWith("/account/security")
    ) {
      return trimmed;
    }
    return "/portal/notifications";
  }

  if (
    trimmed.startsWith("/admin") ||
    trimmed.startsWith("/portal") ||
    trimmed.startsWith("/account/security")
  ) {
    return trimmed;
  }
  return fallback;
}

/**
 * Strips internal staff notes, confidential delimiters, and excessive length
 * from notification titles and messages before persistence.
 */
export function sanitizeNotificationPayload(input: {
  title: string;
  message: string;
  type: NotificationCategory;
  linkUrl?: string | null;
  recipientWorkspace: "admin" | "portal";
}): {
  title: string;
  message: string;
  type: NotificationCategory;
  link_url: string;
} {
  const cleanTitle = input.title
    .replace(/---\[INTERNAL STAFF NOTES\]---[\s\S]*/gi, "")
    .replace(/\[Internal Note:[\s\S]*?\]/gi, "")
    .trim()
    .slice(0, 190);

  let rawMessage = input.message || "";
  if (input.recipientWorkspace === "portal") {
    const parsed = parseDeliveryDescription(rawMessage);
    rawMessage = parsed.clientDescription || rawMessage;
  }

  const cleanMessage = rawMessage
    .replace(/---\[INTERNAL STAFF NOTES\]---[\s\S]*/gi, "")
    .replace(/---\[DELIVERY HANDOVER\]---/gi, "Handover: ")
    .replace(/\[Internal Note:[\s\S]*?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 480);

  return {
    title: cleanTitle || "Workspace Notification",
    message: cleanMessage || "A workspace update is available.",
    type: input.type,
    link_url: sanitizeNotificationLink(
      input.linkUrl,
      input.recipientWorkspace,
    ),
  };
}

/**
 * Computes a deterministic deduplication signature for a notification event.
 */
export function buildNotificationDedupeSignature(params: {
  userId: string;
  type: NotificationCategory;
  title: string;
  eventKey?: string;
}): string {
  const normalized = [
    params.userId.trim().toLowerCase(),
    params.type,
    (params.eventKey || params.title).trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Checks whether an equivalent notification already exists within the deduplication window.
 */
export function isDuplicateNotificationInWindow(params: {
  existingNotifications: Array<{
    user_id: string;
    type: string;
    title: string;
    created_at: string;
  }>;
  userId: string;
  type: NotificationCategory;
  title: string;
  windowMinutes: number;
  now?: Date;
}): boolean {
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - params.windowMinutes * 60 * 1000;
  const targetTitle = params.title.trim().toLowerCase();

  return params.existingNotifications.some((n) => {
    if (n.user_id !== params.userId) return false;
    if (n.type !== params.type) return false;
    if (n.title.trim().toLowerCase() !== targetTitle) return false;
    const createdMs = new Date(n.created_at).getTime();
    return Number.isFinite(createdMs) && createdMs >= cutoffMs;
  });
}

/**
 * Constant-time verification of scheduler secret for cron/automation endpoints.
 */
export function verifySchedulerSecret(
  providedHeaderValue: string | null | undefined,
  configuredSecret: string | null | undefined,
): { authorized: boolean; reason: "ok" | "secret_not_configured" | "invalid_secret" } {
  const expected = configuredSecret?.trim() ?? "";
  if (Buffer.byteLength(expected, "utf8") < 16) {
    return { authorized: false, reason: "secret_not_configured" };
  }

  if (!providedHeaderValue || typeof providedHeaderValue !== "string") {
    return { authorized: false, reason: "invalid_secret" };
  }

  const rawProvided = providedHeaderValue.startsWith("Bearer ")
    ? providedHeaderValue.slice("Bearer ".length).trim()
    : providedHeaderValue.trim();

  if (!rawProvided) {
    return { authorized: false, reason: "invalid_secret" };
  }

  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const providedDigest = createHash("sha256").update(rawProvided, "utf8").digest();

  const matches =
    expectedDigest.length === providedDigest.length &&
    timingSafeEqual(expectedDigest, providedDigest) &&
    Buffer.byteLength(rawProvided, "utf8") === Buffer.byteLength(expected, "utf8");

  return matches
    ? { authorized: true, reason: "ok" }
    : { authorized: false, reason: "invalid_secret" };
}

// ============================================================================
// Transactional Email Pure Helpers
// ============================================================================

export type TransactionalEmailStatus =
  | "accepted_by_provider"
  | "unavailable"
  | "failed"
  | "skipped_by_preference"
  | "suppressed_duplicate";

export type TransactionalEmailConfigStatus = {
  configured: boolean;
  provider: "resend" | "webhook" | "unconfigured";
  fromAddress: string | null;
  reason?: string;
};

export function resolveTransactionalEmailConfig(
  env: Record<string, string | undefined>,
): TransactionalEmailConfigStatus {
  const fromAddress = env.TRANSACTIONAL_EMAIL_FROM?.trim() || null;
  const resendKey = env.RESEND_API_KEY?.trim() || "";
  const webhookUrl = env.TRANSACTIONAL_EMAIL_WEBHOOK_URL?.trim() || "";

  if (resendKey && fromAddress) {
    return {
      configured: true,
      provider: "resend",
      fromAddress,
    };
  }

  if (webhookUrl && fromAddress) {
    return {
      configured: true,
      provider: "webhook",
      fromAddress,
    };
  }

  return {
    configured: false,
    provider: "unconfigured",
    fromAddress,
    reason:
      "Transactional email provider is not configured (requires TRANSACTIONAL_EMAIL_FROM and RESEND_API_KEY or TRANSACTIONAL_EMAIL_WEBHOOK_URL; Supabase Auth SMTP is configured separately in Supabase Dashboard).",
  };
}

/**
 * Redacts tokens, API keys, email addresses, and sensitive fields from error metadata.
 */
export function sanitizeEmailErrorMetadata(error: unknown): {
  code: string;
  status?: number;
  summary: string;
} {
  if (!error || typeof error !== "object") {
    return { code: "unknown_error", summary: "Provider request failed." };
  }
  const obj = error as Record<string, unknown>;
  const rawCode = typeof obj.code === "string" ? obj.code : "provider_error";
  const safeCode = /^[a-z0-9_.-]{1,64}$/i.test(rawCode)
    ? rawCode
    : "provider_error";
  const status = typeof obj.status === "number" ? obj.status : undefined;

  const rawMessage =
    typeof obj.message === "string"
      ? obj.message
      : "Provider rejected transactional email request.";

  const redactedSummary = rawMessage
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/re_[A-Za-z0-9_]+/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .slice(0, 180);

  return {
    code: safeCode,
    status,
    summary: redactedSummary,
  };
}

// ============================================================================
// Workflow Automation Pure Evaluators
// ============================================================================

export type AutomationReminderCandidate = {
  eventKey: string;
  recipientScope: "platform_admins" | "support_staff" | "specific_user" | "org_clients";
  userId?: string;
  organizationId?: string;
  type: NotificationCategory;
  title: string;
  message: string;
  linkUrl: string;
};

export function evaluateLeadFollowUpReminders(
  leads: Array<{
    id: string;
    contact_name: string;
    company_name?: string | null;
    stage: string;
    follow_up_at: string | null;
  }>,
  now = new Date(),
): AutomationReminderCandidate[] {
  const nowMs = now.getTime();
  const upcomingWindowMs = nowMs + 24 * 60 * 60 * 1000;
  const dateBucket = now.toISOString().slice(0, 10);
  const candidates: AutomationReminderCandidate[] = [];

  for (const lead of leads) {
    if (!lead.follow_up_at) continue;
    if (lead.stage === "converted" || lead.stage === "closed") continue;
    const followUpMs = new Date(lead.follow_up_at).getTime();
    if (!Number.isFinite(followUpMs)) continue;

    const label = lead.company_name
      ? `${lead.contact_name} (${lead.company_name})`
      : lead.contact_name;

    if (followUpMs < nowMs) {
      candidates.push({
        eventKey: `lead.followup.overdue.${lead.id}.${dateBucket}`,
        recipientScope: "platform_admins",
        type: "system",
        title: `Overdue Lead Follow-up: ${lead.contact_name}`,
        message: `Scheduled follow-up for ${label} (stage: ${lead.stage}) is overdue (${lead.follow_up_at.slice(0, 10)}).`,
        linkUrl: `/admin/leads?id=${lead.id}`,
      });
    } else if (followUpMs <= upcomingWindowMs) {
      candidates.push({
        eventKey: `lead.followup.upcoming.${lead.id}.${dateBucket}`,
        recipientScope: "platform_admins",
        type: "system",
        title: `Upcoming Lead Follow-up: ${lead.contact_name}`,
        message: `Follow-up for ${label} is scheduled within 24 hours (${lead.follow_up_at.slice(0, 10)}).`,
        linkUrl: `/admin/leads?id=${lead.id}`,
      });
    }
  }

  return candidates;
}

export function evaluateTaskDeadlineReminders(
  tasks: Array<{
    id: string;
    project_id: string;
    organization_id: string;
    title: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    due_date: string | null;
  }>,
  now = new Date(),
): AutomationReminderCandidate[] {
  const todayStr = now.toISOString().slice(0, 10);
  const upcomingDateStr = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const candidates: AutomationReminderCandidate[] = [];

  for (const task of tasks) {
    if (!task.due_date || task.status === "done") continue;
    const isOverdue = task.due_date < todayStr;
    const isUpcoming = !isOverdue && task.due_date <= upcomingDateStr;

    if (!isOverdue && !isUpcoming) continue;

    const statusLabel = isOverdue ? "Overdue Task" : "Task Due Soon";
    const title = `${statusLabel}: ${task.title}`;
    const message = isOverdue
      ? `Work item "${task.title}" (${task.priority} priority) passed its due date (${task.due_date}).`
      : `Work item "${task.title}" (${task.priority} priority) is due on ${task.due_date}.`;

    if (task.assigned_to) {
      candidates.push({
        eventKey: `task.deadline.${isOverdue ? "overdue" : "upcoming"}.${task.id}.${todayStr}`,
        recipientScope: "specific_user",
        userId: task.assigned_to,
        organizationId: task.organization_id,
        type: "project",
        title,
        message,
        linkUrl: "/admin/tasks",
      });
    } else {
      candidates.push({
        eventKey: `task.deadline.${isOverdue ? "overdue" : "upcoming"}.${task.id}.${todayStr}`,
        recipientScope: "platform_admins",
        organizationId: task.organization_id,
        type: "project",
        title,
        message,
        linkUrl: "/admin/tasks",
      });
    }
  }

  return candidates;
}

export function evaluateInvoiceDueReminders(
  invoices: Array<{
    id: string;
    organization_id: string;
    invoice_number: string;
    amount_cents: number;
    status: string;
    due_date: string | null;
    paid_at?: string | null;
    items?: unknown;
  }>,
  now = new Date(),
): AutomationReminderCandidate[] {
  const todayStr = now.toISOString().slice(0, 10);
  const upcomingDateStr = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const candidates: AutomationReminderCandidate[] = [];

  for (const inv of invoices) {
    if (!inv.due_date) continue;
    const commercial = classifyInvoiceLifecycleStatus(inv);
    if (
      commercial.displayStatus === "settled" ||
      commercial.displayStatus === "cancelled" ||
      commercial.displayStatus === "draft" ||
      commercial.balanceDueCents <= 0
    ) {
      continue;
    }

    const balanceFormatted = `$${(commercial.balanceDueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const isOverdue = inv.due_date < todayStr || commercial.isOverdue;
    const isUpcoming = !isOverdue && inv.due_date <= upcomingDateStr;

    if (!isOverdue && !isUpcoming) continue;

    if (isOverdue) {
      candidates.push({
        eventKey: `invoice.overdue.admin.${inv.id}.${todayStr}`,
        recipientScope: "platform_admins",
        organizationId: inv.organization_id,
        type: "billing",
        title: `Overdue Invoice: ${inv.invoice_number}`,
        message: `Invoice ${inv.invoice_number} has an overdue balance of ${balanceFormatted} (due ${inv.due_date}).`,
        linkUrl: "/admin/billing",
      });
      candidates.push({
        eventKey: `invoice.overdue.client.${inv.id}.${todayStr}`,
        recipientScope: "org_clients",
        organizationId: inv.organization_id,
        type: "billing",
        title: `Payment Past Due: Invoice ${inv.invoice_number}`,
        message: `Invoice ${inv.invoice_number} has an outstanding balance of ${balanceFormatted} (due date: ${inv.due_date}).`,
        linkUrl: "/portal/invoices",
      });
    } else if (isUpcoming) {
      candidates.push({
        eventKey: `invoice.upcoming.client.${inv.id}.${todayStr}`,
        recipientScope: "org_clients",
        organizationId: inv.organization_id,
        type: "billing",
        title: `Upcoming Due Date: Invoice ${inv.invoice_number}`,
        message: `Invoice ${inv.invoice_number} (${balanceFormatted} balance due) is due on ${inv.due_date}.`,
        linkUrl: "/portal/invoices",
      });
    }
  }

  return candidates;
}

export function evaluateSupportTicketAttentionReminders(
  tickets: Array<{
    id: string;
    ticket_number: string;
    title: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    created_at: string;
  }>,
  now = new Date(),
): AutomationReminderCandidate[] {
  const todayStr = now.toISOString().slice(0, 10);
  const candidates: AutomationReminderCandidate[] = [];

  for (const ticket of tickets) {
    if (ticket.status !== "new" && ticket.status !== "in_progress") continue;
    if (ticket.status === "new" || ticket.priority === "urgent" || ticket.priority === "high") {
      candidates.push({
        eventKey: `ticket.attention.${ticket.id}.${todayStr}`,
        recipientScope: ticket.assigned_to ? "specific_user" : "support_staff",
        userId: ticket.assigned_to ?? undefined,
        type: "ticket",
        title: `Support Queue Attention: #${ticket.ticket_number}`,
        message: `Ticket #${ticket.ticket_number} ("${ticket.title}", ${ticket.priority} priority) is ${ticket.status.replace("_", " ")} and awaiting staff response.`,
        linkUrl: "/admin/support",
      });
    }
  }

  return candidates;
}

export function evaluatePendingInvitationReminders(
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    archived_at?: string | null;
  }>,
  now = new Date(),
): AutomationReminderCandidate[] {
  const todayStr = now.toISOString().slice(0, 10);
  const activePending = invitations.filter(
    (inv) => inv.status === "pending" && !inv.archived_at,
  );
  if (activePending.length === 0) return [];

  return [
    {
      eventKey: `invitations.pending.summary.${todayStr}.${activePending.length}`,
      recipientScope: "platform_admins",
      type: "system",
      title: `Pending Platform Invitations (${activePending.length})`,
      message: `${activePending.length} platform invitation(s) remain in pending state. Verify custom SMTP configuration in Supabase Auth or resend expired links in Team management.`,
      linkUrl: "/admin/team",
    },
  ];
}

