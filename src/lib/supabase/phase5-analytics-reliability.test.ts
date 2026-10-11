import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildExecutiveCsvReport,
  computeCommercialExecutiveAnalytics,
  computeDeliveryExecutiveAnalytics,
  computeGovernanceAndOperationsAnalytics,
  computeLeadExecutiveAnalytics,
  computeOrganizationExecutiveAnalytics,
  computePeriodComparison,
  computeSupportExecutiveAnalytics,
  formatAnalyticsCurrency,
  resolveAnalyticsDateWindow,
  sanitizeCsvCell,
  serializeCsvRows,
} from "./executive-analytics-helper.ts";
import {
  evaluateAutomationJobHealth,
  logSanitizedOperationalEvent,
  resetOperationalLogThrottleForTesting,
  resolvePlatformIntegrationStatus,
  sanitizeOperationalMetadata,
  sanitizeOperationalString,
  shouldThrottleOperationalLog,
} from "./platform-health-helper.ts";

test("Date window resolution computes exact UTC boundaries and previous comparison windows", () => {
  const refNow = new Date("2026-10-10T15:30:00.000Z");

  const win30 = resolveAnalyticsDateWindow({ preset: "30d", now: refNow });
  assert.equal(win30.preset, "30d");
  assert.ok(win30.currentStart instanceof Date);
  assert.ok(win30.currentEnd instanceof Date);
  assert.ok(win30.previousStart instanceof Date);
  assert.ok(win30.previousEnd instanceof Date);
  assert.equal(win30.currentEnd.toISOString(), "2026-10-10T23:59:59.999Z");
  assert.ok(win30.previousEnd.getTime() < win30.currentStart.getTime());

  // Custom window with inverted dates automatically normalizes start <= end
  const winCustom = resolveAnalyticsDateWindow({
    preset: "custom",
    customStart: "2026-10-08",
    customEnd: "2026-10-01",
    now: refNow,
  });
  assert.equal(winCustom.preset, "custom");
  assert.equal(winCustom.currentStart?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(winCustom.currentEnd?.toISOString(), "2026-10-08T23:59:59.999Z");

  // All-time window has no artificial start or previous comparison
  const winAll = resolveAnalyticsDateWindow({ preset: "all", now: refNow });
  assert.equal(winAll.currentStart, null);
  assert.equal(winAll.previousStart, null);
});

test("Period comparisons never divide by zero or invent percentage changes", () => {
  const upMetric = computePeriodComparison(15, 10, true);
  assert.equal(upMetric.deltaAbsolute, 5);
  assert.equal(upMetric.deltaPct, 50);
  assert.equal(upMetric.direction, "up");

  const zeroBaseline = computePeriodComparison(4, 0, true);
  assert.equal(zeroBaseline.deltaAbsolute, 4);
  assert.equal(zeroBaseline.deltaPct, null);
  assert.equal(zeroBaseline.direction, "new");
  assert.match(zeroBaseline.label, /\+4 \(0 in prior period\)/);

  const bothZero = computePeriodComparison(0, 0, true);
  assert.equal(bothZero.deltaAbsolute, 0);
  assert.equal(bothZero.deltaPct, 0);
  assert.equal(bothZero.direction, "flat");

  const unavailableMetric = computePeriodComparison(null, 10, true);
  assert.equal(unavailableMetric.direction, "unavailable");
  assert.equal(unavailableMetric.deltaAbsolute, null);
});

test("Currency formatting handles cents accurately and never renders null/NaN as $0", () => {
  assert.equal(formatAnalyticsCurrency(null), "Unavailable");
  assert.equal(formatAnalyticsCurrency(undefined), "Unavailable");
  assert.equal(formatAnalyticsCurrency(Number.NaN), "Unavailable");
  assert.equal(formatAnalyticsCurrency(0), "$0");
  assert.equal(formatAnalyticsCurrency(125000, { showCents: true }), "$1,250.00");
});

test("Lead executive analytics computes funnel stages, source conversion rates, and follow-up queue without inventing values on null", () => {
  const refNow = new Date("2026-10-10T12:00:00.000Z");
  const window = resolveAnalyticsDateWindow({ preset: "30d", now: refNow });

  // Null dataset must return null (Unavailable), never 0
  assert.equal(computeLeadExecutiveAnalytics(null, window, refNow), null);

  // Empty dataset returns 0 leads and null conversionRatePct (never divides by zero)
  const emptyStats = computeLeadExecutiveAnalytics([], window, refNow);
  assert.ok(emptyStats);
  assert.equal(emptyStats.totalLeads, 0);
  assert.equal(emptyStats.conversionRatePct, null);

  // Populated dataset across current and previous windows
  const leads = [
    {
      id: "l-1",
      stage: "converted",
      source: "website",
      follow_up_at: "2026-10-05T10:00:00.000Z", // ignored for follow-up queue because stage=converted
      created_at: "2026-10-02T10:00:00.000Z",
    },
    {
      id: "l-2",
      stage: "qualified",
      source: "referral",
      follow_up_at: "2026-10-08T10:00:00.000Z", // overdue active follow-up
      created_at: "2026-10-04T10:00:00.000Z",
    },
    {
      id: "l-3",
      stage: "contacted",
      source: "website",
      follow_up_at: "2026-10-11T06:00:00.000Z", // upcoming within 24h
      created_at: "2026-10-06T10:00:00.000Z",
    },
    {
      id: "l-4",
      stage: "new",
      source: "admin",
      follow_up_at: null, // unscheduled active
      created_at: "2026-10-09T10:00:00.000Z",
    },
    // Previous 30d window lead
    {
      id: "l-prev",
      stage: "new",
      source: "website",
      follow_up_at: null,
      created_at: "2026-09-01T10:00:00.000Z",
    },
  ];

  const stats = computeLeadExecutiveAnalytics(leads, window, refNow);
  assert.ok(stats);
  assert.equal(stats.totalLeads, 4);
  assert.equal(stats.previousTotalLeads, 1);
  assert.equal(stats.leadsComparison.deltaAbsolute, 3);
  assert.equal(stats.convertedLeads, 1);
  assert.equal(stats.qualifiedLeads, 1);
  assert.equal(stats.activePipelineLeads, 3);
  assert.equal(stats.conversionRatePct, 25);

  const websiteSource = stats.sourceBreakdown.find((s) => s.source === "website");
  assert.ok(websiteSource);
  assert.equal(websiteSource.total, 2);
  assert.equal(websiteSource.converted, 1);
  assert.equal(websiteSource.conversionRatePct, 50);

  assert.equal(stats.followUpHealth.overdueCount, 1);
  assert.equal(stats.followUpHealth.upcoming24hCount, 1);
  assert.equal(stats.followUpHealth.unscheduledActiveCount, 2); // l-4 and l-prev
  assert.ok(stats.trendSeries.length > 0);
});

test("Organization and Delivery analytics accurately track active clients, project completion, and overdue/upcoming tasks", () => {
  const refNow = new Date("2026-10-10T12:00:00.000Z");
  const window = resolveAnalyticsDateWindow({ preset: "all", now: refNow });

  assert.equal(computeOrganizationExecutiveAnalytics(null, null, window), null);

  const orgStats = computeOrganizationExecutiveAnalytics(
    [
      { id: "org-1", name: "Acme", status: "active", created_at: "2026-10-01T00:00:00Z" },
      { id: "org-2", name: "Beta", status: "suspended", created_at: "2026-09-01T00:00:00Z" },
    ],
    [
      { organization_id: "org-1", user_id: "u-1", status: "active" },
      { organization_id: "org-1", user_id: "u-2", status: "active" },
      { organization_id: "org-2", user_id: "u-3", status: "active" }, // org-2 is suspended
    ],
    window
  );
  assert.ok(orgStats);
  assert.equal(orgStats.activeOrganizations, 1);
  assert.equal(orgStats.suspendedOrganizations, 1);
  assert.equal(orgStats.activeClientMembershipsCount, 2);
  assert.equal(orgStats.organizationsWithActiveClientsCount, 1);

  const deliveryNull = computeDeliveryExecutiveAnalytics(null, null, window, refNow);
  assert.equal(deliveryNull.projects, null);
  assert.equal(deliveryNull.tasks, null);

  const delivery = computeDeliveryExecutiveAnalytics(
    [
      {
        id: "p-1",
        name: "Cloud Migration",
        status: "in_progress",
        progress_pct: 60,
        target_date: "2026-10-05", // overdue target
        created_at: "2026-09-15T00:00:00Z",
      },
      {
        id: "p-2",
        name: "Security Audit",
        status: "completed",
        progress_pct: 100,
        target_date: "2026-10-01", // completed, not overdue
        created_at: "2026-09-10T00:00:00Z",
      },
    ],
    [
      {
        id: "t-1",
        title: "Rotate production keys",
        status: "in_progress",
        priority: "urgent",
        assigned_to: null,
        due_date: "2026-10-08", // 2 days overdue
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        id: "t-2",
        title: "Finalize RLS review",
        status: "todo",
        priority: "high",
        assigned_to: "staff-1",
        due_date: "2026-10-12", // upcoming within 48h & 7d
        created_at: "2026-10-02T00:00:00Z",
      },
      {
        id: "t-3",
        title: "Initial kickoff",
        status: "done",
        priority: "medium",
        assigned_to: "staff-1",
        due_date: "2026-10-01", // done, not overdue
        created_at: "2026-09-20T00:00:00Z",
      },
    ],
    window,
    refNow
  );

  assert.ok(delivery.projects);
  assert.equal(delivery.projects.totalProjects, 2);
  assert.equal(delivery.projects.activeProjects, 1);
  assert.equal(delivery.projects.completedProjects, 1);
  assert.equal(delivery.projects.avgCompletionPct, 80);
  assert.equal(delivery.projects.overdueTargetProjectsCount, 1);

  assert.ok(delivery.tasks);
  assert.equal(delivery.tasks.totalTasks, 3);
  assert.equal(delivery.tasks.completedTasks, 1);
  assert.equal(delivery.tasks.openTasks, 2);
  assert.equal(delivery.tasks.overdueTasksCount, 1);
  assert.equal(delivery.tasks.upcoming7dTasksCount, 1);
  assert.equal(delivery.tasks.upcoming48hTasksCount, 1);
  assert.equal(delivery.tasks.unassignedOpenTasksCount, 1);
  assert.equal(delivery.tasks.overdueTaskItems[0]?.title, "Rotate production keys");
});

test("Commercial analytics strictly separates Booked Invoice Value, Verified Collected Payments, Current Receivables, and Overdue Receivables", () => {
  const refNow = new Date("2026-10-10T12:00:00.000Z");
  const window = resolveAnalyticsDateWindow({ preset: "all", now: refNow });

  assert.equal(computeCommercialExecutiveAnalytics(null, window), null);

  const invoices = [
    // 1. Draft invoice ($500) -> Excluded from booked, collected, and receivables
    {
      id: "inv-draft",
      invoice_number: "INV-001",
      amount_cents: 50000,
      status: "draft",
      currency: "USD",
      due_date: "2026-10-25",
      paid_at: null,
      created_at: "2026-10-01T00:00:00Z",
      items: [],
    },
    // 2. Cancelled invoice ($300) -> Excluded from booked, collected, and receivables
    {
      id: "inv-cancelled",
      invoice_number: "INV-002",
      amount_cents: 30000,
      status: "cancelled",
      currency: "USD",
      due_date: "2026-10-25",
      paid_at: null,
      created_at: "2026-10-01T00:00:00Z",
      items: [],
    },
    // 3. Issued invoice ($1,000), unpaid, due in future -> Booked $1,000, Verified Collected $0, Current Receivable $1,000
    {
      id: "inv-issued",
      invoice_number: "INV-003",
      amount_cents: 100000,
      status: "sent",
      currency: "USD",
      due_date: "2099-12-31",
      paid_at: null,
      created_at: "2026-10-02T00:00:00Z",
      items: [{ kind: "line_item", description: "Retainer", amount_cents: 100000 }],
    },
    // 4. Partially paid invoice ($2,000), $800 verified wire payment, due in future -> Booked $2,000, Verified Collected $800, Current Receivable $1,200
    {
      id: "inv-partial",
      invoice_number: "INV-004",
      amount_cents: 200000,
      status: "sent",
      currency: "USD",
      due_date: "2099-12-31",
      paid_at: null,
      created_at: "2026-10-03T00:00:00Z",
      items: [
        { kind: "line_item", description: "Phase 1", amount_cents: 200000 },
        {
          kind: "payment_record",
          amount_cents: 80000,
          method: "wire_transfer",
          reference: "WIRE-101",
          recorded_at: "2026-10-04T10:00:00Z",
        },
      ],
    },
    // 5. Overdue invoice ($1,500), unpaid, past due -> Booked $1,500, Verified Collected $0, Overdue Receivable $1,500
    {
      id: "inv-overdue",
      invoice_number: "INV-005",
      amount_cents: 150000,
      status: "overdue",
      currency: "USD",
      due_date: "2026-09-15",
      paid_at: null,
      created_at: "2026-09-01T00:00:00Z",
      items: [],
    },
    // 6. Settled invoice ($1,200) WITH verified payment record -> Booked $1,200, Verified Collected $1,200, Receivable $0
    {
      id: "inv-settled-verified",
      invoice_number: "INV-006",
      amount_cents: 120000,
      status: "paid",
      currency: "USD",
      due_date: "2026-10-10",
      paid_at: "2026-10-05T12:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      items: [
        {
          kind: "payment_record",
          amount_cents: 120000,
          method: "ach",
          reference: "ACH-999",
          recorded_at: "2026-10-05T12:00:00Z",
        },
      ],
    },
    // 7. Legacy status="paid" invoice ($400) WITHOUT payment_record -> Booked $400, Verified Collected $0, Unverified Settled $400
    {
      id: "inv-settled-unverified",
      invoice_number: "INV-007",
      amount_cents: 40000,
      status: "paid",
      currency: "USD",
      due_date: "2026-10-10",
      paid_at: "2026-10-06T12:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      items: [],
    },
  ];

  const comm = computeCommercialExecutiveAnalytics(invoices, window);
  assert.ok(comm);

  // Booked value = $1,000 + $2,000 + $1,500 + $1,200 + $400 = $6,100 (610,000 cents)
  assert.equal(comm.bookedInvoiceCents, 610000);
  // Verified collected = $800 + $1,200 = $2,000 (200,000 cents) — never includes issued or unverified settled!
  assert.equal(comm.verifiedCollectedCents, 200000);
  // Unverified settled = $400 (40,000 cents)
  assert.equal(comm.unverifiedSettledCents, 40000);
  // Current receivables = $1,000 + $1,200 = $2,200 (220,000 cents)
  assert.equal(comm.currentReceivablesCents, 220000);
  // Overdue receivables = $1,500 (150,000 cents)
  assert.equal(comm.overdueReceivablesCents, 150000);
  // Total outstanding balance = $2,200 + $1,500 = $3,700 (370,000 cents)
  assert.equal(comm.outstandingBalanceCents, 370000);
  // Draft & Cancelled tracked separately
  assert.equal(comm.draftInvoiceCents, 50000);
  assert.equal(comm.cancelledInvoiceCents, 30000);
  assert.equal(comm.verifiedPaymentRecordsCount, 2);
  assert.equal(comm.paymentMethodBreakdown.wire_transfer.amountCents, 80000);
  assert.equal(comm.paymentMethodBreakdown.ach.amountCents, 120000);
});

