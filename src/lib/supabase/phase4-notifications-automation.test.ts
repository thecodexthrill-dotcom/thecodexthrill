import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildNotificationDedupeSignature,
  evaluateInvoiceDueReminders,
  evaluateLeadFollowUpReminders,
  evaluatePendingInvitationReminders,
  evaluateSupportTicketAttentionReminders,
  evaluateTaskDeadlineReminders,
  isDuplicateNotificationInWindow,
  isNotificationCategoryEnabled,
  normalizeNotificationPreferences,
  resolveTransactionalEmailConfig,
  sanitizeEmailErrorMetadata,
  sanitizeNotificationLink,
  sanitizeNotificationPayload,
  verifySchedulerSecret,
} from "./notification-helper.ts";

test("Notification preferences: security alerts are always mandatory and cannot be disabled", () => {
  const prefs = normalizeNotificationPreferences({
    security: false,
    system: false,
    project: true,
    billing: false,
    ticket: true,
    email_enabled: false,
  });

  assert.equal(prefs.security, true);
  assert.equal(prefs.system, false);
  assert.equal(prefs.project, true);
  assert.equal(prefs.billing, false);
  assert.equal(prefs.ticket, true);
  assert.equal(prefs.email_enabled, false);

  assert.equal(isNotificationCategoryEnabled(prefs, "security"), true);
  assert.equal(isNotificationCategoryEnabled(prefs, "system"), false);
  assert.equal(isNotificationCategoryEnabled(prefs, "billing"), false);
  assert.equal(isNotificationCategoryEnabled(prefs, "project"), true);

  const fallback = normalizeNotificationPreferences(null);
  assert.deepEqual(fallback, DEFAULT_NOTIFICATION_PREFERENCES);
});

test("Notification link sanitization prevents external redirects and cross-workspace leakage", () => {
  assert.equal(
    sanitizeNotificationLink("https://evil.example/phish", "portal"),
    "/portal/notifications",
  );
  assert.equal(
    sanitizeNotificationLink("//evil.example/phish", "admin"),
    "/admin/notifications",
  );
  assert.equal(
    sanitizeNotificationLink("/admin/billing", "portal"),
    "/portal/notifications",
  );
  assert.equal(
    sanitizeNotificationLink("/portal/invoices", "portal"),
    "/portal/invoices",
  );
  assert.equal(
    sanitizeNotificationLink("/admin/leads?id=123", "admin"),
    "/admin/leads?id=123",
  );
});

test("Notification payload sanitization strips internal staff notes and confidential markers", () => {
  const rawDesc =
    "[Milestone: Phase 2]\nClient-visible progress summary.\n---[DELIVERY HANDOVER]---\nDeployed to production.\n---[INTERNAL STAFF NOTES]---\nCONFIDENTIAL: Margin is 42%, do not share.";

  const portalPayload = sanitizeNotificationPayload({
    title: "Project Update [Internal Note: secret]",
    message: rawDesc,
    type: "project",
    linkUrl: "/admin/projects",
    recipientWorkspace: "portal",
  });

  assert.equal(portalPayload.title, "Project Update");
  assert.ok(!portalPayload.message.includes("CONFIDENTIAL"));
  assert.ok(!portalPayload.message.includes("Margin is 42%"));
  assert.ok(!portalPayload.message.includes("INTERNAL STAFF NOTES"));
  assert.equal(portalPayload.link_url, "/portal/notifications");
});

test("Notification deduplication detects duplicates within window and allows outside window", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const existing = [
    {
      user_id: "user-1",
      type: "billing",
      title: "Invoice Issued: INV-100",
      created_at: "2026-10-10T11:50:00.000Z", // 10 mins ago
    },
  ];

  assert.equal(
    isDuplicateNotificationInWindow({
      existingNotifications: existing,
      userId: "user-1",
      type: "billing",
      title: "  invoice issued: inv-100 ",
      windowMinutes: 15,
      now,
    }),
    true,
  );

  assert.equal(
    isDuplicateNotificationInWindow({
      existingNotifications: existing,
      userId: "user-1",
      type: "billing",
      title: "Invoice Issued: INV-100",
      windowMinutes: 5,
      now,
    }),
    false,
  );

  assert.equal(
    isDuplicateNotificationInWindow({
      existingNotifications: existing,
      userId: "user-2",
      type: "billing",
      title: "Invoice Issued: INV-100",
      windowMinutes: 15,
      now,
    }),
    false,
  );

  const sig1 = buildNotificationDedupeSignature({
    userId: "user-1",
    type: "billing",
    title: "Invoice Issued: INV-100",
    eventKey: "inv.100",
  });
  const sig2 = buildNotificationDedupeSignature({
    userId: "USER-1",
    type: "billing",
    title: "Different Title",
    eventKey: "INV.100",
  });
  assert.equal(sig1, sig2);
});

test("Scheduler secret verification enforces minimum length and constant-time comparison", () => {
  assert.deepEqual(verifySchedulerSecret("Bearer anything", ""), {
    authorized: false,
    reason: "secret_not_configured",
  });
  assert.deepEqual(verifySchedulerSecret("Bearer short", "too-short"), {
    authorized: false,
    reason: "secret_not_configured",
  });

  const validSecret = "super-secret-cron-token-2026-thecodexthrill";
  assert.deepEqual(verifySchedulerSecret(null, validSecret), {
    authorized: false,
    reason: "invalid_secret",
  });
  assert.deepEqual(verifySchedulerSecret("Bearer wrong-token-value", validSecret), {
    authorized: false,
    reason: "invalid_secret",
  });
  assert.deepEqual(verifySchedulerSecret(`Bearer ${validSecret}`, validSecret), {
    authorized: true,
    reason: "ok",
  });
  assert.deepEqual(verifySchedulerSecret(validSecret, validSecret), {
    authorized: true,
    reason: "ok",
  });
});

