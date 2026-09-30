"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bell, BriefcaseBusiness, CheckSquare2, ChevronDown,
  CircleHelp, ClipboardList, CreditCard, FileText, FolderKanban,
  LayoutDashboard, Menu, MessageSquare, Search, Settings, ShieldCheck,
  Users, X,
} from "lucide-react";

import { ThemeToggle } from "@/components/site/theme-toggle";
import { signOutAction } from "@/lib/supabase/actions";

type PlatformRole = "super_admin" | "platform_admin" | "developer" | "support_staff";
type OrganizationRole = "organization_owner" | "organization_admin" | "project_manager" | "client_member";
type WorkspaceRole = PlatformRole | OrganizationRole;
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: WorkspaceRole[] };

const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: ["super_admin", "platform_admin", "developer", "support_staff"] },
  { href: "/admin/leads", label: "Leads", icon: Users, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/clients", label: "Clients", icon: BriefcaseBusiness, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, roles: ["super_admin", "platform_admin", "developer"] },
  { href: "/admin/tasks", label: "Tasks", icon: CheckSquare2, roles: ["super_admin", "platform_admin", "developer"] },
  { href: "/admin/team", label: "Team", icon: Users, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/roles", label: "Roles & access", icon: ShieldCheck, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/content", label: "Content", icon: FileText, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/blog", label: "Blog", icon: ClipboardList, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/portfolio", label: "Portfolio", icon: BriefcaseBusiness, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/support", label: "Support", icon: CircleHelp, roles: ["super_admin", "platform_admin", "support_staff"] },
  { href: "/admin/files", label: "Files", icon: FileText, roles: ["super_admin", "platform_admin", "developer"] },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/analytics", label: "Analytics", icon: Activity, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, roles: ["super_admin", "platform_admin", "developer", "support_staff"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin", "platform_admin"] },
  { href: "/admin/audit-logs", label: "Audit log", icon: ClipboardList, roles: ["super_admin"] },
];

const portalNavigation: NavItem[] = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, roles: ["organization_owner", "organization_admin", "project_manager", "client_member"] },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban, roles: ["organization_owner", "organization_admin", "project_manager", "client_member"] },
  { href: "/portal/tasks", label: "Tasks", icon: CheckSquare2, roles: ["organization_owner", "organization_admin", "project_manager", "client_member"] },
  { href: "/portal/files", label: "Files", icon: FileText, roles: ["organization_owner", "organization_admin", "client_member"] },
  { href: "/portal/invoices", label: "Invoices", icon: CreditCard, roles: ["organization_owner", "organization_admin", "client_member"] },
  { href: "/portal/support", label: "Support", icon: MessageSquare, roles: ["organization_owner", "organization_admin", "client_member"] },
  { href: "/portal/notifications", label: "Notifications", icon: Bell, roles: ["organization_owner", "organization_admin", "project_manager", "client_member"] },
  { href: "/portal/settings", label: "Settings", icon: Settings, roles: ["organization_owner", "organization_admin", "client_member"] },
];

const pageContent: Record<string, { title: string; description: string }> = {
  overview: { title: "Dashboard", description: "A live view of your authorized workspace." },
  leads: { title: "Leads", description: "Platform sales leads and relationship follow-up." },
  clients: { title: "Clients", description: "Organizations and client relationships." },
  projects: { title: "Projects", description: "Project status, milestones, and delivery context." },
  tasks: { title: "Tasks", description: "Work items, ownership, and due dates." },
  team: { title: "Team", description: "Platform users and team membership." },
  roles: { title: "Roles & access", description: "Platform permissions and scoped access assignments." },
  content: { title: "Content", description: "Manage public page content and navigation." },
  blog: { title: "Blog", description: "Editorial drafts and published articles." },
  portfolio: { title: "Portfolio", description: "Review work approved for publication." },
  support: { title: "Support", description: "Ticket queues and support ownership." },
  files: { title: "Files", description: "Documents controlled by verified ownership." },
  billing: { title: "Billing", description: "Invoices and payment status." },
  analytics: { title: "Analytics", description: "Reports from connected, validated records." },
  notifications: { title: "Notifications", description: "Notification history for this account." },
  settings: { title: "Settings", description: "Account and workspace settings." },
  "audit-logs": { title: "Audit log", description: "A traceable record of privileged actions." },
};