test("Support analytics never reports fake 100% resolution on empty queues and accurately counts high-priority open tickets", () => {
  const refNow = new Date("2026-10-10T12:00:00.000Z");
  const window = resolveAnalyticsDateWindow({ preset: "all", now: refNow });

  assert.equal(computeSupportExecutiveAnalytics(null, window), null);

  const emptySupport = computeSupportExecutiveAnalytics([], window);
  assert.ok(emptySupport);
  assert.equal(emptySupport.totalTickets, 0);
  assert.equal(emptySupport.resolutionRatePct, null);

  const populatedSupport = computeSupportExecutiveAnalytics(
    [
      {
        id: "tk-1",
        ticket_number: "TKT-101",
        title: "Production outage",
        status: "new",
        priority: "urgent",
        category: "technical",
        assigned_to: null,
        created_at: "2026-10-09T10:00:00Z",
      },
      {
        id: "tk-2",
        ticket_number: "TKT-102",
        title: "Invoice discrepancy",
        status: "in_progress",
        priority: "high",
        category: "billing",
        assigned_to: "staff-1",
        created_at: "2026-10-08T10:00:00Z",
      },
      {
        id: "tk-3",
        ticket_number: "TKT-103",
        title: "Resolved question",
        status: "resolved",
        priority: "urgent", // resolved urgent ticket must NOT count toward open high-priority!
        category: "general",
        assigned_to: "staff-1",
        created_at: "2026-10-05T10:00:00Z",
      },
    ],
    window
  );

  assert.ok(populatedSupport);
  assert.equal(populatedSupport.totalTickets, 3);
  assert.equal(populatedSupport.openTicketsCount, 2);
  assert.equal(populatedSupport.highPriorityOpenCount, 2);
  assert.equal(populatedSupport.urgentOpenCount, 1);
  assert.equal(populatedSupport.unassignedOpenCount, 1);
  assert.equal(populatedSupport.resolutionRatePct, 33);
});

