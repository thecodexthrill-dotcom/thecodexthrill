"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  FolderKanban,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ArrowRight,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Activity,
  Server,
  Mail,
  Bell,
  Filter,
} from "lucide-react";
import {
  type AnalyticsInvoiceRecord,
  type AnalyticsInvitationRecord,
  type AnalyticsLeadRecord,
  type AnalyticsMembershipRecord,
  type AnalyticsNotificationRecord,
  type AnalyticsOrgRecord,
  type AnalyticsPeriodPreset,
  type AnalyticsProjectRecord,
  type AnalyticsReportType,
  type AnalyticsTaskRecord,
  type AnalyticsTicketRecord,
  type ExecutiveAnalyticsDataset,
  buildExecutiveCsvReport,
  computeCommercialExecutiveAnalytics,
  computeDeliveryExecutiveAnalytics,
  computeGovernanceAndOperationsAnalytics,
  computeLeadExecutiveAnalytics,
  computeOrganizationExecutiveAnalytics,
  computeSupportExecutiveAnalytics,
  formatAnalyticsCurrency,
  resolveAnalyticsDateWindow,
} from "@/lib/supabase/executive-analytics-helper";

export type AnalyticsLead = AnalyticsLeadRecord;
export type AnalyticsOrg = AnalyticsOrgRecord;
export type AnalyticsProject = AnalyticsProjectRecord;
export type AnalyticsTask = AnalyticsTaskRecord;
export type AnalyticsInvoice = AnalyticsInvoiceRecord;
export type AnalyticsTicket = AnalyticsTicketRecord;
export type AnalyticsMembership = AnalyticsMembershipRecord;
export type AnalyticsInvitation = AnalyticsInvitationRecord;
export type AnalyticsNotification = AnalyticsNotificationRecord;
export type AnalyticsData = ExecutiveAnalyticsDataset;

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const [timeRange, setTimeRange] = useState<AnalyticsPeriodPreset>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [exportReportType, setExportReportType] =
    useState<AnalyticsReportType>("executive_summary");
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const dateWindow = useMemo(
    () =>
      resolveAnalyticsDateWindow({
        preset: timeRange,
        customStart: customStart || null,
        customEnd: customEnd || null,
      }),
    [timeRange, customStart, customEnd],
  );

  const leadAnalytics = useMemo(
    () => computeLeadExecutiveAnalytics(data.leads, dateWindow),
    [data.leads, dateWindow],
  );

  const orgAnalytics = useMemo(
    () =>
      computeOrganizationExecutiveAnalytics(
        data.organizations,
        data.memberships,
        dateWindow,
      ),
    [data.organizations, data.memberships, dateWindow],
  );

  const deliveryAnalytics = useMemo(
    () =>
      computeDeliveryExecutiveAnalytics(
        data.projects,
        data.tasks,
        dateWindow,
      ),
    [data.projects, data.tasks, dateWindow],
  );

  const commercialAnalytics = useMemo(
    () => computeCommercialExecutiveAnalytics(data.invoices, dateWindow),
    [data.invoices, dateWindow],
  );

  const supportAnalytics = useMemo(
    () => computeSupportExecutiveAnalytics(data.tickets, dateWindow),
    [data.tickets, dateWindow],
  );

  const schedulerConfigured =
    data.integrationStatus?.workflowScheduler.status === "configured";

  const governanceAnalytics = useMemo(
    () =>
      computeGovernanceAndOperationsAnalytics({
        staffCount: data.staffCount,
        pendingInvitesCount: data.pendingInvitesCount,
        invitations: data.invitations,
        notifications: data.notifications,
        automationAuditEvents: data.automationAuditEvents,
        schedulerConfigured: Boolean(schedulerConfigured),
      }),
    [
      data.staffCount,
      data.pendingInvitesCount,
      data.invitations,
      data.notifications,
      data.automationAuditEvents,
      schedulerConfigured,
    ],
  );

  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams({
      report: exportReportType,
      range: timeRange,
    });
    if (timeRange === "custom") {
      if (customStart) params.set("start", customStart);
      if (customEnd) params.set("end", customEnd);
    }
    return params.toString();
  }, [exportReportType, timeRange, customStart, customEnd]);

  const handleInstantCsvDownload = () => {
    const allPrimaryUnavailable =
      data.leads === null &&
      data.organizations === null &&
      data.projects === null &&
      data.tasks === null &&
      data.invoices === null &&
      data.tickets === null;

    // Check if the required dataset for this report is unavailable
    if (
      (exportReportType === "executive_summary" && allPrimaryUnavailable) ||
      (exportReportType === "leads" && data.leads === null) ||
      (exportReportType === "invoices" && data.invoices === null) ||
      (exportReportType === "projects_tasks" &&
        (data.projects === null || data.tasks === null)) ||
      (exportReportType === "support" && data.tickets === null)
    ) {
      setExportStatus("Export blocked: underlying dataset is currently unavailable.");
      return;
    }

    const { filename, csvContent } = buildExecutiveCsvReport({
      reportType: exportReportType,
      data,
      window: dateWindow,
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportStatus(`Exported ${filename} (formula-injection sanitized).`);
  };

  const maxLeadBucketCount = useMemo(() => {
    if (!leadAnalytics || leadAnalytics.trendSeries.length === 0) return 1;
    return Math.max(
      1,
      ...leadAnalytics.trendSeries.map((b) => Math.max(b.newLeads, b.convertedLeads)),
    );
  }, [leadAnalytics]);

  const maxRevenueBucketCents = useMemo(() => {
    if (!commercialAnalytics || commercialAnalytics.revenueTrendSeries.length === 0) {
      return 100;
    }
    return Math.max(
      100,
      ...commercialAnalytics.revenueTrendSeries.map((b) =>
        Math.max(
          b.bookedInvoiceCents,
          b.verifiedCollectedCents,
          b.overdueReceivablesCents,
        ),
      ),
    );
  }, [commercialAnalytics]);

  const integrationItems = useMemo(() => {
    if (!data.integrationStatus) return [];
    return [
      data.integrationStatus.supabaseCloud,
      data.integrationStatus.transactionalEmail,
      data.integrationStatus.authSmtp,
      data.integrationStatus.workflowScheduler,
      data.integrationStatus.webPush,
      data.integrationStatus.storageBucket,
    ];
  }, [data.integrationStatus]);

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {/* Query Errors Alert Banner — Never present missing/error data as zero */}
      {data.queryErrors && data.queryErrors.length > 0 && (
        <section
          className="module-panel"
          role="alert"
          style={{
            border: "1px solid #ef4444",
            background: "color-mix(in srgb, #ef4444 8%, transparent)",
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#ef4444",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            <AlertCircle size={18} />
            <span>
              Operational Query Alert ({data.queryErrors.length} dataset
              {data.queryErrors.length > 1 ? "s" : ""} unavailable)
            </span>
          </div>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "var(--muted)",
            }}
          >
            One or more queries could not be resolved from Supabase Cloud. Affected
            metrics explicitly display &ldquo;Unavailable&rdquo; rather than
            misleading zero values:
          </p>
          <ul
            style={{
              margin: "8px 0 0 20px",
              fontSize: "12px",
              color: "#f87171",
              lineHeight: "1.6",
            }}
          >
            {data.queryErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Executive Header, Date-Range Controls & Authorized CSV Report Export */}
      <section className="module-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <p className="eyebrow">
              EXECUTIVE INTELLIGENCE · BUSINESS ANALYTICS &amp; PLATFORM RELIABILITY
            </p>
            <h2 style={{ margin: "6px 0 8px" }}>
              Executive Decision &amp; Operations Dashboard
            </h2>
            <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>
              Live metrics derived from authorized Supabase Cloud records across CRM,
              Client Delivery, Commercial Billing, Support, and Platform Automation.
            </p>
          </div>

          {/* Date-Range Filter Bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "10px",
            }}
          >
            <div
              role="group"
              aria-label="Analytics time range filter"
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "6px",
                background: "var(--surface)",
                padding: "5px",
                borderRadius: "10px",
                border: "1px solid var(--line)",
              }}
            >
              <Calendar
                size={14}
                style={{ color: "var(--gold)", marginLeft: "6px" }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  fontWeight: 600,
                  marginRight: "2px",
                }}
              >
                Period:
              </span>
              {(
                [
                  ["all", "All Time"],
                  ["7d", "7D"],
                  ["30d", "30D"],
                  ["90d", "90D"],
                  ["365d", "12M"],
                  ["custom", "Custom"],
                ] as const
              ).map(([presetKey, label]) => (
                <button
                  key={presetKey}
                  type="button"
                  aria-pressed={timeRange === presetKey}
                  onClick={() => setTimeRange(presetKey)}
                  style={{
                    background:
                      timeRange === presetKey
                        ? "var(--surface-raised)"
                        : "transparent",
                    color:
                      timeRange === presetKey
                        ? "var(--gold-ink)"
                        : "var(--muted)",
                    border:
                      timeRange === presetKey
                        ? "1px solid var(--line-strong)"
                        : "1px solid transparent",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeRange === "custom" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "6px 10px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              >
                <Filter size={13} style={{ color: "var(--gold)" }} />
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span>From (UTC):</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{
                      padding: "3px 6px",
                      fontSize: "12px",
                      borderRadius: "4px",
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: "var(--foreground)",
                    }}
                  />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span>To (UTC):</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{
                      padding: "3px 6px",
                      fontSize: "12px",
                      borderRadius: "4px",
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: "var(--foreground)",
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Authorized CSV Export Bar */}
        <div
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Download size={15} style={{ color: "var(--gold)" }} />
            <strong style={{ fontSize: "13px" }}>Export Sanitized CSV Report:</strong>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Window: <strong>{dateWindow.label}</strong> · Protected against
              spreadsheet formula injection
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <label htmlFor="analytics-csv-report-select" className="sr-only">
              Select CSV report type
            </label>
            <select
              id="analytics-csv-report-select"
              value={exportReportType}
              onChange={(e) => {
                setExportReportType(e.target.value as AnalyticsReportType);
                setExportStatus(null);
              }}
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid var(--line-strong)",
                background: "var(--surface-raised)",
                color: "var(--foreground)",
              }}
            >
              <option value="executive_summary">
                Executive KPI Summary ({dateWindow.label})
              </option>
              <option value="invoices">
                Commercial Invoices &amp; Verified Payments
              </option>
              <option value="leads">CRM Leads &amp; Acquisition Funnel</option>
              <option value="projects_tasks">
                Projects &amp; Task Delivery Queue
              </option>
              <option value="support">Support Tickets &amp; SLA Queue</option>
            </select>

            <button
              type="button"
              onClick={handleInstantCsvDownload}
              className="button button-secondary button-small"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "6px 12px",
              }}
            >
              <Download size={13} /> Download CSV
            </button>

            <a
              href={`/api/admin/analytics/export?${exportQueryString}`}
              className="button button-gold button-small"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              <ShieldCheck size={13} /> Audited Server Export
            </a>
          </div>
        </div>

        {exportStatus && (
          <p
            role="status"
            style={{
              margin: "10px 0 0",
              fontSize: "12px",
              color: exportStatus.startsWith("Export blocked")
                ? "#f87171"
                : "#4ade80",
            }}
          >
            {exportStatus}
          </p>
        )}

        {/* Executive Primary KPI Grid (6 Decision Cards) */}
        <div
          className="module-stat-grid"
          style={{
            marginTop: "20px",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          }}
        >
          {/* 1. Leads & Conversion */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={14} style={{ color: "var(--gold)" }} /> New Leads
              &amp; Conversion
            </span>
            <strong>
              {leadAnalytics !== null ? leadAnalytics.totalLeads : "Unavailable"}
            </strong>
            <small style={{ display: "block" }}>
              {leadAnalytics === null
                ? "Dataset unavailable"
                : leadAnalytics.conversionRatePct !== null
                  ? `${leadAnalytics.convertedLeads} converted (${leadAnalytics.conversionRatePct}% rate)`
                  : "0 leads in selected period"}
            </small>
            {leadAnalytics !== null && timeRange !== "all" && (
              <small
                style={{
                  display: "block",
                  marginTop: "4px",
                  fontSize: "11px",
                  color:
                    leadAnalytics.leadsComparison.direction === "up"
                      ? "#4ade80"
                      : leadAnalytics.leadsComparison.direction === "down"
                        ? "#f87171"
                        : "var(--muted)",
                }}
              >
                {leadAnalytics.leadsComparison.label}
              </small>
            )}
          </div>

          {/* 2. Active Clients & Organizations */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={14} style={{ color: "var(--gold)" }} /> Active Client
              Orgs
            </span>
            <strong>
              {orgAnalytics !== null
                ? orgAnalytics.activeOrganizations
                : "Unavailable"}
            </strong>
            <small style={{ display: "block" }}>
              {orgAnalytics === null
                ? "Dataset unavailable"
                : orgAnalytics.activeClientMembershipsCount !== null
                  ? `${orgAnalytics.activeClientMembershipsCount} active portal member(s) · ${orgAnalytics.totalOrganizations} total orgs`
                  : `${orgAnalytics.newOrganizationsInPeriod} provisioned in period`}
            </small>
            {orgAnalytics !== null && timeRange !== "all" && (
              <small
                style={{
                  display: "block",
                  marginTop: "4px",
                  fontSize: "11px",
                  color: "var(--muted)",
                }}
              >
                New in period: {orgAnalytics.newOrganizationsInPeriod} (
                {orgAnalytics.newOrgsComparison.label})
              </small>
            )}
          </div>

          {/* 3. Active Projects & Overdue Tasks */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FolderKanban size={14} style={{ color: "var(--gold)" }} />{" "}
              Delivery &amp; Tasks
            </span>
            <strong>
              {deliveryAnalytics.projects !== null
                ? `${deliveryAnalytics.projects.activeProjects} Active`
                : "Unavailable"}
            </strong>
            <small style={{ display: "block" }}>
              {deliveryAnalytics.projects === null
                ? "Projects unavailable"
                : deliveryAnalytics.projects.avgCompletionPct !== null
                  ? `${deliveryAnalytics.projects.avgCompletionPct}% avg completion · ${deliveryAnalytics.projects.completedProjects} completed`
                  : "No projects in selected period"}
            </small>
            <small
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "11px",
                color:
                  deliveryAnalytics.tasks &&
                  deliveryAnalytics.tasks.overdueTasksCount > 0
                    ? "#f87171"
                    : "var(--muted)",
              }}
            >
              {deliveryAnalytics.tasks === null
                ? "Tasks unavailable"
                : `${deliveryAnalytics.tasks.overdueTasksCount} overdue · ${deliveryAnalytics.tasks.upcoming7dTasksCount} due in 7d`}
            </small>
          </div>

          {/* 4. Booked Invoice Value (Issued + Partially Paid + Overdue + Settled) */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CreditCard size={14} style={{ color: "var(--gold)" }} /> Booked
              Invoice Value
            </span>
            <strong>
              {commercialAnalytics !== null
                ? formatAnalyticsCurrency(commercialAnalytics.bookedInvoiceCents)
                : "Unavailable"}
            </strong>
            <small style={{ display: "block" }}>
              {commercialAnalytics === null
                ? "Billing unavailable"
                : `${commercialAnalytics.lifecycleCounts.issued + commercialAnalytics.lifecycleCounts.partially_paid + commercialAnalytics.lifecycleCounts.overdue + commercialAnalytics.lifecycleCounts.settled} active/settled statement(s)`}
            </small>
            {commercialAnalytics !== null && timeRange !== "all" && (
              <small
                style={{
                  display: "block",
                  marginTop: "4px",
                  fontSize: "11px",
                  color: "var(--muted)",
                }}
              >
                {commercialAnalytics.bookedComparison.label}
              </small>
            )}
          </div>

          {/* 5. Verified Collected Payments & Outstanding Receivables */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={14} style={{ color: "#4ade80" }} /> Verified
              Collected Payments
            </span>
            <strong style={{ color: commercialAnalytics !== null ? "#4ade80" : "inherit" }}>
              {commercialAnalytics !== null
                ? formatAnalyticsCurrency(
                    commercialAnalytics.verifiedCollectedCents,
                  )
                : "Unavailable"}
            </strong>
            <small style={{ display: "block" }}>
              {commercialAnalytics === null
                ? "Payments unavailable"
                : `${commercialAnalytics.verifiedPaymentRecordsCount} verified payment record(s)`}
            </small>
            <small
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "11px",
                color:
                  commercialAnalytics &&
                  commercialAnalytics.overdueReceivablesCents > 0
                    ? "#f87171"
                    : "var(--gold)",
              }}
            >
              {commercialAnalytics === null
                ? ""
                : `Outstanding: ${formatAnalyticsCurrency(commercialAnalytics.outstandingBalanceCents)} (${formatAnalyticsCurrency(commercialAnalytics.overdueReceivablesCents)} overdue)`}
            </small>
          </div>

          {/* 6. Support Queue & Automation Health */}
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <LifeBuoy size={14} style={{ color: "var(--gold)" }} /> Support
              &amp; Job Health
            </span>
            <strong>
              {supportAnalytics !== null
                ? `${supportAnalytics.openTicketsCount} Open`
                : "Unavailable"}
            </strong>
            <small
              style={{
                display: "block",
                color:
                  supportAnalytics && supportAnalytics.highPriorityOpenCount > 0
                    ? "#f87171"
                    : "var(--muted)",
              }}
            >
              {supportAnalytics === null
                ? "Support queue unavailable"
                : `${supportAnalytics.highPriorityOpenCount} high/urgent open · ${
                    supportAnalytics.resolutionRatePct !== null
                      ? `${supportAnalytics.resolutionRatePct}% resolved`
                      : "0 tickets in period"
                  }`}
            </small>
            <small
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "11px",
                color:
                  governanceAnalytics.automationHealth.healthStatus === "failing"
                    ? "#f87171"
                    : governanceAnalytics.automationHealth.healthStatus ===
                        "degraded"
                      ? "var(--gold)"
                      : "var(--muted)",
              }}
            >
              Automation: {governanceAnalytics.automationHealth.statusLabel}
            </small>
          </div>
        </div>
      </section>

      {/* Section 1: Commercial Accounting, Verified Payments, Outstanding & Overdue Receivables, and Revenue Trends */}
      <section className="module-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              COMMERCIAL ACCOUNTING &amp; VERIFIED SETTLEMENT LEDGER
            </p>
            <h3 style={{ margin: "4px 0 0", fontSize: "17px" }}>
              Booked Invoice Value vs. Verified Collected Payments &amp; Receivables
            </h3>
          </div>
          <Link
            className="text-link"
            href="/admin/billing"
            style={{
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Open Billing Ledger <ArrowRight size={12} />
          </Link>
        </div>

        {commercialAnalytics === null ? (
          <div
            role="alert"
            style={{
              padding: "24px",
              textAlign: "center",
              border: "1px dashed #ef4444",
              borderRadius: "12px",
              background: "color-mix(in srgb, #ef4444 5%, transparent)",
            }}
          >
            <CreditCard
              size={24}
              style={{ color: "#ef4444", margin: "0 auto 8px" }}
            />
            <p style={{ margin: 0, fontSize: "14px", color: "#f87171" }}>
              Commercial invoice and payment records are unavailable from Supabase
              Cloud under the current session.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            {/* 4 Strict Financial Pillars */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <small
                  style={{
                    color: "var(--subtle)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    display: "block",
                  }}
                >
                  1. Booked Invoice Value
                </small>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "6px 0 4px",
                  }}
                >
                  {formatAnalyticsCurrency(
                    commercialAnalytics.bookedInvoiceCents,
                    { showCents: true },
                  )}
                </p>
                <small style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Issued, Partially Paid, Overdue &amp; Settled (excludes{" "}
                  {commercialAnalytics.lifecycleCounts.draft} draft &amp;{" "}
                  {commercialAnalytics.lifecycleCounts.cancelled} cancelled)
                </small>
              </div>

              <div
                style={{
                  padding: "14px",
                  border: "1px solid rgba(74, 222, 128, 0.35)",
                  borderRadius: "10px",
                  background: "color-mix(in srgb, #4ade80 5%, var(--surface))",
                }}
              >
                <small
                  style={{
                    color: "#4ade80",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  2. Verified Collected Payments
                </small>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "6px 0 4px",
                    color: "#4ade80",
                  }}
                >
                  {formatAnalyticsCurrency(
                    commercialAnalytics.verifiedCollectedCents,
                    { showCents: true },
                  )}
                </p>
                <small style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {commercialAnalytics.verifiedPaymentRecordsCount} audited
                  payment record(s)
                  {commercialAnalytics.collectionRatePct !== null
                    ? ` · ${commercialAnalytics.collectionRatePct}% realization`
                    : ""}
                </small>
              </div>

              <div
                style={{
                  padding: "14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <small
                  style={{
                    color: "var(--gold)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  3. Outstanding Balance (Total)
                </small>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "6px 0 4px",
                    color: "var(--gold)",
                  }}
                >
                  {formatAnalyticsCurrency(
                    commercialAnalytics.outstandingBalanceCents,
                    { showCents: true },
                  )}
                </p>
                <small style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Current (not yet due):{" "}
                  {formatAnalyticsCurrency(
                    commercialAnalytics.currentReceivablesCents,
                    { showCents: true },
                  )}
                </small>
              </div>

              <div
                style={{
                  padding: "14px",
                  border:
                    commercialAnalytics.overdueReceivablesCents > 0
                      ? "1px solid rgba(239, 68, 68, 0.45)"
                      : "1px solid var(--line)",
                  borderRadius: "10px",
                  background:
                    commercialAnalytics.overdueReceivablesCents > 0
                      ? "color-mix(in srgb, #ef4444 6%, var(--surface))"
                      : "var(--surface)",
                }}
              >
                <small
                  style={{
                    color:
                      commercialAnalytics.overdueReceivablesCents > 0
                        ? "#f87171"
                        : "var(--subtle)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  4. Overdue Receivables
                </small>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "6px 0 4px",
                    color:
                      commercialAnalytics.overdueReceivablesCents > 0
                        ? "#f87171"
                        : "var(--muted)",
                  }}
                >
                  {formatAnalyticsCurrency(
                    commercialAnalytics.overdueReceivablesCents,
                    { showCents: true },
                  )}
                </p>
                <small style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {commercialAnalytics.lifecycleCounts.overdue} overdue unpaid +{" "}
                  {commercialAnalytics.lifecycleCounts.overduePartiallyPaid}{" "}
                  overdue partial
                </small>
              </div>
            </div>

            {/* Invoice Lifecycle Status Breakdown & Verified Payment Methods */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: "10px",
                  }}
                >
                  Invoice Lifecycle Distribution:
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    [
                      "Issued (Current)",
                      commercialAnalytics.lifecycleCounts.issued,
                      "var(--foreground)",
                    ],
                    [
                      "Partially Paid",
                      commercialAnalytics.lifecycleCounts.partially_paid,
                      "var(--gold)",
                    ],
                    [
                      "Overdue",
                      commercialAnalytics.lifecycleCounts.overdue,
                      "#f87171",
                    ],
                    [
                      "Settled (Paid)",
                      commercialAnalytics.lifecycleCounts.settled,
                      "#4ade80",
                    ],
                    [
                      "Draft (Unissued)",
                      commercialAnalytics.lifecycleCounts.draft,
                      "var(--muted)",
                    ],
                    [
                      "Cancelled",
                      commercialAnalytics.lifecycleCounts.cancelled,
                      "var(--muted)",
                    ],
                  ].map(([label, count, color]) => (
                    <span
                      key={String(label)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--surface-raised)",
                      }}
                    >
                      {label}:{" "}
                      <strong style={{ color: String(color) }}>
                        {String(count)}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: "14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: "10px",
                  }}
                >
                  Verified Payment Methods (Settlement Ledger):
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(
                    [
                      ["wire_transfer", "Wire Transfer"],
                      ["ach", "ACH"],
                      ["check", "Check"],
                      ["manual_settlement", "Manual Settlement"],
                    ] as const
                  ).map(([methodKey, label]) => {
                    const entry =
                      commercialAnalytics.paymentMethodBreakdown[methodKey];
                    return (
                      <span
                        key={methodKey}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          background: "var(--surface-raised)",
                        }}
                      >
                        {label}:{" "}
                        <strong>
                          {formatAnalyticsCurrency(entry.amountCents)}
                        </strong>{" "}
                        <small style={{ color: "var(--muted)" }}>
                          ({entry.count})
                        </small>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Revenue & Collection Trend Chart (Accessible + Mobile Responsive) */}
            <figure
              role="img"
              aria-label={`Commercial revenue and verified collection trend for ${dateWindow.label}`}
              style={{
                margin: 0,
                padding: "16px",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <figcaption style={{ fontWeight: 600, fontSize: "13px" }}>
                  Revenue &amp; Collection Trend Over Time ({dateWindow.label})
                </figcaption>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        background: "var(--gold)",
                        display: "inline-block",
                      }}
                    />
                    Booked Invoice Value
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        background: "#4ade80",
                        display: "inline-block",
                      }}
                    />
                    Verified Collected Payments
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        background: "#ef4444",
                        display: "inline-block",
                      }}
                    />
                    Overdue Receivables
                  </span>
                </div>
              </div>

              <div
                style={{
                  overflowX: "auto",
                  paddingBottom: "4px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${commercialAnalytics.revenueTrendSeries.length}, minmax(78px, 1fr))`,
                    gap: "10px",
                    minWidth: "320px",
                  }}
                >
                  {commercialAnalytics.revenueTrendSeries.map((bucket) => {
                    const bookedPct = Math.round(
                      (bucket.bookedInvoiceCents / maxRevenueBucketCents) * 100,
                    );
                    const collectedPct = Math.round(
                      (bucket.verifiedCollectedCents / maxRevenueBucketCents) *
                        100,
                    );
                    const overduePct = Math.round(
                      (bucket.overdueReceivablesCents / maxRevenueBucketCents) *
                        100,
                    );
                    return (
                      <div
                        key={bucket.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 6px",
                          borderRadius: "8px",
                          border: "1px solid var(--line)",
                          background: "var(--surface-raised)",
                        }}
                      >
                        <div
                          style={{
                            height: "72px",
                            width: "100%",
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <div
                            title={`Booked: ${formatAnalyticsCurrency(bucket.bookedInvoiceCents)}`}
                            style={{
                              width: "12px",
                              height: `${Math.max(4, bookedPct)}%`,
                              background: "var(--gold)",
                              borderRadius: "3px 3px 0 0",
                            }}
                          />
                          <div
                            title={`Verified Collected: ${formatAnalyticsCurrency(bucket.verifiedCollectedCents)}`}
                            style={{
                              width: "12px",
                              height: `${Math.max(4, collectedPct)}%`,
                              background: "#4ade80",
                              borderRadius: "3px 3px 0 0",
                            }}
                          />
                          {bucket.overdueReceivablesCents > 0 && (
                            <div
                              title={`Overdue: ${formatAnalyticsCurrency(bucket.overdueReceivablesCents)}`}
                              style={{
                                width: "10px",
                                height: `${Math.max(6, overduePct)}%`,
                                background: "#ef4444",
                                borderRadius: "3px 3px 0 0",
                              }}
                            />
                          )}
                        </div>
                        <strong style={{ fontSize: "11px" }}>
                          {bucket.label}
                        </strong>
                        <small
                          style={{
                            fontSize: "10px",
                            color: "#4ade80",
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatAnalyticsCurrency(
                            bucket.verifiedCollectedCents,
                          )}{" "}
                          paid
                        </small>
                        <small
                          style={{
                            fontSize: "10px",
                            color: "var(--muted)",
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatAnalyticsCurrency(bucket.bookedInvoiceCents)}{" "}
                          booked
                        </small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </figure>
          </div>
        )}
      </section>

      {/* Section 2: CRM Lead Funnel, Sources, Conversion Over Time & Follow-up Queue */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "24px",
        }}
      >
        {/* Sales Pipeline Funnel, Sources & Trend */}
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                CRM ACQUISITION &amp; CONVERSION
              </p>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>
                Sales Pipeline Funnel &amp; Lead Sources
              </h3>
            </div>
            <Link
              className="text-link"
              href="/admin/leads"
              style={{
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              View Leads <ArrowRight size={12} />
            </Link>
          </div>

          {leadAnalytics === null ? (
            <div
              role="alert"
              style={{
                padding: "24px",
                textAlign: "center",
                border: "1px dashed #ef4444",
                borderRadius: "12px",
                background: "color-mix(in srgb, #ef4444 5%, transparent)",
              }}
            >
              <AlertCircle
                size={24}
                style={{ color: "#ef4444", margin: "0 auto 8px" }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "#f87171" }}>
                Lead records unavailable from Supabase Cloud.
              </p>
            </div>
          ) : leadAnalytics.totalLeads === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                border: "1px dashed var(--line)",
                borderRadius: "12px",
              }}
            >
              <AlertCircle
                size={24}
                style={{ color: "var(--muted)", margin: "0 auto 8px" }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
                No lead records found for {dateWindow.label}.
              </p>
              {timeRange !== "all" && (
                <button
                  type="button"
                  onClick={() => setTimeRange("all")}
                  className="button button-secondary button-small"
                  style={{ marginTop: "10px", fontSize: "12px" }}
                >
                  Reset filter to All Time
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {/* Funnel Stage Bars */}
              <div style={{ display: "grid", gap: "10px" }}>
                {Object.entries(leadAnalytics.stageCounts).map(
                  ([stage, count]) => {
                    const pct =
                      leadAnalytics.totalLeads > 0
                        ? Math.round((count / leadAnalytics.totalLeads) * 100)
                        : 0;
                    return (
                      <div key={stage} style={{ display: "grid", gap: "4px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "13px",
                          }}
                        >
                          <span
                            style={{
                              textTransform: "capitalize",
                              fontWeight: 500,
                            }}
                          >
                            {stage}
                          </span>
                          <span style={{ color: "var(--muted)" }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: "6px",
                            background: "var(--surface)",
                            borderRadius: "3px",
                            overflow: "hidden",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background:
                                stage === "converted"
                                  ? "var(--gold)"
                                  : stage === "qualified"
                                    ? "#4ade80"
                                    : "var(--muted)",
                              borderRadius: "3px",
                              transition: "width 300ms ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              {/* Lead Source Breakdown with Conversion Rate */}
              <div
                style={{
                  paddingTop: "12px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Inbound Acquisition Channels &amp; Conversion Rate:
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {leadAnalytics.sourceBreakdown.map((srcItem) => {
                    if (srcItem.total === 0 && leadAnalytics.totalLeads > 0) {
                      return null;
                    }
                    return (
                      <span
                        key={srcItem.source}
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                          textTransform: "capitalize",
                        }}
                      >
                        {srcItem.source}: <strong>{srcItem.total}</strong>{" "}
                        <small style={{ color: "var(--muted)" }}>
                          ({srcItem.conversionRatePct}% conv)
                        </small>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Lead Follow-up Queue Health */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  fontSize: "12px",
                }}
              >
                <span>
                  Overdue follow-ups:{" "}
                  <strong
                    style={{
                      color:
                        leadAnalytics.followUpHealth.overdueCount > 0
                          ? "#f87171"
                          : "var(--foreground)",
                    }}
                  >
                    {leadAnalytics.followUpHealth.overdueCount}
                  </strong>
                </span>
                <span>
                  Due in 24h:{" "}
                  <strong style={{ color: "var(--gold)" }}>
                    {leadAnalytics.followUpHealth.upcoming24hCount}
                  </strong>
                </span>
                <span>
                  Unscheduled active:{" "}
                  <strong>
                    {leadAnalytics.followUpHealth.unscheduledActiveCount}
                  </strong>
                </span>
              </div>

              {/* Leads & Conversion Over Time Mini Chart */}
              <figure
                role="img"
                aria-label={`New leads and conversions over time (${dateWindow.label})`}
                style={{
                  margin: 0,
                  padding: "12px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <figcaption
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "10px",
                    color: "var(--muted)",
                  }}
                >
                  New Leads &amp; Conversions Over Time ({dateWindow.label})
                </figcaption>
                <div style={{ overflowX: "auto" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${leadAnalytics.trendSeries.length}, minmax(54px, 1fr))`,
                      gap: "6px",
                      minWidth: "260px",
                    }}
                  >
                    {leadAnalytics.trendSeries.map((b) => {
                      const newPct = Math.round(
                        (b.newLeads / maxLeadBucketCount) * 100,
                      );
                      const convPct = Math.round(
                        (b.convertedLeads / maxLeadBucketCount) * 100,
                      );
                      return (
                        <div
                          key={b.key}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "4px",
                            padding: "6px 4px",
                            borderRadius: "6px",
                            background: "var(--surface-raised)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <div
                            style={{
                              height: "44px",
                              display: "flex",
                              alignItems: "flex-end",
                              gap: "3px",
                            }}
                          >
                            <div
                              title={`New leads: ${b.newLeads}`}
                              style={{
                                width: "9px",
                                height: `${Math.max(4, newPct)}%`,
                                background: "var(--muted)",
                                borderRadius: "2px 2px 0 0",
                              }}
                            />
                            <div
                              title={`Converted: ${b.convertedLeads}`}
                              style={{
                                width: "9px",
                                height: `${Math.max(4, convPct)}%`,
                                background: "var(--gold)",
                                borderRadius: "2px 2px 0 0",
                              }}
                            />
                          </div>
                          <strong style={{ fontSize: "10px" }}>
                            {b.label}
                          </strong>
                          <small
                            style={{ fontSize: "10px", color: "var(--muted)" }}
                          >
                            {b.newLeads} / {b.convertedLeads}c
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </figure>
            </div>
          )}
        </section>

        {/* Project & Task Delivery Velocity + Overdue/Upcoming Task Queue */}
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                ENGINEERING DELIVERY &amp; DEADLINES
              </p>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>
                Projects by Status &amp; Overdue/Upcoming Tasks
              </h3>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Link
                className="text-link"
                href="/admin/projects"
                style={{
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Projects <ArrowRight size={12} />
              </Link>
              <Link
                className="text-link"
                href="/admin/tasks"
                style={{
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Tasks <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {deliveryAnalytics.projects === null ||
          deliveryAnalytics.tasks === null ? (
            <div
              role="alert"
              style={{
                padding: "24px",
                textAlign: "center",
                border: "1px dashed #ef4444",
                borderRadius: "12px",
                background: "color-mix(in srgb, #ef4444 5%, transparent)",
              }}
            >
              <FolderKanban
                size={24}
                style={{ color: "#ef4444", margin: "0 auto 8px" }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "#f87171" }}>
                Project or task delivery records unavailable from Supabase Cloud.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {/* KPI Summary Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small
                    style={{
                      color: "var(--subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Completed Tasks
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color: "var(--gold-ink)",
                    }}
                  >
                    {deliveryAnalytics.tasks.completedTasks}{" "}
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        fontWeight: 400,
                      }}
                    >
                      / {deliveryAnalytics.tasks.totalTasks}
                    </span>
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small
                    style={{
                      color: "var(--subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Task Completion
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color: "#4ade80",
                    }}
                  >
                    {deliveryAnalytics.tasks.completionRatePct !== null
                      ? `${deliveryAnalytics.tasks.completionRatePct}%`
                      : "N/A"}
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    border:
                      deliveryAnalytics.tasks.overdueTasksCount > 0
                        ? "1px solid rgba(239, 68, 68, 0.45)"
                        : "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small
                    style={{
                      color:
                        deliveryAnalytics.tasks.overdueTasksCount > 0
                          ? "#f87171"
                          : "var(--subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Overdue Tasks
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color:
                        deliveryAnalytics.tasks.overdueTasksCount > 0
                          ? "#f87171"
                          : "var(--foreground)",
                    }}
                  >
                    {deliveryAnalytics.tasks.overdueTasksCount}
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small
                    style={{
                      color: "var(--subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Due Next 7 Days
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color: "var(--gold)",
                    }}
                  >
                    {deliveryAnalytics.tasks.upcoming7dTasksCount}
                  </p>
                </div>
              </div>

              {/* Project Status Breakdown */}
              <div style={{ display: "grid", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Projects by Status (
                  {deliveryAnalytics.projects.avgCompletionPct !== null
                    ? `${deliveryAnalytics.projects.avgCompletionPct}% avg completion`
                    : "0 projects in period"}
                  {deliveryAnalytics.projects.overdueTargetProjectsCount > 0
                    ? ` · ${deliveryAnalytics.projects.overdueTargetProjectsCount} past target date`
                    : ""}
                  ):
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.entries(deliveryAnalytics.projects.statusCounts).map(
                    ([status, count]) => (
                      <span
                        key={status}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                          textTransform: "capitalize",
                        }}
                      >
                        {status.replace("_", " ")}: <strong>{count}</strong>
                      </span>
                    ),
                  )}
                </div>
              </div>

              {/* Overdue & Upcoming Tasks Actionable List */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                  }}
                >
                  <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={13} style={{ color: "var(--gold)" }} /> Overdue
                    &amp; Upcoming Task Deadlines
                  </strong>
                  <span style={{ color: "var(--muted)" }}>
                    {deliveryAnalytics.tasks.unassignedOpenTasksCount} unassigned
                    open
                  </span>
                </div>

                {deliveryAnalytics.tasks.overdueTaskItems.length === 0 &&
                deliveryAnalytics.tasks.upcomingTaskItems.length === 0 ? (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}
                  >
                    No overdue or upcoming task deadlines within the next 7 days.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: "6px" }}>
                    {[
                      ...deliveryAnalytics.tasks.overdueTaskItems.slice(0, 3),
                      ...deliveryAnalytics.tasks.upcomingTaskItems.slice(0, 3),
                    ].map((taskItem) => (
                      <div
                        key={taskItem.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          background: "var(--surface-raised)",
                          border: taskItem.isOverdue
                            ? "1px solid rgba(239, 68, 68, 0.35)"
                            : "1px solid var(--line)",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          <strong>{taskItem.title}</strong>
                          <small
                            style={{
                              marginLeft: "6px",
                              textTransform: "uppercase",
                              color: "var(--muted)",
                              fontSize: "10px",
                            }}
                          >
                            [{taskItem.priority}]
                          </small>
                        </div>
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: taskItem.isOverdue
                              ? "#f87171"
                              : "var(--gold)",
                          }}
                        >
                          {taskItem.isOverdue
                            ? `Overdue (${taskItem.dueDate})`
                            : `Due ${taskItem.dueDate}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Section 3: Support Queue SLA & Platform Governance / Pending Invitations */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "24px",
        }}
      >
        {/* Support Queue & High-Priority Tickets */}
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                SUPPORT DESK &amp; SLA QUEUE
              </p>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>
                Open &amp; High-Priority Support Tickets
              </h3>
            </div>
            <Link
              className="text-link"
              href="/admin/support"
              style={{
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              View Support Queue <ArrowRight size={12} />
            </Link>
          </div>

          {supportAnalytics === null ? (
            <div
              role="alert"
              style={{
                padding: "24px",
                textAlign: "center",
                border: "1px dashed #ef4444",
                borderRadius: "12px",
                background: "color-mix(in srgb, #ef4444 5%, transparent)",
              }}
            >
              <LifeBuoy
                size={24}
                style={{ color: "#ef4444", margin: "0 auto 8px" }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "#f87171" }}>
                Support ticket records unavailable from Supabase Cloud.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>
                    Open Queue
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color:
                        supportAnalytics.openTicketsCount > 0
                          ? "var(--gold)"
                          : "var(--foreground)",
                    }}
                  >
                    {supportAnalytics.openTicketsCount}
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    border:
                      supportAnalytics.highPriorityOpenCount > 0
                        ? "1px solid rgba(239, 68, 68, 0.45)"
                        : "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small
                    style={{
                      color:
                        supportAnalytics.highPriorityOpenCount > 0
                          ? "#f87171"
                          : "var(--subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    High / Urgent Open
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color:
                        supportAnalytics.highPriorityOpenCount > 0
                          ? "#f87171"
                          : "var(--foreground)",
                    }}
                  >
                    {supportAnalytics.highPriorityOpenCount}{" "}
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
                      ({supportAnalytics.urgentOpenCount} urgent)
                    </span>
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                  }}
                >
                  <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>
                    Resolved &amp; Closed
                  </small>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      margin: "4px 0 0",
                      color: "#4ade80",
                    }}
                  >
                    {supportAnalytics.resolvedOrClosedCount}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  fontSize: "13px",
                }}
              >
                <span>New &amp; In Progress:</span>
                <strong>
                  {supportAnalytics.statusCounts.new +
                    supportAnalytics.statusCounts.in_progress}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  fontSize: "13px",
                }}
              >
                <span>Waiting on Client Response:</span>
                <strong>
                  {supportAnalytics.statusCounts.waiting_on_client}
                </strong>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {Object.entries(supportAnalytics.categoryCounts).map(
                  ([cat, count]) => (
                    <span
                      key={cat}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        textTransform: "capitalize",
                      }}
                    >
                      {cat.replace("_", " ")}: <strong>{count}</strong>
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        {/* Notification, Automation Job Health & Pending Invitations */}
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                AUTOMATION &amp; GOVERNANCE TELEMETRY
              </p>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>
                Automation Job Health &amp; Pending Invitations
              </h3>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Link
                className="text-link"
                href="/admin/notifications"
                style={{
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Notifications <ArrowRight size={12} />
              </Link>
              <Link
                className="text-link"
                href="/admin/team"
                style={{
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Team <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {/* Staff & Invitations Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
                gap: "10px",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>
                  Platform Staff
                </small>
                <p style={{ fontSize: "18px", fontWeight: 700, margin: "4px 0 0" }}>
                  {governanceAnalytics.staffCount !== null
                    ? governanceAnalytics.staffCount
                    : "Unavailable"}
                </p>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>
                  Pending Invites
                </small>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    margin: "4px 0 0",
                    color:
                      governanceAnalytics.invitations &&
                      governanceAnalytics.invitations.pendingCount > 0
                        ? "var(--gold)"
                        : "var(--foreground)",
                  }}
                >
                  {governanceAnalytics.invitations !== null
                    ? governanceAnalytics.invitations.pendingCount
                    : "Unavailable"}
                </p>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                }}
              >
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>
                  Expired Invites
                </small>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    margin: "4px 0 0",
                    color:
                      governanceAnalytics.invitations &&
                      governanceAnalytics.invitations.expiredCount > 0
                        ? "#f87171"
                        : "var(--muted)",
                  }}
                >
                  {governanceAnalytics.invitations !== null
                    ? governanceAnalytics.invitations.expiredCount
                    : "—"}
                </p>
              </div>
            </div>

            {/* Automation Sweep Status Card */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                border:
                  governanceAnalytics.automationHealth.healthStatus === "failing"
                    ? "1px solid rgba(239, 68, 68, 0.45)"
                    : governanceAnalytics.automationHealth.healthStatus ===
                        "degraded"
                      ? "1px solid var(--gold)"
                      : "1px solid var(--line)",
                background: "var(--surface)",
                display: "grid",
                gap: "8px",
                fontSize: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Activity size={14} style={{ color: "var(--gold)" }} />{" "}
                  Workflow Automation Sweep Health
                </strong>
                <span
                  className="record-status"
                  style={{
                    color:
                      governanceAnalytics.automationHealth.healthStatus ===
                      "failing"
                        ? "#f87171"
                        : governanceAnalytics.automationHealth.healthStatus ===
                            "healthy"
                          ? "#4ade80"
                          : "var(--gold)",
                  }}
                >
                  {governanceAnalytics.automationHealth.statusLabel}
                </span>
              </div>

              <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
                <div>
                  <strong>Last Execution:</strong>{" "}
                  {governanceAnalytics.automationHealth.lastRunAt
                    ? `${new Date(governanceAnalytics.automationHealth.lastRunAt).toLocaleString()} (${governanceAnalytics.automationHealth.lastTriggeredBy?.replace("_", " ") ?? "scheduled"})`
                    : "No recent automation runs recorded"}
                </div>
                <div>
                  <strong>Observed Runs:</strong>{" "}
                  {governanceAnalytics.automationHealth.totalRunsObserved} total
                  ·{" "}
                  {governanceAnalytics.automationHealth.totalInsertedNotifications}{" "}
                  dispatched ·{" "}
                  {governanceAnalytics.automationHealth.totalSuppressedDuplicates}{" "}
                  deduplicated ·{" "}
                  <span
                    style={{
                      color:
                        governanceAnalytics.automationHealth.failedRunsCount > 0
                          ? "#f87171"
                          : "inherit",
                    }}
                  >
                    {governanceAnalytics.automationHealth.failedRunsCount} error
                    run(s)
                  </span>
                </div>
              </div>

              {governanceAnalytics.automationHealth.recentSanitizedErrors.length >
                0 && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#f87171",
                    fontSize: "11px",
                  }}
                >
                  <strong>Recent Sanitized Job Errors:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {governanceAnalytics.automationHealth.recentSanitizedErrors.map(
                      (errMsg, idx) => (
                        <li key={idx}>{errMsg}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Notification Delivery Summary */}
            {governanceAnalytics.notifications && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Bell size={13} style={{ color: "var(--gold)" }} /> Recent
                  Notifications:{" "}
                  <strong>
                    {governanceAnalytics.notifications.totalRecent}
                  </strong>{" "}
                  ({governanceAnalytics.notifications.unreadCount} unread)
                </span>
                <span style={{ color: "var(--muted)" }}>
                  Billing: {governanceAnalytics.notifications.byCategory.billing}{" "}
                  · Project:{" "}
                  {governanceAnalytics.notifications.byCategory.project} ·
                  Support: {governanceAnalytics.notifications.byCategory.ticket}{" "}
                  · Security:{" "}
                  {governanceAnalytics.notifications.byCategory.security}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Section 4: Platform Health & Integration Observability Status View */}
      {integrationItems.length > 0 && (
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                PLATFORM HEALTH &amp; INTEGRATION OBSERVABILITY
              </p>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>
                Configured vs. Unavailable Platform Integrations
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Reports configuration presence and operational readiness without
                exposing secret values or credentials.
              </p>
            </div>
            <span className="record-status" style={{ fontSize: "12px" }}>
              {data.integrationStatus?.configuredCount} /{" "}
              {data.integrationStatus?.totalIntegrations} Configured
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "12px",
            }}
          >
            {integrationItems.map((item) => {
              const isConfigured = item.status === "configured";
              const isDegraded = item.status === "degraded";
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: isConfigured
                      ? "1px solid rgba(74, 222, 128, 0.3)"
                      : isDegraded
                        ? "1px solid rgba(212, 175, 55, 0.35)"
                        : "1px solid var(--line)",
                    background: "var(--surface)",
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "13px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {item.id.includes("email") || item.id.includes("smtp") ? (
                        <Mail size={14} style={{ color: "var(--gold)" }} />
                      ) : isConfigured ? (
                        <CheckCircle2 size={14} style={{ color: "#4ade80" }} />
                      ) : isDegraded ? (
                        <AlertTriangle
                          size={14}
                          style={{ color: "var(--gold)" }}
                        />
                      ) : (
                        <Server size={14} style={{ color: "var(--muted)" }} />
                      )}
                      {item.name}
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: isConfigured
                          ? "rgba(74, 222, 128, 0.12)"
                          : isDegraded
                            ? "rgba(212, 175, 55, 0.14)"
                            : "var(--surface-raised)",
                        color: isConfigured
                          ? "#4ade80"
                          : isDegraded
                            ? "var(--gold)"
                            : "var(--muted)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {item.statusLabel}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.summary}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginTop: "2px",
                    }}
                  >
                    {Object.entries(item.configPresence).map(([k, v]) => (
                      <code
                        key={k}
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                          color:
                            v === true
                              ? "#4ade80"
                              : v === false
                                ? "var(--muted)"
                                : "var(--gold-ink)",
                        }}
                      >
                        {k}:{" "}
                        {typeof v === "boolean"
                          ? v
                            ? "present"
                            : "unset"
                          : v}
                      </code>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Metric Definitions & Calculation Methodology Panel */}
      <section
        className="module-panel"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface-raised)",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: "15px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldCheck size={16} style={{ color: "var(--gold)" }} /> Metric
          Definitions, Accounting Boundaries &amp; Security Controls
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            fontSize: "13px",
            color: "var(--muted)",
            lineHeight: "1.6",
          }}
        >
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>
              Booked Invoice Value vs. Verified Collected Payments
            </strong>
            Booked value reflects non-draft, non-cancelled statements. Verified
            collected payments strictly sum audited{" "}
            <code>payment_record</code> settlements with payment references.
            Issued statements are never labeled as collected revenue.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>
              Consistent UTC Date Boundaries &amp; Comparisons
            </strong>
            Period filters evaluate UTC timestamps and compare against the
            immediately preceding window of equal duration. Missing or failed
            queries display &ldquo;Unavailable&rdquo; rather than zero.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>
              Authorized CSV Exports &amp; Formula Neutralization
            </strong>
            CSV exports require Super Admin or Platform Admin authority at AAL2
            MFA and neutralize leading <code>=</code>, <code>+</code>,{" "}
            <code>-</code>, <code>@</code>, and pipe characters against
            spreadsheet formula injection.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>
              Zero-Party Telemetry &amp; Sanitized Observability
            </strong>
            Integration status reports configuration presence without exposing
            keys. Repeated job failures are throttled to prevent log flooding.
          </div>
        </div>
      </section>
    </div>
  );
}
