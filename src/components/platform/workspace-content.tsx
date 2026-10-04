import Link from "next/link";
import { InvitationForm } from "@/components/auth/invitation-form";
import { InvitationRowActions } from "@/components/auth/invitation-row-actions";
import { PlatformRoleActions } from "@/components/platform/platform-role-actions";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createLeadAction,
  updateLeadAction,
  createOrganizationAction,
  updateOrganizationAction,
} from "@/lib/supabase/lead-actions";

const sections: Record<string, { title: string; description: string; status: string }> = {
  overview: { title: "Workspace overview", description: "Your workspace entry point and available modules.", status: "Core identity and access foundation" },
  leads: { title: "Platform sales leads", description: "TheCodexThrill's platform-owned prospect records.", status: "Connected to Supabase Cloud" },
  clients: { title: "Organizations", description: "Organizations and current lifecycle state.", status: "Core identity schema" },
  projects: { title: "Projects", description: "Project delivery records and ownership.", status: "Project schema not yet provisioned" },
  tasks: { title: "Tasks", description: "Work items, assignees, and due dates.", status: "Task schema not yet provisioned" },
  team: { title: "Team", description: "Invited platform users and staff access.", status: "Invitation lifecycle is active" },
  roles: { title: "Roles & access", description: "Current role assignments and access boundaries.", status: "Least-privilege role assignments are managed in Team and enforced by Supabase" },
  content: { title: "CMS pages", description: "Public page content and publication state.", status: "CMS schema not yet provisioned" },
  blog: { title: "Blog", description: "Editorial drafts and publication state.", status: "Blog schema not yet provisioned" },
  portfolio: { title: "Portfolio", description: "Work approved for public display.", status: "Portfolio schema not yet provisioned" },
  support: { title: "Support", description: "Support requests and queue ownership.", status: "Support schema not yet provisioned" },
  files: { title: "Files", description: "Organization-scoped file metadata and access.", status: "Storage policies and file schema not yet provisioned" },
  billing: { title: "Billing", description: "Invoices and payment status.", status: "Billing schema not yet provisioned" },
  analytics: { title: "Analytics", description: "Reports derived from connected records.", status: "Analytics sources are not yet provisioned" },
  notifications: { title: "Notifications", description: "Account and workspace notifications.", status: "Notification schema not yet provisioned" },
  settings: { title: "Settings", description: "Your account and organization settings.", status: "Settings schema not yet provisioned" },
  "audit-logs": { title: "Audit events", description: "Traceable records of privileged activity.", status: "Audit schema is deployed; event browsing is not yet implemented" },
  invoices: { title: "Invoices", description: "Invoices made available to your organization.", status: "Billing schema not yet provisioned" },
};

const stages = ["new", "contacted", "qualified", "converted", "closed"] as const;
const sources = ["website", "admin", "referral", "import", "other"] as const;
const statuses = ["active", "suspended", "deleted"] as const;