test("Spreadsheet formula injection prevention neutralizes dangerous prefixes in CSV exports", () => {
  assert.equal(sanitizeCsvCell("=SUM(A1:A10)"), "\"'=SUM(A1:A10)\"");
  assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), "\"'+cmd|' /C calc'!A0\"");
  assert.equal(sanitizeCsvCell("-2+3+cmd|' /C calc'!A0"), "\"'-2+3+cmd|' /C calc'!A0\"");
  assert.equal(sanitizeCsvCell("@SUM(1+1)"), "\"'@SUM(1+1)\"");
  assert.equal(sanitizeCsvCell("  =HYPERLINK(\"http://evil.example\")"), "\"'  =HYPERLINK(\"\"http://evil.example\"\")\"");
  assert.equal(sanitizeCsvCell("\t=1+1"), "\"'\t=1+1\"");
  assert.equal(sanitizeCsvCell("Normal Project, Phase 1"), "\"Normal Project, Phase 1\"");
  assert.equal(sanitizeCsvCell(4250), "4250");

  const csv = serializeCsvRows(
    ["Name", "FormulaAttempt"],
    [["Acme Corp", "=IMPORTXML(\"http://evil.example\",\"//a\")"]]
  );
  assert.ok(csv.includes("\"'=IMPORTXML(\"\"http://evil.example\"\",\"\"//a\"\")\""));

  // Verify executive summary CSV export marks unavailable datasets as "Unavailable" instead of 0
  const refNow = new Date("2026-10-10T12:00:00.000Z");
  const window = resolveAnalyticsDateWindow({ preset: "30d", now: refNow });
  const report = buildExecutiveCsvReport({
    reportType: "executive_summary",
    window,
    now: refNow,
    data: {
      leads: null,
      organizations: null,
      staffCount: null,
      pendingInvitesCount: null,
      projects: null,
      tasks: null,
      invoices: null,
      tickets: null,
    },
  });
  assert.match(report.csvContent, /New Sales Leads,Unavailable/);
  assert.match(report.csvContent, /Verified Collected Payments \(Audited Payment Records\),Unavailable/);
});

