import { readFileSync } from "fs";
import { join } from "path";

console.log("============================================================");
console.log("GLOBAL ROUTING & NAVIGATION SMOKE VERIFICATION");
console.log("============================================================");

let passed = 0;
let failed = 0;

function assert(name, condition, details = "") {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} ${details ? "- " + details : ""}`);
    failed++;
  }
}

// 1. Verify Site Header Navigation Items
const siteHeaderPath = join(process.cwd(), "src", "components", "site", "site-header.tsx");
const siteHeaderContent = readFileSync(siteHeaderPath, "utf-8");

const requiredNavItems = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Work", href: "/portfolio" },
  { label: "About", href: "/about" },
  { label: "Insights", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact Us", href: "/contact" },
];

for (const item of requiredNavItems) {
  const hasLabel = siteHeaderContent.includes(`label: "${item.label}"`);
  const hasHref = siteHeaderContent.includes(`href: "${item.href}"`);
  assert(`SiteHeader contains navigation item '${item.label}' (${item.href})`, hasLabel && hasHref);
}

assert(
  "SiteHeader integrates auth-aware HeaderAuthAction",
  siteHeaderContent.includes("<HeaderAuthAction />")
);

// 2. Verify HeaderAuthAction Component Exists & Logic
const headerAuthActionPath = join(process.cwd(), "src", "components", "site", "header-auth-action.tsx");
const headerAuthActionContent = readFileSync(headerAuthActionPath, "utf-8");

assert(
  "HeaderAuthAction defaults unauthenticated visitors to /login",
  headerAuthActionContent.includes('setDestination("/login")') && headerAuthActionContent.includes('setLabel("Login")')
);

assert(
  "HeaderAuthAction routes authenticated users to /admin or /portal as 'Workspace'",
  headerAuthActionContent.includes('setDestination(isAdmin ? "/admin" : "/portal")') &&
  headerAuthActionContent.includes('setLabel("Workspace")')
);

// 3. Verify Login Page Redirects Authenticated Users to /auth/continue
const loginPagePath = join(process.cwd(), "src", "app", "login", "page.tsx");
const loginPageContent = readFileSync(loginPagePath, "utf-8");

assert(
  "Login page redirects active sessions to /auth/continue",
  loginPageContent.includes('redirect("/auth/continue")')
);

// 4. Verify Admin Leads Detail & Sub-Routing Support
const adminCatchAllPath = join(process.cwd(), "src", "app", "admin", "[[...section]]", "page.tsx");
const adminCatchAllContent = readFileSync(adminCatchAllPath, "utf-8");

assert(
  "Admin catch-all extracts selectedId from query and sub-path",
  adminCatchAllContent.includes("selectedId = query.id")
);

const workspaceContentPath = join(process.cwd(), "src", "components", "platform", "workspace-content.tsx");
const workspaceContent = readFileSync(workspaceContentPath, "utf-8");

assert(
  "WorkspaceContent implements full Lead Detail Panel",
  workspaceContent.includes("LEAD PROFILE · CRM RECORD") &&
  workspaceContent.includes("action={updateLeadAction}") &&
  workspaceContent.includes("action={deleteLeadAction}")
);

assert(
  "WorkspaceContent leads list links every record to /admin/leads?id=",
  workspaceContent.includes("/admin/leads?id=")
);

// 5. Verify Frozen Routing Integrity
const proxyPath = join(process.cwd(), "src", "proxy.ts");
const proxyContent = readFileSync(proxyPath, "utf-8");

assert(
  "Frozen Routing: proxy matcher protects /admin and /portal",
  proxyContent.includes("/admin/:path*") && proxyContent.includes("/portal/:path*")
);

// 6. Verify Phase 6 Required Routes & Authorization Boundaries
const requiredRouteFiles = [
  { route: "/", file: ["src", "app", "page.tsx"] },
  { route: "/services", file: ["src", "app", "services", "page.tsx"] },
  { route: "/portfolio", file: ["src", "app", "portfolio", "page.tsx"] },
  { route: "/contact", file: ["src", "app", "contact", "page.tsx"] },
  { route: "/login", file: ["src", "app", "login", "page.tsx"] },
  { route: "/admin (and /admin/analytics, /admin/settings, /admin/notifications)", file: ["src", "app", "admin", "[[...section]]", "page.tsx"] },
  { route: "/portal", file: ["src", "app", "portal", "[[...section]]", "page.tsx"] },
  { route: "/api/automation/run", file: ["src", "app", "api", "automation", "run", "route.ts"] },
  { route: "/api/admin/analytics/export", file: ["src", "app", "api", "admin", "analytics", "export", "route.ts"] },
];

for (const item of requiredRouteFiles) {
  const fullPath = join(process.cwd(), ...item.file);
  const content = readFileSync(fullPath, "utf-8");
  assert(`Required route handler exists and is non-empty: ${item.route}`, content.length > 50);
}

const accessContent = readFileSync(join(process.cwd(), "src", "lib", "supabase", "access.ts"), "utf-8");
assert(
  "Workspace access guard enforces authentication, section RBAC (/admin/analytics, /admin/settings, /admin/notifications), and MFA AAL2",
  accessContent.includes('redirect("/login")') &&
    accessContent.includes('analytics: ["super_admin", "platform_admin"]') &&
    accessContent.includes('settings: ["super_admin", "platform_admin"]') &&
    accessContent.includes('notifications: ["super_admin", "platform_admin", "developer", "support_staff"]') &&
    accessContent.includes('assurance?.currentLevel !== "aal2"')
);

const automationRouteContent = readFileSync(
  join(process.cwd(), "src", "app", "api", "automation", "run", "route.ts"),
  "utf-8"
);
assert(
  "/api/automation/run uses canonical verifySchedulerRequest and returns 503 when unconfigured / 401 when unauthorized",
  automationRouteContent.includes("verifySchedulerRequest") &&
    automationRouteContent.includes("status: 503") &&
    automationRouteContent.includes("status: 401")
);

console.log("============================================================");
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL NAVIGATION & ARCHITECTURE CHECKS PASSED.");
  process.exit(0);
}

