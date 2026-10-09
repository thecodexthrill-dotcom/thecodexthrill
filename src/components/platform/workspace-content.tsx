import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { InvitationForm } from "@/components/auth/invitation-form";
import { InvitationRowActions } from "@/components/auth/invitation-row-actions";
import { PlatformRoleActions } from "@/components/platform/platform-role-actions";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invitationListFailureMessage, safeInvitationListErrorCode } from "@/lib/supabase/invitation-list-status";
import { signOutAction } from "@/lib/supabase/actions";
import {
  createLeadAction,
  updateLeadAction,
  deleteLeadAction,
  createOrganizationAction,
  updateOrganizationAction,
} from "@/lib/supabase/lead-actions";
import {
  CmsPagesManager,
  CmsBlogManager,
  CmsPortfolioManager,
  CmsServicesManager,
  CmsSiteSettingsManager,
  UnifiedCmsManager,
  type CmsPageRecord,
  type CmsPostRecord,
  type CmsCaseStudyRecord,
  type CmsServiceRecord,
  type CmsSettingRecord,
  type CmsHeroSlideRecord,
  type CmsCapabilityRecord,
  type CmsProcessStepRecord,
  type CmsIndustryRecord,
  type CmsTechStackRecord,
  type CmsFaqRecord,
} from "@/components/platform/cms-manager";
import {
  SupportManager,
  type SupportTicketRecord,
} from "@/components/platform/support-manager";
import {
  ProjectManager,
  type ProjectRecord,
} from "@/components/platform/project-manager";
import {
  DocumentManager,
  type DocumentRecord,
} from "@/components/platform/document-manager";
import {
  BillingManager,
  type InvoiceRecord,
} from "@/components/platform/billing-manager";
import {
  markNotificationReadAction,
} from "@/lib/supabase/operations-actions";
import {
  AnalyticsDashboard,
  type AnalyticsData,
} from "@/components/platform/analytics-dashboard";
import { LeadsTable } from "@/components/platform/leads-table";

const sections: Record<string, { title: string; description: string; status: string }> = {
  overview: { title: "Workspace overview", description: "Your workspace entry point and available modules.", status: "Core identity and access foundation" },
  leads: { title: "Platform sales leads", description: "TheCodexThrill's platform-owned prospect records.", status: "Connected to Supabase Cloud" },
  clients: { title: "Organizations", description: "Organizations and current lifecycle state.", status: "Core identity schema" },
  projects: { title: "Projects", description: "Project delivery records and ownership.", status: "Phase 2 delivery module" },
  tasks: { title: "Tasks", description: "Work items, assignees, and due dates.", status: "Phase 2 delivery module" },
  team: { title: "Team", description: "Invited platform users and staff access.", status: "Invitation lifecycle is active" },
  roles: { title: "Roles & access", description: "Current role assignments and access boundaries.", status: "Role-Based Access Control matrix & invariants" },
  content: { title: "CMS pages", description: "Public page content and publication state.", status: "Phase 2 delivery module" },
  blog: { title: "Blog", description: "Editorial drafts and publication state.", status: "Phase 2 delivery module" },
  portfolio: { title: "Portfolio", description: "Work approved for public display.", status: "Phase 2 delivery module" },
  support: { title: "Support", description: "Support requests and queue ownership.", status: "Phase 2 delivery module" },
  files: { title: "Files", description: "Organization-scoped file metadata and access.", status: "Phase 2 delivery module" },
  billing: { title: "Billing", description: "Invoices and payment status.", status: "Phase 2 delivery module" },
  analytics: { title: "Analytics", description: "Reports derived from connected records.", status: "Live platform & pipeline analytics" },
  notifications: { title: "Notifications", description: "Account and workspace notifications.", status: "Real-time security & system notices" },
  settings: { title: "Settings", description: "Your account and organization settings.", status: "Account & session security settings" },
  "audit-logs": { title: "Audit events", description: "Traceable records of privileged activity.", status: "Live database audit trail" },
  invoices: { title: "Invoices", description: "Invoices and commercial payment history.", status: "Phase 2 delivery module" },
};

const stages = ["new", "contacted", "qualified", "converted", "closed"] as const;
const sources = ["website", "admin", "referral", "import", "other"] as const;
const statuses = ["active", "suspended", "deleted"] as const;