export async function WorkspaceContent({ kind, section, notice, roles = [] }: { kind: "admin" | "portal"; section: string[]; notice?: string; roles?: string[] }) {
  if (section.length > 1) notFound();
  const key = section[0] ?? "overview";
  const page = sections[key];
  if (!page) return <section className="module-hold"><div><strong>Page not found</strong><p>This workspace route does not map to a module.</p><Link className="text-link" href={kind === "admin" ? "/admin" : "/portal"}>Return to overview</Link></div></section>;

  if (kind === "admin" && key === "overview") return <Dashboard roles={roles} />;

  if (kind === "admin" && key === "team") {
    const supabase = await createClient();
    const [{ data: invitationData, error: invitationError }, { data: userData, error: userError }] = await Promise.all([
      supabase.rpc("list_platform_invitations"),
      supabase.rpc("list_platform_users"),
    ]);
    const invitations = (invitationData ?? []) as { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }[];
    const users = (userData ?? []) as { user_id: string; email: string; display_name: string | null; roles: string[]; created_at: string; email_confirmed: boolean }[];
    const canAssignPlatformAdmin = roles.includes("super_admin");
    return <div className="workspace-content">
      <section className="module-panel"><p className="eyebrow">INVITATION ONLY</p><h2>Invite a platform user</h2><p>Invitations bind a one-hour, single-use role. Only the Super Admin can invite a Platform Admin; Super Admin and Platform Admin can invite Developer or Support Staff.</p><InvitationForm /></section>
      <section className="module-panel"><h2>Staff accounts</h2><p>Platform roles require a confirmed invited account and verified MFA. Role changes are audited and enforced by Supabase.</p>
        {userError ? <p className="module-alert" role="alert">Staff records are unavailable under this session. Verify the account has platform administration access and an AAL2 session.</p> : users.length === 0 ? <p className="module-empty">No invited staff accounts are available.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Account</th><th>Platform role</th><th>Joined</th><th>Manage role</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><strong>{user.display_name || user.email.split("@")[0]}</strong><small>{user.email}{user.email_confirmed ? " · Email confirmed" : " · Email not confirmed"}</small></td><td>{user.roles.length ? user.roles.map((role) => role.replaceAll("_", " ")).join(", ") : "No platform role"}</td><td>{new Date(user.created_at).toLocaleDateString()}</td><td><PlatformRoleActions canAssignPlatformAdmin={canAssignPlatformAdmin} emailConfirmed={user.email_confirmed} roles={user.roles} userId={user.user_id} /></td></tr>)}</tbody></table></div>}
      </section>
      <section className="module-panel"><h2>Recent invitations</h2>{invitationError ? <p className="module-note">Invitation records are unavailable under this session.</p> : invitations.length === 0 ? <p className="module-empty">No invitations yet.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.id}><td>{invitation.email}</td><td>{invitation.role.replaceAll("_", " ")}</td><td>{invitation.status}</td><td>{new Date(invitation.expires_at).toLocaleString()}</td><td>{(invitation.status === "pending" || invitation.status === "expired") && <InvitationRowActions canRevoke={invitation.status === "pending"} id={invitation.id} />}</td></tr>)}</tbody></table></div>}</section>
    </div>;
  }
  if (kind === "admin" && key === "leads") {
    const supabase = await createClient();
    const { data, error } = await supabase.from("platform_sales_leads")
      .select("id, contact_name, email, company_name, message, stage, source, follow_up_at, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return <ConnectionError title="Lead records are unavailable" description="The request failed under the current account's database permissions." />;
    return <div className="workspace-content">
      {notice && <Notice state={notice} />}
      <section className="module-panel"><p className="eyebrow">LIVE DEVELOPMENT DATA</p><h2>Sales lead records</h2><p>{data.length} records returned, up to 100 most recent. Changes save to Supabase.</p>
        <form action={createLeadAction} className="auth-form lead-create-form">
          <label>Contact name<input name="contact_name" required maxLength={160} /></label>
          <label>Email<input name="email" type="email" required maxLength={320} /></label>
          <label>Company<input name="company_name" maxLength={160} /></label>
          <label>Source<select name="source" defaultValue="admin">{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Message<textarea name="message" maxLength={10000} /></label>
          <input type="hidden" name="stage" value="new" />
          <button className="button-gold" type="submit">Create lead</button>
        </form>
        {data.length === 0 ? <p className="module-empty">No lead records yet.</p> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Contact</th><th>Company</th><th>Stage</th><th>Source</th><th>Created</th><th>Edit</th></tr></thead><tbody>{data.map((lead) => <tr key={lead.id}>
          <td><strong>{lead.contact_name}</strong><small>{lead.email}</small></td><td>{lead.company_name ?? "—"}</td><td>{lead.stage}</td><td>{lead.source}</td><td>{new Date(lead.created_at).toLocaleDateString()}</td>
          <td><details><summary>Edit</summary><form action={updateLeadAction} className="row-edit-form">
            <input type="hidden" name="id" value={lead.id} />
            <label>Contact<input name="contact_name" defaultValue={lead.contact_name} required maxLength={160} /></label>
            <label>Email<input name="email" type="email" defaultValue={lead.email} required maxLength={320} /></label>
            <label>Company<input name="company_name" defaultValue={lead.company_name ?? ""} maxLength={160} /></label>
            <label>Stage<select name="stage" defaultValue={lead.stage}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Source<select name="source" defaultValue={lead.source}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Follow-up<input type="datetime-local" name="follow_up_at" defaultValue={lead.follow_up_at ? new Date(lead.follow_up_at).toISOString().slice(0, 16) : ""} /></label>
            <label>Message<textarea name="message" defaultValue={lead.message ?? ""} maxLength={10000} /></label>
            <button className="button-secondary" type="submit">Save changes</button>
          </form></details></td>
        </tr>)}</tbody></table></div>}
        <p className="module-note">Physical deletion is disabled by the deployed database grants. Close a lead by changing its stage.</p>
      </section></div>;
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

  const supported = kind === "admin" && ["overview", "leads", "clients"].includes(key);
  return <section className="module-hold"><div><strong>{page.status}</strong><p>{page.description} {supported ? "" : "This page is deliberately not populated with demo records or decorative actions."}</p>{key === "overview" && <nav className="workspace-shortcuts">{(kind === "admin" ? [["Leads", "/admin/leads"], ["Organizations", "/admin/clients"]] : [["Projects", "/portal/projects"], ["Tasks", "/portal/tasks"], ["Files", "/portal/files"]]).map(([label, href]) => <Link className="button button-secondary" href={href} key={href}>{label}</Link>)}</nav>}</div></section>;
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
