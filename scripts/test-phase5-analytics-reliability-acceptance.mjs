import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import {
  buildExecutiveCsvReport,
  computeCommercialExecutiveAnalytics,
  computeDeliveryExecutiveAnalytics,
  computeLeadExecutiveAnalytics,
  computeOrganizationExecutiveAnalytics,
  computeSupportExecutiveAnalytics,
  resolveAnalyticsDateWindow,
} from "../src/lib/supabase/executive-analytics-helper.ts";
import {
  evaluateAutomationJobHealth,
  resolvePlatformIntegrationStatus,
} from "../src/lib/supabase/platform-health-helper.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Missing required Supabase Cloud environment variables.", {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(anonKey),
    hasServiceKey: Boolean(serviceKey),
  });
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runPhase5Acceptance() {
  console.log("==================================================================");
  console.log("PHASE 5: EXECUTIVE ANALYTICS & PLATFORM RELIABILITY ACCEPTANCE TEST");
  console.log("Target: Supabase Cloud (isgoypmebtoipfvtaflg)");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function check(name, condition, detail = "") {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed += 1;
    } else {
      console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
      failed += 1;
    }
  }

  const runId = `p5-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanup = {
    userIds: [],
    leadIds: [],
    orgIds: [],
    projectIds: [],
    taskIds: [],
    invoiceIds: [],
    ticketIds: [],
    auditIds: [],
  };

  try {
    const now = new Date();
    const yesterdayDate = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const tomorrowDate = new Date(now.getTime() + 1 * 86400000).toISOString().slice(0, 10);
    const nextMonthDate = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    // 1. Create two isolated tenant users & organizations for cross-tenant isolation verification
    const alphaEmail = `phase5.alpha.${runId}@example.com`;
    const betaEmail = `phase5.beta.${runId}@example.com`;
    const password = `Phase5!Safe#${runId}`;

    const [alphaUserRes, betaUserRes] = await Promise.all([
      adminClient.auth.admin.createUser({
        email: alphaEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Phase 5 Alpha Client" },
      }),
      adminClient.auth.admin.createUser({
        email: betaEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Phase 5 Beta Client" },
      }),
    ]);

    if (alphaUserRes.data?.user?.id) cleanup.userIds.push(alphaUserRes.data.user.id);
    if (betaUserRes.data?.user?.id) cleanup.userIds.push(betaUserRes.data.user.id);

    check(
      "Isolated test users provisioned in Supabase Cloud Auth",
      Boolean(alphaUserRes.data?.user?.id && betaUserRes.data?.user?.id),
      alphaUserRes.error?.message || betaUserRes.error?.message || ""
    );

    const alphaUserId = alphaUserRes.data.user.id;
    const betaUserId = betaUserRes.data.user.id;

    const [orgAlphaRes, orgBetaRes] = await Promise.all([
      adminClient
        .from("organizations")
        .insert({
          name: `Phase 5 Alpha Org ${runId}`,
          status: "active",
        })
        .select("id, name, status, created_at")
        .single(),
      adminClient
        .from("organizations")
        .insert({
          name: `Phase 5 Beta Org ${runId}`,
          status: "active",
        })
        .select("id, name, status, created_at")
        .single(),
    ]);

    if (orgAlphaRes.data?.id) cleanup.orgIds.push(orgAlphaRes.data.id);
    if (orgBetaRes.data?.id) cleanup.orgIds.push(orgBetaRes.data.id);

    check(
      "Isolated test organizations created in Supabase Cloud",
      Boolean(orgAlphaRes.data?.id && orgBetaRes.data?.id),
      orgAlphaRes.error?.message || orgBetaRes.error?.message || ""
    );

    const orgAlphaId = orgAlphaRes.data.id;
    const orgBetaId = orgBetaRes.data.id;

    // 2. Create isolated CRM leads, projects, tasks, invoices, support tickets, and notifications
    const leadsInsert = await adminClient
      .from("platform_sales_leads")
      .insert([
        {
          contact_name: `Lead Converted ${runId}`,
          email: `lead1.${runId}@example.com`,
          company_name: "Alpha Prospect",
          stage: "converted",
          source: "referral",
          message: "Phase 5 acceptance test lead 1",
        },
        {
          contact_name: `Lead Overdue Followup ${runId}`,
          email: `lead2.${runId}@example.com`,
          company_name: "Beta Prospect",
          stage: "qualified",
          source: "website",
          follow_up_at: new Date(now.getTime() - 3600 * 1000).toISOString(),
          message: "Phase 5 acceptance test lead 2",
        },
      ])
      .select("id, stage, source, follow_up_at, created_at");

    for (const l of leadsInsert.data ?? []) cleanup.leadIds.push(l.id);
    check(
      "Isolated CRM leads inserted with stage, source, and follow_up_at",
      (leadsInsert.data?.length ?? 0) === 2,
      leadsInsert.error?.message || ""
    );

    const [projAlphaRes, projBetaRes] = await Promise.all([
      adminClient
        .from("tenant_projects")
        .insert({
          organization_id: orgAlphaId,
          name: `Alpha Delivery Project ${runId}`,
          status: "in_progress",
          progress_pct: 65,
          target_date: yesterdayDate, // overdue project target
        })
        .select("id, organization_id, name, status, progress_pct, target_date, created_at")
        .single(),
      adminClient
        .from("tenant_projects")
        .insert({
          organization_id: orgBetaId,
          name: `Beta Secret Project ${runId}`,
          status: "completed",
          progress_pct: 100,
          target_date: nextMonthDate,
        })
        .select("id, organization_id, name, status, progress_pct, target_date, created_at")
        .single(),
    ]);

    if (projAlphaRes.data?.id) cleanup.projectIds.push(projAlphaRes.data.id);
    if (projBetaRes.data?.id) cleanup.projectIds.push(projBetaRes.data.id);

    const tasksInsert = await adminClient
      .from("tenant_tasks")
      .insert([
        {
          project_id: projAlphaRes.data.id,
          organization_id: orgAlphaId,
          title: `Overdue Security Deliverable ${runId}`,
          status: "in_progress",
          priority: "urgent",
          due_date: yesterdayDate,
        },
        {
          project_id: projAlphaRes.data.id,
          organization_id: orgAlphaId,
          title: `Upcoming 24h Deliverable ${runId}`,
          status: "todo",
          priority: "high",
          due_date: tomorrowDate,
        },
      ])
      .select("id, project_id, organization_id, title, status, priority, assigned_to, due_date, created_at");

    for (const t of tasksInsert.data ?? []) cleanup.taskIds.push(t.id);
    check(
      "Isolated overdue and upcoming tasks inserted in Supabase Cloud",
      (tasksInsert.data?.length ?? 0) === 2,
      tasksInsert.error?.message || ""
    );

    const invoicesInsert = await adminClient
      .from("tenant_invoices")
      .insert([
        // Draft invoice ($400) — must not count in Booked Value or Receivables
        {
          organization_id: orgAlphaId,
          invoice_number: `P5-DRAFT-${runId}`,
          amount_cents: 40000,
          currency: "USD",
          status: "draft",
          due_date: nextMonthDate,
          items: [],
        },
        // Issued unpaid invoice ($1,000) — Booked $1,000, Verified Collected $0, Current Receivable $1,000
        {
          organization_id: orgAlphaId,
          invoice_number: `P5-ISSUED-${runId}`,
          amount_cents: 100000,
          currency: "USD",
          status: "sent",
          due_date: nextMonthDate,
          items: [{ kind: "line_item", description: "Retainer", amount_cents: 100000 }],
        },
        // Partially paid invoice ($1,500 total, $600 verified payment) — Booked $1,500, Verified Collected $600, Current Receivable $900
        {
          organization_id: orgAlphaId,
          invoice_number: `P5-PARTIAL-${runId}`,
          amount_cents: 150000,
          currency: "USD",
          status: "sent",
          due_date: nextMonthDate,
          items: [
            { kind: "line_item", description: "Milestone 1", amount_cents: 150000 },
            {
              kind: "payment_record",
              amount_cents: 60000,
              method: "wire_transfer",
              reference: `WIRE-${runId}`,
              recorded_at: now.toISOString(),
            },
          ],
        },
        // Overdue invoice on Beta Org ($900) — Booked $900, Verified Collected $0, Overdue Receivable $900
        {
          organization_id: orgBetaId,
          invoice_number: `P5-OVERDUE-${runId}`,
          amount_cents: 90000,
          currency: "USD",
          status: "overdue",
          due_date: yesterdayDate,
          items: [{ kind: "line_item", description: "Overdue Sprint", amount_cents: 90000 }],
        },
      ])
      .select("id, organization_id, invoice_number, amount_cents, status, currency, due_date, paid_at, created_at, items");

    for (const inv of invoicesInsert.data ?? []) cleanup.invoiceIds.push(inv.id);
    check(
      "Isolated commercial invoices (draft, issued, partially paid, overdue) created in Supabase Cloud",
      (invoicesInsert.data?.length ?? 0) === 4,
      invoicesInsert.error?.message || ""
    );

    const [ticketAlphaRes, ticketBetaRes] = await Promise.all([
      adminClient
        .from("support_tickets")
        .insert({
          ticket_number: `P5-TKT-A-${runId}`,
          organization_id: orgAlphaId,
          customer_id: alphaUserId,
          title: `=SUM(1+1) Urgent Formula Test Ticket ${runId}`,
          category: "technical",
          priority: "urgent",
          status: "new",
        })
        .select("id, ticket_number, title, status, priority, category, assigned_to, resolved_at, created_at")
        .single(),
      adminClient
        .from("support_tickets")
        .insert({
          ticket_number: `P5-TKT-B-${runId}`,
          organization_id: orgBetaId,
          customer_id: betaUserId,
          title: `Beta Resolved Billing Ticket ${runId}`,
          category: "billing",
          priority: "medium",
          status: "resolved",
        })
        .select("id, ticket_number, title, status, priority, category, assigned_to, resolved_at, created_at")
        .single(),
    ]);

    if (ticketAlphaRes.data?.id) cleanup.ticketIds.push(ticketAlphaRes.data.id);
    if (ticketBetaRes.data?.id) cleanup.ticketIds.push(ticketBetaRes.data.id);
    check(
      "Isolated Alpha (urgent open) and Beta (resolved) support tickets created in Supabase Cloud",
      Boolean(ticketAlphaRes.data?.id && ticketBetaRes.data?.id),
      ticketAlphaRes.error?.message || ticketBetaRes.error?.message || ""
    );

    // 3. Verify Anonymous & Cross-Tenant Access Rejection under Supabase Cloud RLS
    const [anonLeads, anonInvoices, anonAudit] = await Promise.all([
      anonClient.from("platform_sales_leads").select("id").in("id", cleanup.leadIds),
      anonClient.from("tenant_invoices").select("id").in("id", cleanup.invoiceIds),
      anonClient.from("audit_events").select("id").limit(5),
    ]);

    check(
      "RLS Security: Anonymous client is blocked from reading platform_sales_leads",
      Boolean(anonLeads.error || (anonLeads.data ?? []).length === 0)
    );
    check(
      "RLS Security: Anonymous client is blocked from reading tenant_invoices",
      Boolean(anonInvoices.error || (anonInvoices.data ?? []).length === 0)
    );
    check(
      "RLS Security: Anonymous client is blocked from reading audit_events",
      Boolean(anonAudit.error || (anonAudit.data ?? []).length === 0)
    );

    // Sign in as Alpha Client and verify cross-tenant & role isolation
    const alphaClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signInRes = await alphaClient.auth.signInWithPassword({
      email: alphaEmail,
      password,
    });
    check("Tenant Auth: Alpha client signed in successfully", Boolean(signInRes.data?.session));

    const [
      alphaOwnTicket,
      alphaCrossTenantTicket,
      alphaCrossTenantInvoices,
      alphaSalesLeads,
      alphaStaffRpc,
      alphaInvitesRpc,
    ] = await Promise.all([
      alphaClient.from("support_tickets").select("id").eq("id", ticketAlphaRes.data.id),
      alphaClient.from("support_tickets").select("id").eq("id", ticketBetaRes.data.id),
      alphaClient.from("tenant_invoices").select("id, organization_id").eq("organization_id", orgBetaId),
      alphaClient.from("platform_sales_leads").select("id").in("id", cleanup.leadIds),
      alphaClient.rpc("list_platform_users"),
      alphaClient.rpc("list_platform_invitations"),
    ]);

    check(
      "RLS Tenant Isolation: Alpha client can read own support ticket",
      (alphaOwnTicket.data?.length ?? 0) === 1
    );
    check(
      "RLS Cross-Tenant Rejection: Alpha client cannot read Beta support ticket (0 rows)",
      (alphaCrossTenantTicket.data ?? []).length === 0
    );
    check(
      "RLS Cross-Tenant Rejection: Alpha client cannot read Beta organization invoices (0 rows)",
      (alphaCrossTenantInvoices.data ?? []).length === 0
    );
    check(
      "RLS Role Restriction: Client user cannot read platform_sales_leads",
      Boolean(alphaSalesLeads.error || (alphaSalesLeads.data ?? []).length === 0)
    );
    check(
      "RPC Governance Restriction: Client user is rejected by list_platform_users and list_platform_invitations RPCs",
      Boolean(alphaStaffRpc.error && alphaInvitesRpc.error)
    );

    // 4. Verify Phase 5 Executive Analytics Calculations on the Isolated Cloud Records
    const window = resolveAnalyticsDateWindow({ preset: "30d", now });
    const leadMetrics = computeLeadExecutiveAnalytics(leadsInsert.data, window, now);
    const orgMetrics = computeOrganizationExecutiveAnalytics(
      [orgAlphaRes.data, orgBetaRes.data],
      [
        { organization_id: orgAlphaId, user_id: alphaUserId, status: "active" },
        { organization_id: orgBetaId, user_id: betaUserId, status: "active" },
      ],
      window
    );
    const deliveryMetrics = computeDeliveryExecutiveAnalytics(
      [projAlphaRes.data, projBetaRes.data],
      tasksInsert.data,
      window,
      now
    );
    const commercialMetrics = computeCommercialExecutiveAnalytics(invoicesInsert.data, window);
    const supportMetrics = computeSupportExecutiveAnalytics(
      [ticketAlphaRes.data, ticketBetaRes.data],
      window
    );

    check(
      "Executive Leads Math: 2 new leads, 1 converted (50%), 1 overdue follow-up",
      leadMetrics?.totalLeads === 2 &&
        leadMetrics?.convertedLeads === 1 &&
        leadMetrics?.conversionRatePct === 50 &&
        leadMetrics?.followUpHealth.overdueCount === 1
    );

    check(
      "Executive Orgs Math: 2 active organizations and 2 active client memberships",
      orgMetrics?.activeOrganizations === 2 &&
        orgMetrics?.activeClientMembershipsCount === 2
    );

    check(
      "Executive Delivery Math: 1 overdue task and 1 upcoming 48h/7d task identified",
      deliveryMetrics.tasks?.overdueTasksCount === 1 &&
        deliveryMetrics.tasks?.upcoming48hTasksCount === 1 &&
        deliveryMetrics.projects?.overdueTargetProjectsCount === 1
    );

    // Commercial verification:
    // Draft = $400 (40,000c)
    // Booked = $1,000 + $1,500 + $900 = $3,400 (340,000c)
    // Verified Collected = $600 (60,000c) strictly from payment_record
    // Current Receivables = $1,000 + $900 = $1,900 (190,000c)
    // Overdue Receivables = $900 (90,000c)
    // Total Outstanding = $2,800 (280,000c)
    check(
      "Commercial Integrity: Booked Invoice Value ($3,400) excludes draft ($400)",
      commercialMetrics?.bookedInvoiceCents === 340000 &&
        commercialMetrics?.draftInvoiceCents === 40000
    );
    check(
      "Commercial Integrity: Verified Collected Payments ($600) strictly reflects payment_record and never counts issued unpaid invoices",
      commercialMetrics?.verifiedCollectedCents === 60000 &&
        commercialMetrics?.verifiedPaymentRecordsCount === 1
    );
    check(
      "Commercial Integrity: Outstanding Balance ($2,800) separates Current ($1,900) and Overdue Receivables ($900)",
      commercialMetrics?.outstandingBalanceCents === 280000 &&
        commercialMetrics?.currentReceivablesCents === 190000 &&
        commercialMetrics?.overdueReceivablesCents === 90000
    );

    check(
      "Support SLA Math: Identifies 1 open urgent/high-priority ticket and 50% resolution rate across 2 tickets",
      supportMetrics?.totalTickets === 2 &&
        supportMetrics?.openTicketsCount === 1 &&
        supportMetrics?.highPriorityOpenCount === 1 &&
        supportMetrics?.urgentOpenCount === 1 &&
        supportMetrics?.resolutionRatePct === 50
    );

    // 5. Verify CSV Formula Injection Neutralization & Unavailable State Integrity
    const supportCsv = buildExecutiveCsvReport({
      reportType: "support",
      window,
      now,
      data: {
        leads: leadsInsert.data,
        organizations: [orgAlphaRes.data, orgBetaRes.data],
        staffCount: 2,
        pendingInvitesCount: 0,
        projects: [projAlphaRes.data, projBetaRes.data],
        tasks: tasksInsert.data,
        invoices: invoicesInsert.data,
        tickets: [ticketAlphaRes.data, ticketBetaRes.data],
      },
    });

    check(
      "CSV Formula Injection Protection: Ticket title starting with '=SUM(1+1)' is neutralized with leading apostrophe",
      supportCsv.csvContent.includes(`"'=SUM(1+1) Urgent Formula Test Ticket ${runId}"`)
    );

    // 6. Verify Automation Audit Observability against Live audit_events Table
    const auditInsert = await adminClient
      .from("audit_events")
      .insert({
        scope: "platform",
        action: "workflow.automation_sweep",
        target_type: "workflow_automation",
        target_id: runId,
        details: {
          triggeredBy: "admin_manual",
          evaluatedCounts: {
            leadsChecked: 2,
            tasksChecked: 2,
            invoicesChecked: 4,
            ticketsChecked: 2,
            invitationsChecked: 0,
            totalCandidates: 3,
          },
          dispatchSummary: {
            inserted: 2,
            duplicatesSuppressed: 1,
            skippedByPreference: 0,
            errors: 0,
            queryErrors: 0,
          },
        },
      })
      .select("id, occurred_at, action, details")
      .single();

    if (auditInsert.data?.id) cleanup.auditIds.push(auditInsert.data.id);

    const jobHealth = evaluateAutomationJobHealth(
      auditInsert.data ? [auditInsert.data] : null,
      true
    );
    check(
      "Platform Observability: Automation sweep audit event evaluates as healthy with accurate dispatch counts",
      jobHealth.healthStatus === "healthy" &&
        jobHealth.totalInsertedNotifications === 2 &&
        jobHealth.totalSuppressedDuplicates === 1
    );

    const integrationStatus = resolvePlatformIntegrationStatus(process.env);
    const statusJson = JSON.stringify(integrationStatus);
    check(
      "Platform Health Security: Integration status reports Supabase Cloud configured without leaking SUPABASE_SECRET_KEY",
      integrationStatus.supabaseCloud.status === "configured" &&
        !statusJson.includes(serviceKey)
    );
  } finally {
    console.log("------------------------------------------------------------------");
    console.log("Cleaning up isolated Phase 5 acceptance test records...");
    if (cleanup.taskIds.length > 0) {
      await adminClient.from("tenant_tasks").delete().in("id", cleanup.taskIds);
    }
    if (cleanup.invoiceIds.length > 0) {
      await adminClient.from("tenant_invoices").delete().in("id", cleanup.invoiceIds);
    }
    if (cleanup.ticketIds.length > 0) {
      await adminClient.from("support_tickets").delete().in("id", cleanup.ticketIds);
    }
    if (cleanup.projectIds.length > 0) {
      await adminClient.from("tenant_projects").delete().in("id", cleanup.projectIds);
    }
    if (cleanup.orgIds.length > 0) {
      await adminClient.from("audit_events").delete().in("organization_id", cleanup.orgIds);
      await adminClient.from("organizations").delete().in("id", cleanup.orgIds);
    }
    if (cleanup.leadIds.length > 0) {
      await adminClient.from("platform_sales_leads").delete().in("id", cleanup.leadIds);
    }
    if (cleanup.auditIds.length > 0) {
      await adminClient.from("audit_events").delete().in("id", cleanup.auditIds);
    }
    if (cleanup.userIds.length > 0) {
      await adminClient.from("profiles").delete().in("id", cleanup.userIds);
      for (const uid of cleanup.userIds) {
        await adminClient.auth.admin.deleteUser(uid);
      }
    }
    console.log("Isolated test records cleaned up.");
  }

  console.log("==================================================================");
  console.log(`PHASE 5 ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Acceptance().catch((err) => {
  console.error("Unhandled acceptance test error:", err);
  process.exit(1);
});