test("Sanitized operational logging redacts secrets and PII while throttling repeated failure floods", () => {
  resetOperationalLogThrottleForTesting();

  const rawError =
    "Failed call with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.sig and key re_1234567890abcdef and sb_secret_987654321 for user admin@thecodexthrill.com?token=my_secret_tok";
  const sanitizedStr = sanitizeOperationalString(rawError);

  assert.doesNotMatch(sanitizedStr, /eyJhbGci/);
  assert.doesNotMatch(sanitizedStr, /re_1234567890abcdef/);
  assert.doesNotMatch(sanitizedStr, /sb_secret_987654321/);
  assert.doesNotMatch(sanitizedStr, /admin@thecodexthrill\.com/);
  assert.doesNotMatch(sanitizedStr, /my_secret_tok/);
  assert.match(sanitizedStr, /\[REDACTED_TOKEN\]|\[REDACTED_JWT\]/);
  assert.match(sanitizedStr, /\[REDACTED_KEY\]/);
  assert.match(sanitizedStr, /\[REDACTED_SECRET\]/);
  assert.match(sanitizedStr, /\[REDACTED_EMAIL\]/);

  const meta = sanitizeOperationalMetadata({
    apiKey: "re_secret_value_12345",
    authorization: "Bearer secret_jwt_token",
    hasSecretKey: true,
    isConfigured: false,
    recipientEmail: "client@example.org",
    statusCode: 503,
  });

  assert.equal(meta.apiKey, "[REDACTED_SECRET]");
  assert.equal(meta.authorization, "[REDACTED_SECRET]");
  assert.equal(meta.hasSecretKey, true);
  assert.equal(meta.isConfigured, false);
  assert.equal(meta.recipientEmail, "[REDACTED_EMAIL]");
  assert.equal(meta.statusCode, 503);

  // Repeated failure throttling check
  const t0 = 1_700_000_000_000;
  const first = shouldThrottleOperationalLog("scheduler:db_timeout", {
    cooldownMs: 60_000,
    nowMs: t0,
  });
  assert.equal(first.allowed, true);
  assert.equal(first.suppressedCount, 0);

  const second = shouldThrottleOperationalLog("scheduler:db_timeout", {
    cooldownMs: 60_000,
    nowMs: t0 + 10_000,
  });
  assert.equal(second.allowed, false);
  assert.equal(second.suppressedCount, 1);

  const third = shouldThrottleOperationalLog("scheduler:db_timeout", {
    cooldownMs: 60_000,
    nowMs: t0 + 20_000,
  });
  assert.equal(third.allowed, false);
  assert.equal(third.suppressedCount, 2);

  // After cooldown elapses, logging is allowed again and reports the 2 suppressed occurrences
  const fourth = shouldThrottleOperationalLog("scheduler:db_timeout", {
    cooldownMs: 60_000,
    nowMs: t0 + 65_000,
  });
  assert.equal(fourth.allowed, true);
  assert.equal(fourth.suppressedCount, 2);
  assert.equal(fourth.totalOccurrences, 4);

  const logRes = logSanitizedOperationalEvent({
    level: "error",
    scope: "workflow.automation",
    action: "sweep_failed",
    message: "Connection failed for admin@example.com with key re_abcdef123456",
    metadata: { secretToken: "top-secret", retryCount: 2 },
    silentConsole: true,
  });
  assert.equal(logRes.logged, true);
  assert.equal(logRes.entry.metadata.secretToken, "[REDACTED_SECRET]");
  assert.doesNotMatch(logRes.entry.message, /admin@example\.com/);
});

