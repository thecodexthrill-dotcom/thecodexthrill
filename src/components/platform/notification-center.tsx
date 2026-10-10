"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type NotificationCategory,
  type NotificationPreferences,
  type TransactionalEmailConfigStatus,
  sanitizeNotificationLink,
  sanitizeNotificationPayload,
} from "@/lib/supabase/notification-helper";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  runWorkflowAutomationAction,
  updateNotificationPreferencesAction,
} from "@/lib/supabase/operations-actions";

export type NotificationItemRecord = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationCategory;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

const PAGE_SIZE = 12;

export function NotificationCenter({
  kind,
  notifications,
  preferences,
  emailConfig,
  schedulerConfigured,
  canRunAutomation,
  userEmail,
  roles,
  assuranceLevel,
  notice,
  queryError,
}: {
  kind: "admin" | "portal";
  notifications: NotificationItemRecord[];
  preferences: NotificationPreferences;
  emailConfig: TransactionalEmailConfigStatus;
  schedulerConfigured: boolean;
  canRunAutomation: boolean;
  userEmail: string;
  roles: string[];
  assuranceLevel: string | null;
  notice?: string;
  queryError?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | NotificationCategory>("all");
  const [page, setPage] = useState(1);

  const sanitizedNotifications = useMemo(() => {
    return notifications.map((n) => {
      const clean = sanitizeNotificationPayload({
        title: n.title,
        message: n.message,
        type: n.type,
        linkUrl: n.link_url,
        recipientWorkspace: kind,
      });
      return {
        ...n,
        title: clean.title,
        message: clean.message,
        link_url: sanitizeNotificationLink(n.link_url, kind),
      };
    });
  }, [notifications, kind]);

  const unreadCount = useMemo(
    () => sanitizedNotifications.filter((n) => !n.is_read).length,
    [sanitizedNotifications],
  );

  const filteredNotifications = useMemo(() => {
    return sanitizedNotifications.filter((n) => {
      if (statusFilter === "unread" && n.is_read) return false;
      if (statusFilter === "read" && !n.is_read) return false;
      if (categoryFilter !== "all" && n.type !== categoryFilter) return false;
      return true;
    });
  }, [sanitizedNotifications, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(start, start + PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  const typeColors: Record<
    NotificationCategory,
    { bg: string; text: string; border: string; label: string }
  > = {
    security: {
      bg: "rgba(239, 68, 68, 0.12)",
      text: "#ef4444",
      border: "rgba(239, 68, 68, 0.28)",
      label: "Security",
    },
    ticket: {
      bg: "rgba(59, 130, 246, 0.12)",
      text: "#3b82f6",
      border: "rgba(59, 130, 246, 0.28)",
      label: "Support Ticket",
    },
    billing: {
      bg: "rgba(212, 175, 55, 0.12)",
      text: "var(--gold)",
      border: "rgba(212, 175, 55, 0.3)",
      label: "Commercial / Billing",
    },
    project: {
      bg: "rgba(34, 197, 94, 0.12)",
      text: "#22c55e",
      border: "rgba(34, 197, 94, 0.28)",
      label: "Project & Delivery",
    },
    system: {
      bg: "rgba(255, 255, 255, 0.06)",
      text: "var(--muted)",
      border: "var(--border)",
      label: "System",
    },
  };

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {/* Summary KPI Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        <div className="module-stat">
          <span>Unread Alerts</span>
          <strong style={{ color: unreadCount > 0 ? "var(--gold)" : "var(--text)" }}>
            {unreadCount}
          </strong>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            {unreadCount === 0 ? "Inbox caught up" : "Awaiting review"}
          </small>
        </div>

        <div className="module-stat">
          <span>Recent Feed History</span>
          <strong>{sanitizedNotifications.length}</strong>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            Bounded recent workspace events
          </small>
        </div>

        <div className="module-stat">
          <span>Communication Channels</span>
          <strong style={{ fontSize: "16px" }}>
            In-App {emailConfig.configured ? "+ Email" : "(Primary)"}
          </strong>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            {emailConfig.configured
              ? `Transactional provider: ${emailConfig.provider}`
              : "Email provider unconfigured (in-app active)"}
          </small>
        </div>

        <div className="module-stat">
          <span>Session Assurance</span>
          <strong style={{ fontSize: "16px", color: assuranceLevel === "aal2" ? "#22c55e" : "var(--gold)" }}>
            {assuranceLevel === "aal2" ? "AAL2 MFA Verified" : "Standard Session"}
          </strong>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            Zero-Trust RLS user isolation
          </small>
        </div>
      </div>

      {/* Main Notification Feed Panel */}
      <section className="module-panel">
        {queryError && (
          <div
            role="alert"
            style={{
              color: "#ef4444",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "12px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              fontSize: "14px",
              marginBottom: "16px",
            }}
          >
            <strong>Data Notice:</strong> Unable to load live notifications from database ({queryError}).
          </div>
        )}

        {notice && (
          <p
            className={notice === "preferences" ? "module-alert" : "module-success"}
            role="status"
            style={{ marginBottom: "16px" }}
          >
            {notice === "all_read"
              ? "All unread notifications for your account have been marked as read."
              : notice === "read"
                ? "Notification marked as read."
                : notice === "preferences_saved"
                  ? "Notification and communication preferences saved to your account profile."
                  : notice === "automation_completed"
                    ? "Workflow automation reminder sweep completed. New due/overdue reminders have been dispatched with 24-hour deduplication."
                    : notice === "preferences"
                      ? "Unable to update notification preferences. Please verify your session and try again."
                      : "Notifications updated."}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              UNIFIED NOTIFICATION CENTER
            </p>
            <h2 style={{ margin: "4px 0" }}>Workspace Activity &amp; Alerts</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
              Event-driven updates for projects, deliverables, billing, support tickets, and security.
            </p>
          </div>

          {unreadCount > 0 && (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="return_path" value={kind} />
              <button
                type="submit"
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                Mark all as read ({unreadCount})
              </button>
            </form>
          )}
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "18px",
            paddingBottom: "14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} role="group" aria-label="Filter by read status">
            {(
              [
                ["all", `All (${sanitizedNotifications.length})`],
                ["unread", `Unread (${unreadCount})`],
                ["read", `Read (${sanitizedNotifications.length - unreadCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setPage(1);
                }}
                className={statusFilter === key ? "button button-primary" : "button button-secondary"}
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} role="group" aria-label="Filter by category">
            {(
              [
                ["all", "All Categories"],
                ["project", "Project"],
                ["billing", "Billing"],
                ["ticket", "Support"],
                ["system", "System"],
                ["security", "Security"],
              ] as const
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
                className={categoryFilter === cat ? "button button-primary" : "button button-secondary"}
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bounded Notification List */}
        <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
          {paginatedNotifications.length > 0 ? (
            paginatedNotifications.map((n) => {
              const tag = typeColors[n.type] ?? typeColors.system;
              return (
                <div
                  key={n.id}
                  className="activity-row"
                  style={{
                    opacity: n.is_read ? 0.72 : 1,
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    borderLeft: n.is_read ? "2px solid transparent" : "2px solid var(--gold)",
                    paddingLeft: "10px",
                  }}
                >
                  <span
                    className="activity-dot"
                    style={{
                      background: n.is_read ? "var(--muted)" : "var(--gold)",
                      marginTop: "6px",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            background: tag.bg,
                            color: tag.text,
                            border: `1px solid ${tag.border}`,
                            fontWeight: 600,
                          }}
                        >
                          {tag.label}
                        </span>
                        <strong>{n.title}</strong>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {n.link_url && (
                          <Link
                            href={n.link_url}
                            className="button button-secondary"
                            style={{ padding: "2px 8px", fontSize: "11px", textDecoration: "none" }}
                          >
                            Open &rarr;
                          </Link>
                        )}
                        {!n.is_read && (
                          <form action={markNotificationReadAction} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="return_path" value={kind} />
                            <button
                              type="submit"
                              className="button button-secondary"
                              style={{ padding: "2px 8px", fontSize: "11px" }}
                            >
                              Mark read
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>{n.message}</p>
                    <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="module-empty" style={{ margin: "12px 0" }}>
              {sanitizedNotifications.length === 0
                ? "No notifications recorded for this account yet."
                : "No notifications match the selected filter criteria."}
            </p>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredNotifications.length > PAGE_SIZE && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(currentPage * PAGE_SIZE, filteredNotifications.length)} of{" "}
              {filteredNotifications.length}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="button button-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="button button-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Admin Workflow Automation & Reminder Sweep Panel */}
      {kind === "admin" && canRunAutomation && (
        <section className="module-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                WORKFLOW AUTOMATION &amp; REMINDERS
              </p>
              <h2 style={{ margin: "4px 0" }}>Scheduled Operational Sweep</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px", maxWidth: "680px" }}>
                Evaluates upcoming and overdue CRM lead follow-ups, project task deadlines, client
                invoice due dates, open support tickets, and pending platform invitations. Uses a
                24-hour deduplication window so repeated runs never generate duplicate alerts.
              </p>
            </div>

            <form action={runWorkflowAutomationAction}>
              <button type="submit" className="button button-primary" style={{ fontSize: "13px" }}>
                Run Reminder Sweep Now
              </button>
            </form>
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
              fontSize: "13px",
              display: "grid",
              gap: "6px",
            }}
          >
            <div>
              <strong>Protected Cron Endpoint:</strong>{" "}
              <code>POST /api/automation/run</code> (or <code>GET</code> with{" "}
              <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code>)
            </div>
            <div style={{ color: "var(--muted)" }}>
              <strong>Scheduler Secret Status:</strong>{" "}
              {schedulerConfigured
                ? "Configured (CRON_SECRET / WORKFLOW_AUTOMATION_SECRET active)"
                : "Unconfigured in environment — external cron requests are rejected with HTTP 503 until CRON_SECRET (min 16 chars) is set. Manual admin sweeps remain available above."}
            </div>
          </div>
        </section>
      )}

      {/* Notification Preferences & Channel Status */}
      <section className="module-panel">
        <p className="eyebrow" style={{ margin: 0 }}>
          CHANNEL PREFERENCES
        </p>
        <h2 style={{ margin: "4px 0" }}>Notification &amp; Delivery Settings</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--muted)", fontSize: "14px" }}>
          Control which workspace categories generate alerts for <strong>{userEmail}</strong>.
          Security and MFA notices are mandatory.
        </p>

        <form action={updateNotificationPreferencesAction} style={{ display: "grid", gap: "12px" }}>
          <input type="hidden" name="return_path" value={kind} />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              opacity: 0.85,
            }}
          >
            <input type="checkbox" checked disabled />
            <div>
              <strong>Security &amp; MFA Alerts (Mandatory)</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Authenticator assurance, role changes, and critical account protection notices.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="pref_project" defaultChecked={preferences.project} />
            <div>
              <strong>Projects, Tasks &amp; Deliverables</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Milestone transitions, work item assignments, due-date reminders, and shared files.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="pref_billing" defaultChecked={preferences.billing} />
            <div>
              <strong>Invoices &amp; Commercial Billing</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Issued statements, upcoming due dates, overdue alerts, and verified payment records.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="pref_ticket" defaultChecked={preferences.ticket} />
            <div>
              <strong>Support Tickets &amp; Responses</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                New support requests, thread replies, and ticket resolution updates.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="pref_system" defaultChecked={preferences.system} />
            <div>
              <strong>System, Leads &amp; Onboarding Events</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                CRM enquiry alerts, lead follow-ups, and organization onboarding updates.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="pref_email_enabled"
              defaultChecked={preferences.email_enabled}
            />
            <div>
              <strong>Transactional Email Mirroring</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Send email copies for eligible workspace events when transactional email provider is configured.
              </div>
            </div>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="submit" className="button button-primary" style={{ fontSize: "13px" }}>
              Save Notification Preferences
            </button>
          </div>
        </form>

        {/* Honest External Channel Dependency Status */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            display: "grid",
            gap: "10px",
            fontSize: "13px",
          }}
        >
          <div className="activity-row">
            <span className="activity-dot" />
            <div>
              <strong>
                Transactional Email Status:{" "}
                {emailConfig.configured
                  ? `Active (${emailConfig.provider.toUpperCase()})`
                  : "Provider Unconfigured (In-App Primary)"}
              </strong>
              <p style={{ margin: "2px 0", color: "var(--muted)" }}>
                {emailConfig.configured
                  ? `Outbound transactional notifications are routed via ${emailConfig.provider} from ${emailConfig.fromAddress}.`
                  : emailConfig.reason}
              </p>
            </div>
          </div>

          <div className="activity-row">
            <span className="activity-dot" />
            <div>
              <strong>Browser Web Push Status: Not Configured</strong>
              <p style={{ margin: "2px 0", color: "var(--muted)" }}>
                Web Push delivery is disabled until VAPID keys (<code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>,{" "}
                <code>VAPID_PRIVATE_KEY</code>) and a push subscription table are provisioned.
              </p>
            </div>
          </div>

          <div className="activity-row">
            <span className="activity-dot" />
            <div>
              <strong>Authenticated Workspace Session</strong>
              <p style={{ margin: "2px 0", color: "var(--muted)" }}>
                Signed in as {userEmail} with roles: {roles.map((r) => r.replaceAll("_", " ")).join(", ")}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