export async function WorkspaceContent({
  kind,
  section,
  notice,
  roles = [],
  selectedId,
}: {
  kind: "admin" | "portal";
  section: string[];
  notice?: string;
  roles?: string[];
  selectedId?: string;
}) {
  const targetId = selectedId || (section.length > 1 ? section[1] : undefined);
  if (section.length > 2) notFound();
  if (section.length > 1 && section[0] !== "leads" && section[0] !== "projects" && section[0] !== "tasks") notFound();
  const key = section[0] ?? "overview";
  const page = sections[key];
  if (!page) return <section className="module-hold"><div><strong>Page not found</strong><p>This workspace route does not map to a module.</p><Link className="text-link" href={kind === "admin" ? "/admin" : "/portal"}>Return to overview</Link></div></section>;

  if (kind === "admin" && key === "overview") return <Dashboard roles={roles} />;

  if (kind === "portal" && key === "overview") {
    const supabase = await createClient();
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id, status, organizations(name, status)")
      .eq("status", "active");

    return <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">CLIENT PORTAL</p>
        <h2>Your workspace overview</h2>
        <p>Access your organization projects, deliverables, invoices, and support requests.</p>
        <div className="module-stat-grid" style={{ marginTop: "20px" }}>
          <Link className="module-stat" href="/portal/projects"><span>Projects</span><strong>Active</strong><small>Delivery &amp; milestones</small></Link>
          <Link className="module-stat" href="/portal/tasks"><span>Tasks</span><strong>In progress</strong><small>Work items</small></Link>
          <Link className="module-stat" href="/portal/files"><span>Files</span><strong>Shared</strong><small>Documents &amp; assets</small></Link>
          <Link className="module-stat" href="/portal/support"><span>Support</span><strong>Open queue</strong><small>Help requests</small></Link>
        </div>
      </section>

      <section className="module-panel">
        <h2>Active organizations</h2>
        {memberships && memberships.length > 0 ? (
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr><th>Organization</th><th>Status</th><th>Access</th></tr></thead>
              <tbody>
                {memberships.map((m) => {
                  const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
                  return (
                    <tr key={m.organization_id}>
                      <td><strong>{org?.name ?? "Organization"}</strong></td>
                      <td><span className="record-status">{org?.status ?? m.status}</span></td>
                      <td>Active member</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="module-empty">Your account is connected. Organization records will appear once provisioned by your administrator.</p>
        )}
      </section>
    </div>;
  }

  if (kind === "admin" && key === "team") {
    const supabase = await createClient();
    const [{ data: invitationData, error: invitationError }, { data: userData, error: userError }] = await Promise.all([
      supabase.rpc("list_platform_invitations"),
      supabase.rpc("list_platform_users"),
    ]);
    if (invitationError) console.error("[admin.team.invitations] list RPC failed", { code: safeInvitationListErrorCode(invitationError.code) });
    const invitations = (invitationData ?? []) as { id: string; email: string; role: string; status: string; created_at: string; expires_at: string; auth_user_id: string | null; resend_count: number; last_resent_at: string | null; archived_at: string | null }[];
    const users = (userData ?? []) as { user_id: string; email: string; display_name: string | null; roles: string[]; created_at: string; email_confirmed: boolean }[];
    const canAssignPlatformAdmin = roles.includes("super_admin");
    return <div className="workspace-content">
      <section className="module-panel"><p className="eyebrow">INVITATION ONLY</p><h2>Invite a platform user</h2><p>Invitations bind a one-hour, single-use role. Only the Super Admin can invite a Platform Admin; Super Admin and Platform Admin can invite Developer or Support Staff.</p><InvitationForm /></section>
      <section className="module-panel"><h2>Staff accounts</h2><p>Platform roles require a confirmed invited account and verified MFA. Role changes are audited and enforced by Supabase.</p>
        {userError ? <p className="module-alert" role="alert">Staff records are unavailable under this session. Verify the account has platform administration access and an AAL2 session.</p> : users.length === 0 ? <p className="module-empty">No invited staff accounts are available.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Account</th><th>Platform role</th><th>Joined</th><th>Manage role</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><strong>{user.display_name || user.email.split("@")[0]}</strong><small>{user.email}{user.email_confirmed ? " · Email confirmed" : " · Email not confirmed"}</small></td><td>{user.roles.length ? user.roles.map((role) => role.replaceAll("_", " ")).join(", ") : "No platform role"}</td><td>{new Date(user.created_at).toLocaleDateString()}</td><td><PlatformRoleActions canAssignPlatformAdmin={canAssignPlatformAdmin} emailConfirmed={user.email_confirmed} roles={user.roles} userId={user.user_id} /></td></tr>)}</tbody></table></div>}
      </section>
      <section className="module-panel"><h2>Invitations</h2>{invitationError ? <p className="module-alert" role="alert">{invitationListFailureMessage(invitationError.code)}</p> : invitations.length === 0 ? <p className="module-empty">No invitations yet.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Expires</th><th>Resent</th><th>Archived</th><th>Actions</th></tr></thead><tbody>{invitations.map((invitation) => { const canManageInvitation = roles.includes("super_admin") || (roles.includes("platform_admin") && invitation.role !== "platform_admin"); return <tr key={invitation.id}><td>{invitation.email}</td><td>{invitation.role.replaceAll("_", " ")}</td><td>{invitation.status}{invitation.archived_at ? " · Archived" : ""}</td><td>{new Date(invitation.created_at).toLocaleString()}</td><td>{new Date(invitation.expires_at).toLocaleString()}</td><td>{invitation.resend_count ? <>{invitation.resend_count} · {invitation.last_resent_at ? new Date(invitation.last_resent_at).toLocaleString() : "time unavailable"}</> : "Never"}</td><td>{invitation.archived_at ? new Date(invitation.archived_at).toLocaleString() : "—"}</td><td>{canManageInvitation && !invitation.archived_at && (invitation.status === "pending" || invitation.status === "expired" || invitation.status === "accepted" || invitation.status === "revoked") && <InvitationRowActions canArchive={invitation.status !== "pending"} canResend={invitation.status === "pending" || invitation.status === "expired"} canRevoke={invitation.status === "pending"} id={invitation.id} />}</td></tr>; })}</tbody></table></div>}</section>
    </div>;
  }

  if (kind === "admin" && key === "leads") {
    const supabase = await createClient();
    const { data: allLeads, error } = await supabase.from("platform_sales_leads")
      .select("id, contact_name, email, company_name, message, stage, source, follow_up_at, created_at")
      .order("created_at", { ascending: false }).limit(100);

    if (error) return <ConnectionError title="Lead records are unavailable" description="The request failed under the current account's database permissions." />;
    const leads = allLeads ?? [];

    if (targetId) {
      const lead = leads.find((l) => l.id === targetId) ?? (await supabase.from("platform_sales_leads").select("*").eq("id", targetId).maybeSingle()).data;

      if (!lead) {
        return (
          <div className="workspace-content">
            <section className="module-panel">
              <Link className="text-link" href="/admin/leads" style={{ marginBottom: "16px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ArrowLeft size={14} /> Back to all leads
              </Link>
              <div className="module-alert" role="alert" style={{ marginTop: "12px" }}>
                <strong>Lead not found</strong>
                <p>The requested lead record could not be found or has been removed from the platform database.</p>
                <div style={{ marginTop: "12px" }}>
                  <Link className="button button-small button-secondary" href="/admin/leads">
                    Return to leads directory
                  </Link>
                </div>
              </div>
            </section>
          </div>
        );
      }

      return (
        <div className="workspace-content">
          {notice && <Notice state={notice} />}
          <section className="module-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <Link className="text-link" href="/admin/leads" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ArrowLeft size={14} /> Back to leads directory
              </Link>
              <span className="record-status" style={{ fontSize: "12px", textTransform: "uppercase" }}>
                Stage: {lead.stage}
              </span>
            </div>

            <div className="lead-detail-header" style={{ marginTop: "20px" }}>
              <p className="eyebrow">LEAD PROFILE · CRM RECORD</p>
              <h2 style={{ margin: "6px 0 4px" }}>{lead.contact_name}</h2>
              <p style={{ color: "var(--muted)", margin: 0 }}>
                {lead.company_name ? `${lead.company_name} · ` : ""}Acquired via {lead.source}
              </p>
            </div>

            <div className="detail-grid" style={{ marginTop: "24px" }}>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Contact Email</small>
                <a href={`mailto:${lead.email}`} style={{ color: "var(--gold)", fontSize: "14px", fontWeight: 500, wordBreak: "break-all" }}>
                  {lead.email}
                </a>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Company / Organization</small>
                <strong style={{ fontSize: "14px" }}>{lead.company_name || "Direct Individual / Unspecified"}</strong>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Inbound Source</small>
                <strong style={{ fontSize: "14px", textTransform: "capitalize" }}>{lead.source}</strong>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Created Date &amp; Time</small>
                <strong style={{ fontSize: "14px" }}>{new Date(lead.created_at).toLocaleString()}</strong>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Scheduled Follow-up</small>
                <strong style={{ fontSize: "14px" }}>
                  {lead.follow_up_at ? new Date(lead.follow_up_at).toLocaleString() : "None scheduled"}
                </strong>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Lifecycle Stage</small>
                <strong style={{ fontSize: "14px", textTransform: "capitalize" }}>{lead.stage}</strong>
              </div>
            </div>

            <div style={{ marginTop: "24px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface)" }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 10px" }}>Project Overview &amp; Message Notes</h3>
              <p style={{ color: "var(--foreground)", whiteSpace: "pre-wrap", lineHeight: "1.7", margin: 0, fontSize: "14px" }}>
                {lead.message || "No project message recorded."}
              </p>
            </div>

            <div style={{ marginTop: "32px", padding: "20px", border: "1px solid var(--line-strong)", borderRadius: "14px", background: "var(--surface-raised)" }}>
              <h3 style={{ fontSize: "16px", margin: "0 0 14px" }}>Update Lead Information &amp; Pipeline Stage</h3>
              <form action={updateLeadAction} className="auth-form lead-create-form">
                <input type="hidden" name="id" value={lead.id} />
                <label>
                  Contact Name *
                  <input name="contact_name" defaultValue={lead.contact_name} required maxLength={160} />
                </label>
                <label>
                  Email Address *
                  <input name="email" type="email" defaultValue={lead.email} required maxLength={320} />
                </label>
                <label>
                  Company Name
                  <input name="company_name" defaultValue={lead.company_name ?? ""} maxLength={160} />
                </label>
                <label>
                  Pipeline Stage *
                  <select name="stage" defaultValue={lead.stage}>
                    {stages.map((item) => (
                      <option key={item} value={item}>{item.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Lead Source *
                  <select name="source" defaultValue={lead.source}>
                    {sources.map((item) => (
                      <option key={item} value={item}>{item.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Scheduled Follow-up
                  <input
                    type="datetime-local"
                    name="follow_up_at"
                    defaultValue={lead.follow_up_at ? new Date(lead.follow_up_at).toISOString().slice(0, 16) : ""}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Inbound Message &amp; Internal Notes
                  <textarea name="message" defaultValue={lead.message ?? ""} maxLength={10000} rows={5} />
                </label>
                <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1", marginTop: "8px" }}>
                  <button className="button button-gold" type="submit">
                    Save Changes
                  </button>
                  <Link className="button button-secondary" href="/admin/leads">
                    Cancel
                  </Link>
                </div>
              </form>

              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
                <form
                  action={deleteLeadAction}
                  onSubmit={(e) => {
                    if (!confirm(`Are you sure you want to delete lead ${lead.contact_name}? This cannot be undone.`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="button button-small button-danger" type="submit">
                    Delete Lead Record
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="workspace-content">
        {notice && <Notice state={notice} />}
        <section className="module-panel">
          <div className="module-heading" style={{ marginTop: 0 }}>
            <div>
              <p className="eyebrow">PLATFORM CRM · INBOUND LEADS</p>
              <h2>Sales lead records</h2>
              <p>{leads.length} records returned. Click any lead or &apos;Open&apos; to inspect full details, update stage, or manage follow-up.</p>
            </div>
            <details className="module-heading-action" style={{ cursor: "pointer" }}>
              <summary className="button button-gold" style={{ listStyle: "none" }}>
                + New Lead
              </summary>
              <div style={{ marginTop: "14px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
                <form action={createLeadAction} className="auth-form lead-create-form">
                  <label>Contact name *<input name="contact_name" required maxLength={160} /></label>
                  <label>Email *<input name="email" type="email" required maxLength={320} /></label>
                  <label>Company<input name="company_name" maxLength={160} /></label>
                  <label>Source<select name="source" defaultValue="admin">{sources.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
                  <label style={{ gridColumn: "1 / -1" }}>Message / Overview<textarea name="message" maxLength={10000} rows={3} /></label>
                  <input type="hidden" name="stage" value="new" />
                  <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                    <button className="button button-gold" type="submit">Create lead record</button>
                  </div>
                </form>
              </div>
            </details>
          </div>

          {leads.length === 0 ? (
            <p className="module-empty">No lead records yet. Inquiries submitted through /contact will appear here automatically.</p>
          ) : (
            <>
              {/* Direct routing verification: /admin/leads?id= */}
              <LeadsTable leads={leads} />
            </>
          )}
          <p className="module-note" style={{ marginTop: "16px" }}>
            Super Admin and Platform Admin can inspect full inquiries, update stages, schedule follow-ups, or permanently remove test leads. Direct lead deep-links: <code style={{ fontSize: "11px" }}>/admin/leads?id=</code>
          </p>
        </section>
      </div>
    );
  }

  if (kind === "admin" && key === "clients") {
    const supabase = await createClient();
    const { data, error } = await supabase.from("organizations").select("id, name, status, created_at, deleted_at").order("created_at", { ascending: false }).limit(100);
    if (error) return <ConnectionError title="Organizations are unavailable" description="The request failed under the current account's database permissions." />;
    return <div className="workspace-content">{notice && <Notice state={notice} />}
      <section className="module-panel"><p className="eyebrow">ORGANIZATION DIRECTORY</p><h2>Organizations</h2><p>{data.length} records returned, including suspended and soft-deleted organizations.</p>
        <form action={createOrganizationAction} className="auth-form lead-create-form"><label>Organization name<input name="name" required maxLength={160} /></label><button className="button-gold" type="submit">Create organization</button></form>
        {data.length === 0 ? <p className="module-empty">No organizations are registered.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Organization</th><th>Lifecycle</th><th>Created</th><th>Manage</th></tr></thead><tbody>{data.map((org) => <tr key={org.id}>
          <td>{org.name}</td><td>{org.status}</td><td>{new Date(org.created_at).toLocaleDateString()}</td>
          <td><details><summary>Edit</summary><form action={updateOrganizationAction} className="row-edit-form">
            <input type="hidden" name="id" value={org.id} />
            <label>Name<input name="name" defaultValue={org.name} required maxLength={160} /></label>
            <label>Lifecycle<select name="status" defaultValue={org.status}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="button-secondary" type="submit">Save changes</button>
          </form></details></td>
        </tr>)}</tbody></table></div>}
        <p className="module-note">Deleting is a reversible lifecycle status change; organization and audit data remain in place.</p>
      </section></div>;
  }

  if (kind === "admin" && key === "audit-logs") {
    const supabase = await createClient();
    const { data: auditEvents, error } = await supabase
      .from("audit_events")
      .select("id, occurred_at, actor_user_id, scope, action, target_type, target_id, details")
      .order("occurred_at", { ascending: false })
      .limit(100);

    return <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">IMMUTABLE LOGS · LIVE</p>
        <h2>Security audit trail</h2>
        <p>Attributable, timestamped records of administrative actions, authentication milestones, and role assignments.</p>
        {error ? (
          <p className="module-alert" role="alert">
            Audit events are unavailable under this session. Super Admin access and verified AAL2 MFA are required to read audit logs.
          </p>
        ) : !auditEvents || auditEvents.length === 0 ? (
          <p className="module-empty">No audit events recorded yet.</p>
        ) : (
          <div className="module-table-wrap">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Scope</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.occurred_at).toLocaleString()}</td>
                    <td>
                      <span className="record-status">
                        {event.scope}
                      </span>
                    </td>
                    <td><strong>{event.action}</strong></td>
                    <td>{event.target_type}{event.target_id ? ` · ${event.target_id.slice(0, 8)}…` : ""}</td>
                    <td>
                      <small style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--muted)" }}>
                        {JSON.stringify(event.details)}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>;
  }

  if (kind === "admin" && key === "roles") {
    return <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">ACCESS BOUNDARIES</p>
        <h2>Role-Based Access Control (RBAC)</h2>
        <p>The platform separates global platform roles from organization-scoped tenant roles. All role boundaries are enforced by Supabase Row-Level Security.</p>
        <div className="workspace-shortcuts" style={{ marginTop: "16px" }}>
          <Link className="button button-gold" href="/admin/team">Manage team roles <ArrowRight size={15} /></Link>
          <Link className="button button-secondary" href="/account/security">Account MFA status <ShieldCheck size={15} /></Link>
        </div>
      </section>

      <section className="module-panel">
        <h2>Platform roles (Global)</h2>
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr><th>Role</th><th>MFA Required</th><th>Permissions &amp; Scope</th><th>Assignment Authority</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Super Admin</strong></td>
                <td><span className="record-status">Yes (AAL2)</span></td>
                <td>Singleton platform governance, assign Platform Admins, oversee owner transfers, read audit logs.</td>
                <td>Initial bootstrap / Atomic transfer only</td>
              </tr>
              <tr>
                <td><strong>Platform Admin</strong></td>
                <td><span className="record-status">Yes (AAL2)</span></td>
                <td>Manage platform sales leads, organizations, invite developer/support staff.</td>
                <td>Super Admin only</td>
              </tr>
              <tr>
                <td><strong>Developer</strong></td>
                <td>Standard</td>
                <td>Platform delivery, technical project access, task updates.</td>
                <td>Super Admin or Platform Admin</td>
              </tr>
              <tr>
                <td><strong>Support Staff</strong></td>
                <td>Standard</td>
                <td>Customer support ticket triage, client enquiry follow-up.</td>
                <td>Super Admin or Platform Admin</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="module-panel">
        <h2>Organization roles (Tenant)</h2>
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr><th>Role</th><th>MFA Required</th><th>Tenant Scope</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Organization Owner</strong></td>
                <td><span className="record-status">Yes (AAL2)</span></td>
                <td>Full tenant ownership, manage billing, organization settings, approve projects.</td>
              </tr>
              <tr>
                <td><strong>Organization Admin</strong></td>
                <td><span className="record-status">Yes (AAL2)</span></td>
                <td>Tenant administration, invite members, oversee tasks and shared documents.</td>
              </tr>
              <tr>
                <td><strong>Project Manager</strong></td>
                <td>Standard</td>
                <td>Project milestone oversight, task assignment, progress tracking.</td>
              </tr>
              <tr>
                <td><strong>Client Member</strong></td>
                <td>Standard</td>
                <td>Customer view: track project deliverables, view shared invoices and files.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>;
  }

  if (kind === "admin" && key === "analytics") {
    const supabase = await createClient();
    const [
      leadsResult,
      orgsResult,
      usersResult,
      invitesResult,
      projectsResult,
      tasksResult,
      invoicesResult,
      ticketsResult,
    ] = await Promise.all([
      supabase.from("platform_sales_leads").select("stage, created_at, source"),
      supabase.from("organizations").select("status, created_at, name"),
      supabase.rpc("list_platform_users"),
      supabase.rpc("list_platform_invitations"),
      supabase.from("tenant_projects").select("status, progress_pct, created_at, name"),
      supabase.from("tenant_tasks").select("status, priority, created_at"),
      supabase.from("tenant_invoices").select("amount_cents, status, currency, due_date, paid_at, created_at"),
      supabase.from("support_tickets").select("status, priority, category, created_at"),
    ]);

    const leads = (leadsResult.data ?? []) as AnalyticsData["leads"];
    const orgs = (orgsResult.data ?? []) as AnalyticsData["organizations"];
    const staff = (usersResult.data ?? []) as unknown[];
    const invites = (invitesResult.data ?? []) as { status: string }[];
    const projects = (projectsResult.data ?? []) as AnalyticsData["projects"];
    const tasks = (tasksResult.data ?? []) as AnalyticsData["tasks"];
    const invoices = (invoicesResult.data ?? []) as AnalyticsData["invoices"];
    const tickets = (ticketsResult.data ?? []) as AnalyticsData["tickets"];

    const analyticsData: AnalyticsData = {
      leads,
      organizations: orgs,
      staffCount: staff.length,
      pendingInvitesCount: invites.filter((i) => i.status === "pending").length,
      projects,
      tasks,
      invoices,
      tickets,
    };

    return <AnalyticsDashboard data={analyticsData} />;
  }

  if (key === "settings") {
    const supabase = await createClient();
    const [{ data: { user } }, { data: assurance }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    const currentAal = assurance?.currentLevel ?? "aal1";
    return <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">ACCOUNT &amp; ENVIRONMENT</p>
        <h2>Workspace settings</h2>
        <p>Manage your authenticated account, multi-factor security credentials, and session state.</p>
        <dl className="detail-list" style={{ marginTop: "20px" }}>
          <dt>Authenticated account</dt>
          <dd>{user?.email ?? "Unavailable"}</dd>
          <dt>Assigned roles</dt>
          <dd>{roles.length ? roles.map((r) => r.replaceAll("_", " ")).join(", ") : "None"}</dd>
          <dt>Session assurance level</dt>
          <dd>{currentAal === "aal2" ? <span className="record-status">Verified MFA (AAL2)</span> : "Standard (AAL1)"}</dd>
          <dt>Backend</dt>
          <dd>Supabase Cloud (ap-northeast-2)</dd>
        </dl>
        <div className="workspace-shortcuts" style={{ marginTop: "20px" }}>
          <Link className="button button-gold" href="/account/security">Configure TOTP authenticator <ShieldCheck size={15} /></Link>
          <form action={signOutAction}><button className="button button-secondary" type="submit">Sign out</button></form>
        </div>
      </section>

      <section className="module-panel">
        <h2>Security policies</h2>
        <p>Administrative and tenant roles enforce strict Zero-Trust constraints:</p>
        <ul className="auth-feature-list" style={{ marginTop: "14px", lineHeight: "1.8" }}>
          <li>Mandatory TOTP MFA at AAL2 for all privileged operations.</li>
          <li>PostgreSQL Row-Level Security isolates all organization records.</li>
          <li>All changes are audited and recorded in immutable database logs.</li>
        </ul>
      </section>
    </div>;
  }

  if (key === "notifications") {
    const supabase = await createClient();
    const [{ data: { user } }, { data: assurance }, { data: userNotifs }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from("user_notifications").select("*").order("created_at", { ascending: false }).limit(25),
    ]);

    const notifications = userNotifs ?? [];

    return (
      <div className="workspace-content">
        <section className="module-panel">
          <p className="eyebrow">SECURITY &amp; SYSTEM FEEDS</p>
          <h2>Notifications</h2>
          <p>Real-time system events, account security notices, and workspace activity.</p>
          <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="activity-row" style={{ opacity: n.is_read ? 0.7 : 1 }}>
                  <span className="activity-dot" style={{ background: n.is_read ? "var(--muted)" : "var(--gold)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{n.title}</strong>
                      {!n.is_read && (
                        <form action={markNotificationReadAction} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="return_path" value={kind} />
                          <button type="submit" className="button button-secondary" style={{ padding: "2px 8px", fontSize: "11px" }}>
                            Mark as read
                          </button>
                        </form>
                      )}
                    </div>
                    <p>{n.message}</p>
                    <small>{new Date(n.created_at).toLocaleString()}</small>
                  </div>
                </div>
              ))
            ) : null}

            <div className="activity-row">
              <span className="activity-dot" />
              <div>
                <strong>Multi-Factor Authentication Status</strong>
                <p>{assurance?.currentLevel === "aal2" ? "Your session is verified with AAL2 MFA protection." : "Enhance your account security by registering a TOTP authenticator device."}</p>
                <small>{new Date().toLocaleDateString()}</small>
              </div>
            </div>
            <div className="activity-row">
              <span className="activity-dot" />
              <div>
                <strong>Authenticated Workspace Session</strong>
                <p>Signed in as {user?.email} with roles: {roles.map((r) => r.replaceAll("_", " ")).join(", ")}.</p>
                <small>{new Date().toLocaleDateString()}</small>
              </div>
            </div>
            <div className="activity-row">
              <span className="activity-dot" />
              <div>
                <strong>Supabase Cloud Protection</strong>
                <p>All workspace queries are safeguarded by database Row-Level Security.</p>
                <small>{new Date().toLocaleDateString()}</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (kind === "admin" && (key === "content" || key === "cms")) {
    const supabase = await createClient();
    const [
      pagesResult,
      servicesResult,
      postsResult,
      caseStudiesResult,
      settingsResult,
      slidesResult,
      capabilitiesResult,
      processStepsResult,
      industriesResult,
      techStackResult,
      faqsResult,
    ] = await Promise.all([
      supabase.from("cms_pages").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_services").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("cms_case_studies").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_site_settings").select("*").order("key", { ascending: true }),
      supabase.from("cms_hero_slides").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_capabilities").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_process_steps").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_industries").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_tech_stack").select("*").order("sort_order", { ascending: true }),
      supabase.from("cms_faqs").select("*").order("sort_order", { ascending: true }),
    ]);

    const pages = (pagesResult.data ?? []) as CmsPageRecord[];
    const services = (servicesResult.data ?? []) as CmsServiceRecord[];
    const posts = (postsResult.data ?? []) as CmsPostRecord[];
    const caseStudies = (caseStudiesResult.data ?? []) as CmsCaseStudyRecord[];
    const settings = (settingsResult.data ?? []) as CmsSettingRecord[];
    const heroSlides = (slidesResult.data ?? []) as CmsHeroSlideRecord[];
    const capabilities = (capabilitiesResult.data ?? []) as CmsCapabilityRecord[];
    const processSteps = (processStepsResult.data ?? []) as CmsProcessStepRecord[];
    const industries = (industriesResult.data ?? []) as CmsIndustryRecord[];
    const techStack = (techStackResult.data ?? []) as CmsTechStackRecord[];
    const faqs = (faqsResult.data ?? []) as CmsFaqRecord[];

    const heroSettingObj = settings.find((s) => s.key === "hero_content")?.value as Record<string, string> | undefined;

    return (
      <UnifiedCmsManager
        pages={pages}
        services={services}
        posts={posts}
        caseStudies={caseStudies}
        settings={settings}
        heroSlides={heroSlides}
        heroSettings={heroSettingObj}
        capabilities={capabilities}
        processSteps={processSteps}
        industries={industries}
        techStack={techStack}
        faqs={faqs}
      />
    );
  }

  if (kind === "admin" && key === "blog") {
    const supabase = await createClient();
    const { data } = await supabase.from("cms_posts").select("*").order("created_at", { ascending: false });
    const posts = (data ?? []) as CmsPostRecord[];
    return <CmsBlogManager posts={posts} />;
  }

  if (kind === "admin" && key === "portfolio") {
    const supabase = await createClient();
    const { data } = await supabase.from("cms_case_studies").select("*").order("sort_order", { ascending: true });
    const caseStudies = (data ?? []) as CmsCaseStudyRecord[];
    return <CmsPortfolioManager caseStudies={caseStudies} />;
  }

  if (key === "support") {
    const supabase = await createClient();
    const [ticketsResult, orgsResult] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("*, messages:support_ticket_messages(*)")
        .order("created_at", { ascending: false }),
      kind === "admin"
        ? supabase.from("organizations").select("id, name").eq("status", "active")
        : supabase.from("organization_memberships").select("organization_id, organizations(id, name)").eq("status", "active"),
    ]);

    const tickets = (ticketsResult.data ?? []) as SupportTicketRecord[];
    const orgs = (
      kind === "admin"
        ? (orgsResult.data ?? [])
        : ((orgsResult.data ?? []) as { organization_id: string; organizations: { id: string; name: string } | { id: string; name: string }[] }[])
            .map((m) => (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations))
            .filter(Boolean)
    ) as { id: string; name: string }[];

    return (
      <SupportManager
        tickets={tickets}
        isStaff={kind === "admin"}
        userOrganizations={orgs}
        notice={notice}
      />
    );
  }

  if (key === "projects" || key === "tasks") {
    const supabase = await createClient();
    const [projectsResult, orgsResult] = await Promise.all([
      supabase
        .from("tenant_projects")
        .select("*, tasks:tenant_tasks(*)")
        .order("created_at", { ascending: false }),
      kind === "admin"
        ? supabase.from("organizations").select("id, name").eq("status", "active")
        : supabase.from("organization_memberships").select("organization_id, organizations(id, name)").eq("status", "active"),
    ]);

    const projects = (projectsResult.data ?? []) as ProjectRecord[];
    const orgs = (
      kind === "admin"
        ? (orgsResult.data ?? [])
        : ((orgsResult.data ?? []) as { organization_id: string; organizations: { id: string; name: string } | { id: string; name: string }[] }[])
            .map((m) => (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations))
            .filter(Boolean)
    ) as { id: string; name: string }[];

    return (
      <ProjectManager
        projects={projects}
        isStaff={kind === "admin"}
        userOrganizations={orgs}
        currentMode={key === "tasks" ? "tasks" : "projects"}
        notice={notice}
      />
    );
  }

  if (key === "files") {
    const supabase = await createClient();
    const [documentsResult, orgsResult] = await Promise.all([
      supabase
        .from("tenant_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      kind === "admin"
        ? supabase.from("organizations").select("id, name").eq("status", "active")
        : supabase.from("organization_memberships").select("organization_id, organizations(id, name)").eq("status", "active"),
    ]);

    const documents = (documentsResult.data ?? []) as DocumentRecord[];
    const orgs = (
      kind === "admin"
        ? (orgsResult.data ?? [])
        : ((orgsResult.data ?? []) as { organization_id: string; organizations: { id: string; name: string } | { id: string; name: string }[] }[])
            .map((m) => (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations))
            .filter(Boolean)
    ) as { id: string; name: string }[];

    return (
      <DocumentManager
        documents={documents}
        isStaff={kind === "admin"}
        userOrganizations={orgs}
        notice={notice}
      />
    );
  }

  if ((kind === "admin" && key === "billing") || (kind === "portal" && key === "invoices")) {
    const supabase = await createClient();
    const [invoicesResult, orgsResult] = await Promise.all([
      supabase
        .from("tenant_invoices")
        .select("*")
        .order("created_at", { ascending: false }),
      kind === "admin"
        ? supabase.from("organizations").select("id, name").eq("status", "active")
        : supabase.from("organization_memberships").select("organization_id, organizations(id, name)").eq("status", "active"),
    ]);

    const invoices = (invoicesResult.data ?? []) as InvoiceRecord[];
    const orgs = (
      kind === "admin"
        ? (orgsResult.data ?? [])
        : ((orgsResult.data ?? []) as { organization_id: string; organizations: { id: string; name: string } | { id: string; name: string }[] }[])
            .map((m) => (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations))
            .filter(Boolean)
    ) as { id: string; name: string }[];

    return (
      <BillingManager
        invoices={invoices}
        isStaff={kind === "admin"}
        userOrganizations={orgs}
        notice={notice}
      />
    );
  }

  return (
    <section className="module-hold">
      <div>
        <strong>{page.status}</strong>
        <p>{page.description} This module is protected by Zero-Trust role boundaries.</p>
        {key === "overview" && (
          <nav className="workspace-shortcuts">
            {(kind === "admin"
              ? [["Leads", "/admin/leads"], ["Organizations", "/admin/clients"]]
              : [["Projects", "/portal/projects"], ["Tasks", "/portal/tasks"], ["Files", "/portal/files"]]
            ).map(([label, href]) => (
              <Link className="button button-secondary" href={href} key={href}>{label}</Link>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}

async function Dashboard({ roles }: { roles: string[] }) {
  const canReadLeads = roles.some((role) => role === "super_admin" || role === "platform_admin");
  const supabase = await createClient();
  const [leads, organizations] = await Promise.all([
    canReadLeads ? supabase.from("platform_sales_leads").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
    canReadLeads ? supabase.from("organizations").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
  ]);
  if (leads.error || organizations.error) return <ConnectionError title="Dashboard counts are unavailable" description="One or more count queries failed under the current account's database permissions." />;
  return <section className="workspace-content"><p className="eyebrow">DATABASE COUNTS · LIVE</p><h2>Workspace overview</h2><p>Counts reflect rows this signed-in role can read under database RLS.</p>
    <div className="workspace-shortcuts">
      {canReadLeads && <Link className="module-stat" href="/admin/leads"><span>Platform leads</span><strong>{leads.count ?? 0}</strong></Link>}
      {canReadLeads && <Link className="module-stat" href="/admin/clients"><span>Organizations</span><strong>{organizations.count ?? 0}</strong></Link>}
      {!canReadLeads && <p className="module-empty">No live dashboard counts are available for this role yet.</p>}
    </div>
    {canReadLeads && <nav className="workspace-shortcuts"><Link className="button button-secondary" href="/admin/leads">Open leads</Link><Link className="button button-secondary" href="/admin/clients">Open organizations</Link></nav>}
  </section>;
}

function Notice({ state }: { state: string }) {
  const copy: Record<string, string> = {
    created: "Record created.",
    updated: "Changes saved.",
    invalid: "Please check the submitted fields and try again.",
    save: "The database rejected this change. Check the current role, MFA level, and field values.",
  };
  return <p className={state === "invalid" || state === "save" ? "module-alert" : "module-success"} role="status">{copy[state] ?? "Request completed."}</p>;
}

function ConnectionError({ title, description }: { title: string; description: string }) {
  return <section className="module-hold" role="alert"><div><strong>{title}</strong><p>{description} No sample records are shown.</p></div></section>;
}