test("Platform integration status reports configuration presence without leaking secret values", () => {
  const fakeEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://isgoypmebtoipfvtaflg.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testkey12345",
    SUPABASE_SECRET_KEY: "sb_secret_super_sensitive_value_do_not_leak",
    RESEND_API_KEY: "re_super_sensitive_resend_key_do_not_leak",
    TRANSACTIONAL_EMAIL_FROM: "notifications@thecodexthrill.com",
    CRON_SECRET: "cron_super_sensitive_secret_value_999",
    SUPABASE_CUSTOM_SMTP_CONFIGURED: "true",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  };

  const status = resolvePlatformIntegrationStatus(fakeEnv);
  const serialized = JSON.stringify(status);

  assert.doesNotMatch(serialized, /sb_secret_super_sensitive_value_do_not_leak/);
  assert.doesNotMatch(serialized, /re_super_sensitive_resend_key_do_not_leak/);
  assert.doesNotMatch(serialized, /cron_super_sensitive_secret_value_999/);
  assert.doesNotMatch(serialized, /sb_publishable_testkey12345/);

  assert.equal(status.supabaseCloud.status, "configured");
  assert.equal(status.transactionalEmail.status, "configured");
  assert.equal(status.workflowScheduler.status, "configured");
  assert.equal(status.authSmtp.status, "configured");
  assert.equal(status.webPush.status, "unconfigured");
});

