import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateInvoiceDueReminders,
  evaluateLeadFollowUpReminders,
  evaluateSupportTicketAttentionReminders,
  evaluateTaskDeadlineReminders,
  isDuplicateNotificationInWindow,
  isNotificationCategoryEnabled,
  normalizeNotificationPreferences,
  resolveTransactionalEmailConfig,
  sanitizeEmailErrorMetadata,
  sanitizeNotificationPayload,
  verifySchedulerSecret,
} from "../src/lib/supabase/notification-helper.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL must be configured");
assert.ok(anonKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured");
assert.ok(serviceRoleKey, "SUPABASE_SECRET_KEY must be configured");

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runAcceptance() {
  console.log("=== Phase 4: Notifications, Communication & Workflow Automation Acceptance ===");
  const runId = Date.now().toString(36).toUpperCase();

  let targetUserId = null;
  let originalMetadata = null;
  const createdNotificationIds = [];
  let leadId = null;
  let orgId = null;
  let projectId = null;
  let taskId = null;
  let invoiceId = null;
  let ticketId = null;
  let auditId = null;

  try {
    // 1. Resolve target user from Supabase Cloud
    const { data: usersData, error: usersErr } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 2,
    });
    assert.ifError(usersErr);
    const targetUser = usersData?.users?.[0];
    assert.ok(targetUser?.id, "At least one user must exist in Supabase Cloud");
    targetUserId = targetUser.id;
    originalMetadata = { ...(targetUser.user_metadata ?? {}) };
    console.log(`[PASS] 1. Resolved test recipient account (${targetUserId})`);

    // 2. Sanitized notification persistence & internal staff note redaction
    const rawPayload = sanitizeNotificationPayload({
      title: `Phase4 Deliverable Shared ${runId} [Internal Note: hidden]`,
      message:
        "[Milestone: Phase 4]\nArchitecture Runbook v2 uploaded.\n---[INTERNAL STAFF NOTES]---\nSECRET_STAFF_MARGIN_DATA_DO_NOT_LEAK",
      type: "project",
      linkUrl: "/admin/projects",
      recipientWorkspace: "portal",
    });

    assert.ok(!rawPayload.title.includes("Internal Note"));
    assert.ok(!rawPayload.message.includes("SECRET_STAFF_MARGIN_DATA_DO_NOT_LEAK"));
    assert.equal(rawPayload.link_url, "/portal/notifications");

    const { data: notif1, error: notif1Err } = await adminClient
      .from("user_notifications")
      .insert({
        user_id: targetUserId,
        title: rawPayload.title,
        message: rawPayload.message,
        type: rawPayload.type,
        link_url: rawPayload.link_url,
        is_read: false,
      })
      .select("*")
      .single();

    assert.ifError(notif1Err);
    assert.ok(notif1?.id);
    createdNotificationIds.push(notif1.id);
    console.log("[PASS] 2. Sanitized notification persisted in Supabase Cloud (internal staff notes stripped)");

    // 3. Deduplication check against live user_notifications rows
    const { data: recentNotifs } = await adminClient
      .from("user_notifications")
      .select("user_id, type, title, created_at")
      .eq("user_id", targetUserId)
      .eq("type", "project")
      .order("created_at", { ascending: false })
      .limit(20);

    const isDup = isDuplicateNotificationInWindow({
      existingNotifications: recentNotifs ?? [],
      userId: targetUserId,
      type: "project",
      title: rawPayload.title,
      windowMinutes: 15,
    });
    assert.equal(isDup, true, "Duplicate notification within 15m window must be suppressed");
    console.log("[PASS] 3. Idempotent deduplication verified against live user_notifications records");

    // 4. Notification Preferences Persistence & Category Filtering
    const testPrefs = normalizeNotificationPreferences({
      security: false, // Attempting to disable security must be overridden to true
      system: true,
      project: true,
      billing: false,
      ticket: true,
      email_enabled: false,
      updated_at: new Date().toISOString(),
    });
    assert.equal(testPrefs.security, true);
    assert.equal(isNotificationCategoryEnabled(testPrefs, "billing"), false);
    assert.equal(isNotificationCategoryEnabled(testPrefs, "security"), true);

    const { data: updatedUser, error: prefErr } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      {
        user_metadata: {
          ...originalMetadata,
          notification_preferences: testPrefs,
        },
      },
    );
    assert.ifError(prefErr);
    const savedPrefs = normalizeNotificationPreferences(
      updatedUser?.user?.user_metadata?.notification_preferences,
    );
    assert.equal(savedPrefs.billing, false);
    assert.equal(savedPrefs.email_enabled, false);
    assert.equal(savedPrefs.security, true);
    console.log("[PASS] 4. Notification preferences persisted in user_metadata & mandatory security alert rule enforced");

    // 5. Read-State Management (Single Read & Mark All Read) + RLS Isolation
    const { data: notif2, error: notif2Err } = await adminClient
      .from("user_notifications")
      .insert({
        user_id: targetUserId,
        title: `Phase4 Security Notice ${runId}`,
        message: "AAL2 authenticator verification active.",
        type: "security",
        link_url: "/account/security",
        is_read: false,
      })
      .select("*")
      .single();
    assert.ifError(notif2Err);
    createdNotificationIds.push(notif2.id);

    // Verify anon/unauthenticated client cannot read or modify user_notifications under RLS
    const anonRead = await anonClient
      .from("user_notifications")
      .select("id")
      .in("id", createdNotificationIds);
    assert.equal(anonRead.data?.length ?? 0, 0, "RLS must block unauthenticated reads on user_notifications");

    const anonUpdate = await anonClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", notif1.id)
      .select("id");
    assert.equal(anonUpdate.data?.length ?? 0, 0, "RLS must block unauthenticated updates on user_notifications");

    // Mark single notification read
    const { data: markedSingle } = await adminClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", notif1.id)
      .eq("user_id", targetUserId)
      .select("is_read")
      .single();
    assert.equal(markedSingle?.is_read, true);

    // Mark all test notifications read
    await adminClient
      .from("user_notifications")
      .update({ is_read: true })
      .in("id", createdNotificationIds)
      .eq("user_id", targetUserId);

    const { data: afterMarkAll } = await adminClient
      .from("user_notifications")
      .select("id, is_read")
      .in("id", createdNotificationIds);
    assert.ok(afterMarkAll?.every((n) => n.is_read === true));
    console.log("[PASS] 5. Single/bulk read-state transitions and Zero-Trust RLS isolation verified");

    // 6. Workflow Automation Sweep against real Supabase Cloud records
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const yesterdayDate = yesterdayIso.slice(0, 10);

    const { data: leadRow, error: leadErr } = await adminClient
      .from("platform_sales_leads")
      .insert({
        contact_name: `Automation Lead ${runId}`,
        email: `auto-lead-${runId.toLowerCase()}@example.com`,
        company_name: `AutoCorp ${runId}`,
        source: "website",
        stage: "qualified",
        follow_up_at: yesterdayIso,
      })
      .select("id, contact_name, company_name, stage, follow_up_at")
      .single();
    assert.ifError(leadErr);
    leadId = leadRow.id;

    const { data: orgRow, error: orgErr } = await adminClient
      .from("organizations")
      .insert({
        name: `Automation Org ${runId}`,
        status: "active",
      })
      .select("id")
      .single();
    assert.ifError(orgErr);
    orgId = orgRow.id;

    const { data: projRow, error: projErr } = await adminClient
      .from("tenant_projects")
      .insert({
        organization_id: orgId,
        name: `Automation Project ${runId}`,
        status: "in_progress",
        progress_pct: 40,
      })
      .select("id")
      .single();
    assert.ifError(projErr);
    projectId = projRow.id;

    const { data: taskRow, error: taskErr } = await adminClient
      .from("tenant_tasks")
      .insert({
        project_id: projectId,
        organization_id: orgId,
        title: `Overdue Milestone Task ${runId}`,
        status: "in_progress",
        priority: "urgent",
        assigned_to: targetUserId,
        due_date: yesterdayDate,
      })
      .select("id, project_id, organization_id, title, status, priority, assigned_to, due_date")
      .single();
    assert.ifError(taskErr);
    taskId = taskRow.id;

    const { data: invRow, error: invErr } = await adminClient
      .from("tenant_invoices")
      .insert({
        organization_id: orgId,
        invoice_number: `INV-AUTO-${runId}`,
        amount_cents: 180000,
        currency: "USD",
        status: "sent",
        due_date: yesterdayDate,
        items: [],
      })
      .select("id, organization_id, invoice_number, amount_cents, status, due_date, paid_at, items")
      .single();
    assert.ifError(invErr);
    invoiceId = invRow.id;

    const { data: ticketRow, error: ticketErr } = await adminClient
      .from("support_tickets")
      .insert({
        ticket_number: `TICK-AUTO-${runId}`,
        organization_id: orgId,
        customer_id: targetUserId,
        title: `Urgent SLA Ticket ${runId}`,
        category: "technical",
        priority: "urgent",
        status: "new",
      })
      .select("id, ticket_number, title, status, priority, assigned_to, created_at")
      .single();
    assert.ifError(ticketErr);
    ticketId = ticketRow.id;

    const leadCandidates = evaluateLeadFollowUpReminders([leadRow]);
    const taskCandidates = evaluateTaskDeadlineReminders([taskRow]);
    const invCandidates = evaluateInvoiceDueReminders([invRow]);
    const ticketCandidates = evaluateSupportTicketAttentionReminders([ticketRow]);

    assert.equal(leadCandidates.length, 1);
    assert.equal(taskCandidates.length, 1);
    assert.equal(invCandidates.length, 2); // Admin + Org Clients
    assert.equal(ticketCandidates.length, 1);

    const { data: auditRow, error: auditErr } = await adminClient
      .from("audit_events")
      .insert({
        actor_user_id: targetUserId,
        scope: "platform",
        action: "workflow.automation_sweep",
        target_type: "workflow_automation",
        target_id: runId,
        details: {
          leadCandidates: leadCandidates.length,
          taskCandidates: taskCandidates.length,
          invoiceCandidates: invCandidates.length,
          ticketCandidates: ticketCandidates.length,
        },
      })
      .select("id")
      .single();
    assert.ifError(auditErr);
    auditId = auditRow.id;
    console.log("[PASS] 6. Workflow automation reminder evaluation & audit trail verified against live Cloud records");

    // 7. Scheduler Secret & Transactional Email Safety Verification
    const unauthCheck = verifySchedulerSecret("Bearer invalid", "valid-production-cron-secret-key-2026");
    assert.equal(unauthCheck.authorized, false);
    const authCheck = verifySchedulerSecret(
      "Bearer valid-production-cron-secret-key-2026",
      "valid-production-cron-secret-key-2026",
    );
    assert.equal(authCheck.authorized, true);

    const emailConfig = resolveTransactionalEmailConfig(process.env);
    assert.ok(["resend", "webhook", "unconfigured"].includes(emailConfig.provider));
    const redactedErr = sanitizeEmailErrorMetadata({
      code: "smtp_err",
      message: "Failed with Bearer secret_token_abc to user@thecodexthrill.com",
    });
    assert.ok(!redactedErr.summary.includes("secret_token_abc"));
    assert.ok(!redactedErr.summary.includes("user@thecodexthrill.com"));
    console.log(
      `[PASS] 7. Scheduler constant-time auth & transactional email status (${emailConfig.provider}) verified`,
    );

    console.log(
      "\nALL PHASE 4 NOTIFICATIONS, COMMUNICATION & WORKFLOW AUTOMATION ACCEPTANCE CHECKS PASSED (7/7).",
    );
  } finally {
    if (targetUserId && originalMetadata) {
      await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: originalMetadata,
      });
    }
    if (createdNotificationIds.length > 0) {
      await adminClient.from("user_notifications").delete().in("id", createdNotificationIds);
    }
    if (auditId) {
      await adminClient.from("audit_events").delete().eq("id", auditId);
    }
    if (ticketId) {
      await adminClient.from("support_tickets").delete().eq("id", ticketId);
    }
    if (invoiceId) {
      await adminClient.from("tenant_invoices").delete().eq("id", invoiceId);
    }
    if (taskId) {
      await adminClient.from("tenant_tasks").delete().eq("id", taskId);
    }
    if (projectId) {
      await adminClient.from("tenant_projects").delete().eq("id", projectId);
    }
    if (orgId) {
      await adminClient.from("organizations").delete().eq("id", orgId);
    }
    if (leadId) {
      await adminClient.from("platform_sales_leads").delete().eq("id", leadId);
    }
    console.log("[CLEANUP] All Phase 4 test records and temporary user metadata restored.");
  }
}

runAcceptance().catch((err) => {
  console.error("Phase 4 Acceptance test failed:", err);
  process.exit(1);
});

