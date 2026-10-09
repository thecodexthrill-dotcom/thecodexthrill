"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "lucide-react";

export type AnalyticsLead = {
  stage: string;
  created_at: string;
  source?: string;
};

export type AnalyticsOrg = {
  status: string;
  created_at: string;
  name?: string;
};

export type AnalyticsProject = {
  status: string;
  progress_pct: number;
  created_at: string;
  name?: string;
};

export type AnalyticsTask = {
  status: string;
  priority: string;
  created_at: string;
};

export type AnalyticsInvoice = {
  amount_cents: number;
  status: string;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

export type AnalyticsTicket = {
  status: string;
  priority: string;
  category: string;
  created_at: string;
};

export type AnalyticsData = {
  leads: AnalyticsLead[];
  organizations: AnalyticsOrg[];
  staffCount: number;
  pendingInvitesCount: number;
  projects: AnalyticsProject[];
  tasks: AnalyticsTask[];
  invoices: AnalyticsInvoice[];
  tickets: AnalyticsTicket[];
};

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const [timeRange, setTimeRange] = useState<"all" | "30d" | "90d">("all");

  const cutoffDate = useMemo(() => {
    if (timeRange === "all") return null;
    const now = new Date();
    const days = timeRange === "30d" ? 30 : 90;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }, [timeRange]);

  const filterByDate = useCallback(
    <T extends { created_at: string }>(items: T[]): T[] => {
      if (!cutoffDate) return items;
      return items.filter((item) => new Date(item.created_at) >= cutoffDate);
    },
    [cutoffDate],
  );

  const filteredLeads = useMemo(() => filterByDate(data.leads), [data.leads, filterByDate]);
  const filteredProjects = useMemo(() => filterByDate(data.projects), [data.projects, filterByDate]);
  const filteredTasks = useMemo(() => filterByDate(data.tasks), [data.tasks, filterByDate]);
  const filteredInvoices = useMemo(() => filterByDate(data.invoices), [data.invoices, filterByDate]);
  const filteredTickets = useMemo(() => filterByDate(data.tickets), [data.tickets, filterByDate]);

  // Lead metrics
  const stageCounts: Record<string, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    closed: 0,
  };
  for (const l of filteredLeads) {
    if (l.stage in stageCounts) stageCounts[l.stage] += 1;
  }
  const convertedLeads = stageCounts.converted;
  const leadConversionRate = filteredLeads.length > 0
    ? Math.round((convertedLeads / filteredLeads.length) * 100)
    : 0;

  // Project & task delivery metrics
  const projectStatusCounts: Record<string, number> = {
    planning: 0,
    in_progress: 0,
    in_review: 0,
    completed: 0,
    on_hold: 0,
  };
  let totalProgress = 0;
  for (const p of filteredProjects) {
    if (p.status in projectStatusCounts) projectStatusCounts[p.status] += 1;
    totalProgress += p.progress_pct || 0;
  }
  const avgProgress = filteredProjects.length > 0
    ? Math.round(totalProgress / filteredProjects.length)
    : 0;

  const taskStatusCounts: Record<string, number> = {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  };
  for (const t of filteredTasks) {
    if (t.status in taskStatusCounts) taskStatusCounts[t.status] += 1;
  }
  const completedTasks = taskStatusCounts.done;
  const taskCompletionRate = filteredTasks.length > 0
    ? Math.round((completedTasks / filteredTasks.length) * 100)
    : 0;

  // Invoicing & revenue metrics
  let totalBilledCents = 0;
  let totalPaidCents = 0;
  let totalOutstandingCents = 0;
  let totalOverdueCents = 0;

  const invoiceStatusCounts: Record<string, number> = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };

  for (const inv of filteredInvoices) {
    if (inv.status in invoiceStatusCounts) invoiceStatusCounts[inv.status] += 1;
    if (inv.status !== "cancelled" && inv.status !== "draft") {
      totalBilledCents += inv.amount_cents;
    }
    if (inv.status === "paid") {
      totalPaidCents += inv.amount_cents;
    }
    if (inv.status === "sent") {
      totalOutstandingCents += inv.amount_cents;
    }
    if (inv.status === "overdue") {
      totalOverdueCents += inv.amount_cents;
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Support ticket metrics
  const ticketStatusCounts: Record<string, number> = {
    new: 0,
    in_progress: 0,
    waiting_on_client: 0,
    resolved: 0,
    closed: 0,
  };
  let urgentTickets = 0;
  for (const tick of filteredTickets) {
    if (tick.status in ticketStatusCounts) ticketStatusCounts[tick.status] += 1;
    if (tick.priority === "urgent" && tick.status !== "resolved" && tick.status !== "closed") {
      urgentTickets += 1;
    }
  }
  const resolvedTickets = ticketStatusCounts.resolved + ticketStatusCounts.closed;
  const ticketResolutionRate = filteredTickets.length > 0
    ? Math.round((resolvedTickets / filteredTickets.length) * 100)
    : 100;

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "28px" }}>
      {/* Header and Filter Controls */}
      <section className="module-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <p className="eyebrow">EXECUTIVE DASHBOARD · BUSINESS INTELLIGENCE</p>
            <h2 style={{ margin: "6px 0 8px" }}>Operations &amp; Platform Analytics</h2>
            <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>
              Live metrics aggregated from Supabase Cloud CRM, Projects, Invoices, and Support queues.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <Calendar size={14} style={{ color: "var(--gold)", marginLeft: "8px" }} />
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Period:</span>
            <button
              type="button"
              onClick={() => setTimeRange("all")}
              style={{
                background: timeRange === "all" ? "var(--surface-raised)" : "transparent",
                color: timeRange === "all" ? "var(--gold-ink)" : "var(--muted)",
                border: timeRange === "all" ? "1px solid var(--line-strong)" : "1px solid transparent",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeRange("30d")}
              style={{
                background: timeRange === "30d" ? "var(--surface-raised)" : "transparent",
                color: timeRange === "30d" ? "var(--gold-ink)" : "var(--muted)",
                border: timeRange === "30d" ? "1px solid var(--line-strong)" : "1px solid transparent",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange("90d")}
              style={{
                background: timeRange === "90d" ? "var(--surface-raised)" : "transparent",
                color: timeRange === "90d" ? "var(--gold-ink)" : "var(--muted)",
                border: timeRange === "90d" ? "1px solid var(--line-strong)" : "1px solid transparent",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        {/* Executive KPI Grid */}
        <div className="module-stat-grid" style={{ marginTop: "24px" }}>
          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={14} style={{ color: "var(--gold)" }} /> Total Sales Leads
            </span>
            <strong>{filteredLeads.length}</strong>
            <small>{leadConversionRate}% conversion to client</small>
          </div>

          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FolderKanban size={14} style={{ color: "var(--gold)" }} /> Active Projects
            </span>
            <strong>{projectStatusCounts.in_progress + projectStatusCounts.planning}</strong>
            <small>{avgProgress}% average completion</small>
          </div>

          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CreditCard size={14} style={{ color: "var(--gold)" }} /> Collected Revenue
            </span>
            <strong>{formatCurrency(totalPaidCents)}</strong>
            <small>{formatCurrency(totalOutstandingCents + totalOverdueCents)} receivables</small>
          </div>

          <div className="module-stat">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <LifeBuoy size={14} style={{ color: "var(--gold)" }} /> Support Health
            </span>
            <strong>{ticketResolutionRate}%</strong>
            <small>{urgentTickets} urgent unresolved</small>
          </div>
        </div>
      </section>

      {/* Grid: CRM Funnel & Delivery Velocity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {/* CRM Pipeline Funnel */}
        <section className="module-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Sales Pipeline Conversion</h3>
            <Link className="text-link" href="/admin/leads" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              View Leads <ArrowRight size={12} />
            </Link>
          </div>

          {filteredLeads.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "12px" }}>
              <AlertCircle size={24} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>No lead records found for this period.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {Object.entries(stageCounts).map(([stage, count]) => {
                const pct = filteredLeads.length > 0 ? Math.round((count / filteredLeads.length) * 100) : 0;
                return (
                  <div key={stage} style={{ display: "grid", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{stage}</span>
                      <span style={{ color: "var(--muted)" }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: "6px", background: "var(--surface)", borderRadius: "3px", overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: stage === "converted" ? "var(--gold)" : stage === "qualified" ? "#4ade80" : "var(--muted)",
                          borderRadius: "3px",
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Project & Task Delivery Velocity */}
        <section className="module-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Project &amp; Task Velocity</h3>
            <Link className="text-link" href="/admin/projects" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              View Projects <ArrowRight size={12} />
            </Link>
          </div>

          {filteredProjects.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "12px" }}>
              <FolderKanban size={24} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>No projects recorded yet.</p>
              <Link className="button button-small button-secondary" href="/admin/projects" style={{ marginTop: "12px", display: "inline-block" }}>
                Create First Project
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
                  <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Completed Tasks</small>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0", color: "var(--gold-ink)" }}>
                    {completedTasks} <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 400 }}>/ {filteredTasks.length}</span>
                  </p>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
                  <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Delivery Rate</small>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0", color: "#4ade80" }}>
                    {taskCompletionRate}%
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Project Status Breakdown:</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.entries(projectStatusCounts).map(([status, count]) => (
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
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Grid: Financial Position & Support Queue */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {/* Financial & Commercial Health */}
        <section className="module-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Commercial &amp; Billing Health</h3>
            <Link className="text-link" href="/admin/billing" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Manage Billing <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
            <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Total Invoiced</small>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0 0" }}>{formatCurrency(totalBilledCents)}</p>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Paid Revenue</small>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0 0", color: "#4ade80" }}>{formatCurrency(totalPaidCents)}</p>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Pending (Sent)</small>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0 0", color: "var(--gold)" }}>{formatCurrency(totalOutstandingCents)}</p>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase" }}>Overdue</small>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0 0", color: totalOverdueCents > 0 ? "#f87171" : "var(--muted)" }}>
                {formatCurrency(totalOverdueCents)}
              </p>
            </div>
          </div>
        </section>

        {/* Support Ticket Resolution */}
        <section className="module-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Support Ticket Resolution</h3>
            <Link className="text-link" href="/admin/support" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              View Tickets <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <span style={{ fontSize: "13px" }}>Open Tickets in Queue:</span>
              <strong style={{ fontSize: "14px", color: ticketStatusCounts.new > 0 ? "var(--gold)" : "var(--foreground)" }}>
                {ticketStatusCounts.new + ticketStatusCounts.in_progress}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <span style={{ fontSize: "13px" }}>Waiting on Client:</span>
              <strong style={{ fontSize: "14px" }}>{ticketStatusCounts.waiting_on_client}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)" }}>
              <span style={{ fontSize: "13px" }}>Resolved &amp; Closed:</span>
              <strong style={{ fontSize: "14px", color: "#4ade80" }}>{resolvedTickets}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Metric Definitions & Transparency Panel */}
      <section className="module-panel" style={{ border: "1px solid var(--line)", background: "var(--surface-raised)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={16} style={{ color: "var(--gold)" }} /> Metric Definitions &amp; Calculation Methodology
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", fontSize: "13px", color: "var(--muted)", lineHeight: "1.6" }}>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>Lead Conversion Rate</strong>
            Calculated as total converted leads divided by total sales leads recorded in the selected period.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>Project Completion Rate</strong>
            Average progress percentage across all active and completed platform projects.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>Gross Invoiced vs Collected</strong>
            Gross invoiced represents all issued invoices. Collected revenue accounts strictly for settled transactions marked &apos;paid&apos;.
          </div>
          <div>
            <strong style={{ color: "var(--foreground)", display: "block" }}>Zero-Party Website Telemetry</strong>
            All website telemetry respects privacy by design. No third-party tracking scripts or cross-tenant profiling is enabled.
          </div>
        </div>
      </section>
    </div>
  );
}