test("Automation job health detects consecutive failures, degraded runs, and healthy sweeps", () => {
  const unavailableHealth = evaluateAutomationJobHealth(null, true);
  assert.equal(unavailableHealth.healthStatus, "unavailable");

  const failingHealth = evaluateAutomationJobHealth(
    [
      {
        id: "a-1",
        occurred_at: "2026-10-10T11:00:00Z",
        action: "workflow.automation_failed",
        details: { errorSummary: "Timeout with Bearer secret_token_123" },
      },
      {
        id: "a-2",
        occurred_at: "2026-10-10T10:00:00Z",
        action: "workflow.automation_failed",
        details: { errorSummary: "Database error" },
      },
    ],
    true
  );
  assert.equal(failingHealth.healthStatus, "failing");
  assert.equal(failingHealth.consecutiveFailures, 2);
  assert.doesNotMatch(failingHealth.recentSanitizedErrors.join(" "), /secret_token_123/);

  const healthySweep = evaluateAutomationJobHealth(
    [
      {
        id: "a-3",
        occurred_at: "2026-10-10T12:00:00Z",
        action: "workflow.automation_sweep",
        details: {
          dispatchSummary: { inserted: 3, duplicatesSuppressed: 1, errors: 0, queryErrors: 0 },
        },
      },
    ],
    true
  );
  assert.equal(healthySweep.healthStatus, "healthy");
  assert.equal(healthySweep.consecutiveFailures, 0);
  assert.equal(healthySweep.totalInsertedNotifications, 3);
});