test("Transactional email config and error sanitizer never leak credentials or PII", () => {
  const unconfigured = resolveTransactionalEmailConfig({});
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.provider, "unconfigured");

  const resendConfig = resolveTransactionalEmailConfig({
    TRANSACTIONAL_EMAIL_FROM: "notifications@thecodexthrill.com",
    RESEND_API_KEY: "re_test_123456789",
  });
  assert.equal(resendConfig.configured, true);
  assert.equal(resendConfig.provider, "resend");

  const sanitizedErr = sanitizeEmailErrorMetadata({
    code: "http_401",
    status: 401,
    message:
      "Auth failed for Bearer secret_jwt_token_999 and key re_live_987654321 sending to client@example.com",
  });

  assert.equal(sanitizedErr.code, "http_401");
  assert.equal(sanitizedErr.status, 401);
  assert.ok(!sanitizedErr.summary.includes("secret_jwt_token_999"));
  assert.ok(!sanitizedErr.summary.includes("re_live_987654321"));
  assert.ok(!sanitizedErr.summary.includes("client@example.com"));
  assert.ok(sanitizedErr.summary.includes("[REDACTED]"));
  assert.ok(sanitizedErr.summary.includes("[REDACTED_KEY]"));
  assert.ok(sanitizedErr.summary.includes("[REDACTED_EMAIL]"));
});

test("Workflow automation evaluators accurately classify overdue and upcoming leads, tasks, invoices, tickets, and invitations", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  const leadReminders = evaluateLeadFollowUpReminders(
    [
      {
        id: "lead-overdue",
        contact_name: "Alice Vance",
        company_name: "Vance AI",
        stage: "qualified",
        follow_up_at: "2026-10-09T10:00:00.000Z",
      },
      {
        id: "lead-upcoming",
        contact_name: "Bob Chen",
        company_name: "Chen Labs",
        stage: "contacted",
        follow_up_at: "2026-10-11T08:00:00.000Z",
      },
      {
        id: "lead-converted",
        contact_name: "Converted Client",
        company_name: "Done Corp",
        stage: "converted",
        follow_up_at: "2026-10-08T10:00:00.000Z",
      },
    ],
    now,
  );
  assert.equal(leadReminders.length, 2);
  assert.ok(leadReminders[0].title.includes("Overdue Lead Follow-up"));
  assert.ok(leadReminders[1].title.includes("Upcoming Lead Follow-up"));

  const taskReminders = evaluateTaskDeadlineReminders(
    [
      {
        id: "task-overdue",
        project_id: "proj-1",
        organization_id: "org-1",
        title: "Security Audit Sign-off",
        status: "in_progress",
        priority: "urgent",
        assigned_to: "staff-1",
        due_date: "2026-10-08",
      },
      {
        id: "task-done",
        project_id: "proj-1",
        organization_id: "org-1",
        title: "Completed Task",
        status: "done",
        priority: "high",
        assigned_to: "staff-1",
        due_date: "2026-10-08",
      },
    ],
    now,
  );
  assert.equal(taskReminders.length, 1);
  assert.equal(taskReminders[0].recipientScope, "specific_user");
  assert.equal(taskReminders[0].userId, "staff-1");

  const invoiceReminders = evaluateInvoiceDueReminders(
    [
      {
        id: "inv-overdue",
        organization_id: "org-1",
        invoice_number: "INV-2026-901",
        amount_cents: 250000,
        status: "sent",
        due_date: "2026-10-05",
        items: [],
      },
      {
        id: "inv-settled",
        organization_id: "org-1",
        invoice_number: "INV-2026-902",
        amount_cents: 100000,
        status: "paid",
        due_date: "2026-10-05",
        paid_at: "2026-10-04T10:00:00Z",
        items: [
          {
            kind: "payment_record",
            amount_cents: 100000,
            method: "wire_transfer",
            reference: "WIRE-1",
            recorded_at: "2026-10-04T10:00:00Z",
            recorded_by_email: "admin@thecodexthrill.com",
          },
        ],
      },
    ],
    now,
  );
  // Overdue invoice generates 1 admin reminder + 1 org_clients reminder; settled invoice generates 0
  assert.equal(invoiceReminders.length, 2);
  assert.equal(invoiceReminders[0].recipientScope, "platform_admins");
  assert.equal(invoiceReminders[1].recipientScope, "org_clients");

  const ticketReminders = evaluateSupportTicketAttentionReminders(
    [
      {
        id: "t-1",
        ticket_number: "TICK-101",
        title: "Production API latency",
        status: "new",
        priority: "high",
        assigned_to: null,
        created_at: "2026-10-10T09:00:00Z",
      },
    ],
    now,
  );
  assert.equal(ticketReminders.length, 1);
  assert.equal(ticketReminders[0].recipientScope, "support_staff");

  const inviteReminders = evaluatePendingInvitationReminders(
    [
      {
        id: "inv-1",
        email: "pending@example.com",
        role: "support_admin",
        status: "pending",
        expires_at: "2026-10-17T00:00:00Z",
        archived_at: null,
      },
    ],
    now,
  );
  assert.equal(inviteReminders.length, 1);
  assert.ok(inviteReminders[0].title.includes("Pending Platform Invitations (1)"));
});