function Brand() {
  return <Link aria-label="TheCodexThrill home" className="platform-brand" href="/"><span className="platform-mark">T<span>C</span></span><span>TheCodex<span>Thrill</span></span></Link>;
}

function roleLabel(role: WorkspaceRole) {
  return role.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function PlatformShell({
  kind,
  section = [],
  roles,
  userEmail,
  children,
}: {
  kind: "admin" | "portal";
  section?: string[];
  roles: WorkspaceRole[];
  userEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const client = kind === "portal";
  const available = client ? portalNavigation : adminNavigation;
  const navigation = available.filter((item) => item.roles.some((role) => roles.includes(role)));
  const currentKey = section[0] ?? "overview";
  const active = pageContent[currentKey];
  const filteredNavigation = useMemo(
    () => navigation.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [navigation, query],
  );
  const primaryRole = roles.find((role) => client
    ? role.startsWith("organization_") || role === "project_manager" || role === "client_member"
    : !role.startsWith("organization_") && role !== "project_manager" && role !== "client_member") ?? roles[0];

  return (
    <div className={`platform-shell ${client ? "portal-shell" : "admin-shell"}`}>
      <aside aria-label={client ? "Client portal navigation" : "Admin navigation"} className={`platform-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-row"><Brand /><button aria-label="Close navigation" className="sidebar-close" onClick={() => setMenuOpen(false)} type="button"><X size={19} /></button></div>
        <p className="sidebar-caption">{client ? "ORGANIZATION SPACE" : "PLATFORM"}</p>
        <nav className="platform-nav">{filteredNavigation.map(({ href, label, icon: Icon }) => { const selected = pathname === href || (href !== "/admin" && href !== "/portal" && pathname.startsWith(`${href}/`)); return <Link aria-current={selected ? "page" : undefined} className={`platform-nav-link ${selected ? "is-active" : ""}`} href={href} key={href} onClick={() => setMenuOpen(false)}><Icon aria-hidden="true" size={17} /><span>{label}</span></Link>; })}{filteredNavigation.length === 0 && <p className="sidebar-no-results">No matching pages.</p>}</nav>
        <div className="sidebar-footer"><span className="connection-dot" /> Authenticated session</div>
      </aside>
      {menuOpen && <button aria-label="Close navigation menu" className="sidebar-scrim" onClick={() => setMenuOpen(false)} type="button" />}
      <div className="platform-main">
        <header className="platform-topbar"><button aria-label="Open navigation" aria-expanded={menuOpen} className="menu-trigger" onClick={() => setMenuOpen(true)} type="button"><Menu size={20} /></button><Brand /><label className="platform-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search workspace navigation</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace..." value={query} /></label><div className="platform-top-actions"><ThemeToggle />{navigation.some((item) => item.href.endsWith("notifications")) && <Link aria-label="Notifications" className="icon-action" href={client ? "/portal/notifications" : "/admin/notifications"}><Bell size={18} /></Link>}<details className="profile-menu"><summary><span className="profile-avatar">{userEmail.slice(0, 1).toUpperCase()}</span><span className="profile-label"><strong>{userEmail}</strong><small>{primaryRole ? roleLabel(primaryRole) : "Account"}</small></span><ChevronDown aria-hidden="true" size={15} /></summary><div className="profile-dropdown"><p>{roles.map(roleLabel).join(", ")}</p><Link href="/">Visit public site</Link><form action={signOutAction}><button className="profile-signout" type="submit">Sign out</button></form></div></details></div></header>
        <main className="platform-page" id="main-content">
          <nav aria-label="Breadcrumb" className="platform-breadcrumb"><Link href={client ? "/portal" : "/admin"}>{client ? "PORTAL" : "ADMIN"}</Link>{currentKey !== "overview" && <><span>/</span><Link href={`${client ? "/portal" : "/admin"}/${currentKey}`}>{active?.title ?? currentKey}</Link></>}{section[1] && <><span>/</span><span>Detail</span></>}</nav>
          {active && <div className="platform-page-heading"><div><p className="eyebrow">{client ? "CLIENT PORTAL" : "ADMIN WORKSPACE"}</p><h1>{active.title}</h1><p>{active.description}</p></div></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