test("CSV export endpoint and Phase 5 migration enforce RBAC, MFA AAL2, and non-destructive indexing", () => {
  const exportRoute = readFileSync("src/app/api/admin/analytics/export/route.ts", "utf8");
  assert.match(exportRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(exportRoute, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(exportRoute, /currentLevel !== "aal2"/);
  assert.match(exportRoute, /platform_super_admin_designation/);
  assert.match(exportRoute, /r\.role === "platform_admin"/);
  assert.match(exportRoute, /dataset_unavailable/);
  assert.match(exportRoute, /analytics\.report_exported/);

  const phase5Migration = readFileSync(
    "supabase/migrations/20261010120000_phase5_analytics_observability_indexes.sql",
    "utf8"
  );
  assert.match(phase5Migration, /create index if not exists platform_sales_leads_analytics_created_lookup/);
  assert.match(phase5Migration, /create index if not exists tenant_tasks_open_due_date_lookup/);
  assert.match(phase5Migration, /create index if not exists tenant_invoices_analytics_created_lookup/);
  assert.match(phase5Migration, /create index if not exists audit_events_platform_automation_lookup/);
  assert.doesNotMatch(phase5Migration, /drop\s+table|truncate|delete\s+from|alter\s+table.*disable\s+row\s+level\s+security/i);
});
