import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type AnalyticsPeriodPreset,
  type AnalyticsReportType,
  type ExecutiveAnalyticsDataset,
  buildExecutiveCsvReport,
  resolveAnalyticsDateWindow,
} from "@/lib/supabase/executive-analytics-helper";
import {
  type AutomationAuditRecord,
  logSanitizedOperationalEvent,
  resolvePlatformIntegrationStatus,
} from "@/lib/supabase/platform-health-helper";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_PRESETS = new Set<AnalyticsPeriodPreset>([
  "7d",
  "30d",
  "90d",
  "365d",
  "all",
  "custom",
]);

const ALLOWED_REPORTS = new Set<AnalyticsReportType>([
  "executive_summary",
  "leads",
  "invoices",
  "projects_tasks",
  "support",
]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }

  const [platformRolesRes, superAdminRes, assuranceRes] = await Promise.all([
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
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const isAuthorizedAdmin = Boolean(
    superAdminRes.data ||
      platformRolesRes.data?.some((r) => r.role === "platform_admin"),
  );

  if (!isAuthorizedAdmin) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "analytics.export",
      action: "unauthorized_role",
      message: "Rejected analytics CSV export for account without platform admin authority",
      metadata: { userId: user.id },
      throttleKey: `analytics.export.unauthorized.${user.id}`,
    });
    return NextResponse.json(
      { ok: false, error: "forbidden_role" },
      { status: 403 },
    );
  }

  if (assuranceRes.data?.currentLevel !== "aal2") {
    return NextResponse.json(
      { ok: false, error: "mfa_aal2_required" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const rawReport = (url.searchParams.get("report") || "executive_summary") as AnalyticsReportType;
  const reportType: AnalyticsReportType = ALLOWED_REPORTS.has(rawReport)
    ? rawReport
    : "executive_summary";

  const rawRange = (url.searchParams.get("range") || "all") as AnalyticsPeriodPreset;
  const preset: AnalyticsPeriodPreset = ALLOWED_PRESETS.has(rawRange)
    ? rawRange
    : "all";

  const customStart = url.searchParams.get("start");
  const customEnd = url.searchParams.get("end");

  const window = resolveAnalyticsDateWindow({
    preset,
    customStart,
    customEnd,
  });

  const adminClient = createAdminClient();
  const [
    leadsResult,
    orgsResult,
    membershipsResult,
    usersResult,
    invitesResult,
    projectsResult,
    tasksResult,
    invoicesResult,
    ticketsResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("platform_sales_leads")
      .select("id, stage, source, follow_up_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("organizations")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    adminClient
      .from("organization_memberships")
      .select("organization_id, status")
      .eq("status", "active")
      .limit(1000),
    supabase.rpc("list_platform_users"),
    supabase.rpc("list_platform_invitations"),
    supabase
      .from("tenant_projects")
      .select("id, organization_id, name, status, progress_pct, target_date, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tenant_tasks")
      .select("id, project_id, organization_id, title, status, priority, assigned_to, due_date, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("tenant_invoices")
      .select("id, organization_id, invoice_number, amount_cents, status, currency, due_date, paid_at, created_at, items")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("support_tickets")
      .select("id, ticket_number, title, status, priority, category, assigned_to, resolved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    adminClient
      .from("audit_events")
      .select("id, occurred_at, action, details")
      .eq("scope", "platform")
      .in("action", ["workflow.automation_sweep", "workflow.automation_failed"])
      .order("occurred_at", { ascending: false })
      .limit(25),
  ]);

  // Never produce false-success CSV exports when required underlying dataset failed
  if (
    (reportType === "leads" && leadsResult.error) ||
    (reportType === "invoices" && invoicesResult.error) ||
    (reportType === "projects_tasks" && (projectsResult.error || tasksResult.error)) ||
    (reportType === "support" && ticketsResult.error)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "dataset_unavailable",
        message: "The requested analytics dataset could not be retrieved from Supabase Cloud.",
      },
      { status: 502 },
    );
  }

  const integrationStatus = resolvePlatformIntegrationStatus(
    process.env as Record<string, string | undefined>,
  );

  const invitationsList = invitesResult.error
    ? null
    : ((invitesResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["invitations"]>);

  const dataset: ExecutiveAnalyticsDataset = {
    leads: leadsResult.error
      ? null
      : ((leadsResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["leads"]>),
    organizations: orgsResult.error
      ? null
      : ((orgsResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["organizations"]>),
    memberships: membershipsResult.error
      ? null
      : ((membershipsResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["memberships"]>),
    staffCount: usersResult.error
      ? null
      : ((usersResult.data ?? []) as unknown[]).length,
    pendingInvitesCount: invitationsList
      ? invitationsList.filter((i) => i.status === "pending" && !i.archived_at).length
      : null,
    invitations: invitationsList,
    projects: projectsResult.error
      ? null
      : ((projectsResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["projects"]>),
    tasks: tasksResult.error
      ? null
      : ((tasksResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["tasks"]>),
    invoices: invoicesResult.error
      ? null
      : ((invoicesResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["invoices"]>),
    tickets: ticketsResult.error
      ? null
      : ((ticketsResult.data ?? []) as NonNullable<ExecutiveAnalyticsDataset["tickets"]>),
    automationAuditEvents: auditResult.error
      ? null
      : ((auditResult.data ?? []) as AutomationAuditRecord[]),
    integrationStatus,
  };

  const { filename, csvContent } = buildExecutiveCsvReport({
    reportType,
    data: dataset,
    window,
  });

  try {
    await adminClient.from("audit_events").insert({
      actor_user_id: user.id,
      scope: "platform",
      action: "analytics.report_exported",
      target_type: "analytics_report",
      target_id: reportType,
      details: {
        reportType,
        periodPreset: preset,
        periodLabel: window.label,
      },
    });
  } catch {
    // Non-fatal
  }

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

