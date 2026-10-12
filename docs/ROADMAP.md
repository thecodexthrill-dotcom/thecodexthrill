# Development Roadmap

Phases are sequential gates. Completion of a phase requires review of its acceptance criteria; no later phase is authorized by this roadmap alone.

## Phase 0 â€” Foundation and architecture baseline

**Scope:** repository audit and documentation only.  
**Acceptance:** audit is recorded; PRD, architecture, module boundaries, roadmap, design, database governance, RBAC, security, route/API contracts, test strategy, agent rules, changelog, and ADR exist and agree; open decisions are explicit; files are verified.  
**Status:** documentation baseline established in this milestone; user review required.

## Phase 1 â€” Application foundation (approved; in progress)

Resolve only decisions that affect the application foundation (including PWA service-worker/cache boundaries and supported browser baseline), confirm repository strategy, and initialize the single Next.js App Router application; configure strict TypeScript, linting, formatting, environment validation, Tailwind, design tokens, shared accessible shell, error/loading states, PWA manifest/offline fallback foundation, and CI checks. No production services. Acceptance: reproducible documented setup; required static checks pass; installability/offline fallback behavior is specified and tested without caching authenticated data; scope and unresolved later-phase decisions are recorded.

**Current status:** Phase 1 verification was accepted based on the reported results.

## Phase 2 â€” Supabase non-production foundation

Use the existing Supabase Cloud project `theCodexthrill` (`isgoypmebtoipfvtaflg`), region `ap-northeast-2`, now Owner-approved for Vercel Production. Read-only metadata confirms this project; the Vercel Production association remains unverified. Owner-approved decisions now include organization lifecycle, UUID identifiers, one base role per active membership, separate platform/organization role namespaces, MFA for Super Admin/Platform Admin/Organization Owner/Organization Admin, platform-owned sales leads, and tenant-scoped client CRM. Audit retention and backup destination/retention/RPO/RTO remain pending. The core foundation migration proposal is recorded in `DATABASE-SPECIFICATION.md`; the new Auth/RBAC implementation adds a migration but does not apply it to Cloud. Before protected platform operation, a separately authorized Phase 2E bootstrap must establish exactly one active global designee; do not weaken the invariant or auto-select/create an account. The Owner has approved invitation issuer/lifecycle rules, Supabase Auth session refresh and recovery authority, and designated initial Super Admin identity (`priyanshugautamji0001@gmail.com`). Auth/RBAC implementation is authorized in the existing repository. Vercel Production association, Cloud migration-history review and migration application, invitation delivery verification, deployment, and live verification remain external gates; no Cloud resource is changed by repository work.

## Phase 3 â€” Public website and design system

Implement responsive public shell and initial pages, metadata, accessibility, performance measurement, and approved enquiry capture. Acceptance: content and links reviewed, forms validated/rate-limited, accessibility and performance checks recorded.

## Phase 4 â€” CMS and portfolio

Implement validated block schemas, media controls, drafts/preview/publish/revisions/approval as scoped, and dynamic portfolio. Acceptance: unauthorized edits/publishing blocked; unsafe content cannot execute; public views expose only published content.

## Phase 5 â€” Identity, RBAC, and governance

Implement invitation-only account lifecycle, MFA/session policy, server-side authorization, controlled role delegation, single-Super-Admin invariant, tenant membership model, audit events, and RLS. Acceptance: threat scenarios and authorization matrix tested, including last-admin preservation.

## Phase 6 â€” CRM and customer/project workflows

Deliver leads, follow-up, customer portal, project/task/milestone workflows, full customer/staff support ticket workflow, documents, and activity. Acceptance: tenant/customer isolation and workflow tests pass, including ticket creation, customer visibility, staff triage/assignment, messages, attachment authorization, status changes, resolution, and audit history.

## Phase 7 â€” Notifications and operational hardening

Add approved event delivery channels/preferences, in-app history/read state, email and opt-in/revocable web push, monitoring, rate limits, abuse handling, recovery exercises, and accessibility/performance refinements. Acceptance: permission denial/revocation, delivery failure/retry behavior, no sensitive push payloads, offline fallback with no private-data caching, and recovery evidence are documented and verified.

## Phase 8 — Complete core product roadmap (completed on branch)

Completed end-to-end delivery across:
- **Client Delivery & Support:** Project milestones, tasks, staff assignments, deliverables, client-visible progress, support ticket lifecycle with staff queue ownership (`assigned_to`), conversations, status transitions, client notifications, and strict client organization isolation (`delivery-operations-helper.ts`).
- **CMS & Public Website:** Unified CMS publishing for pages, insights/blog posts, services, case studies, media library (`cms_media`), navigation menus (`cms_menus`, `cms_menu_items`), revision snapshots with one-click rollback (`cms_revisions`), and tag-based cache invalidation (`cms-public`).
- **Billing & Business Operations:** Multi-line-item invoices, project linkage, due dates, overdue escalation, verified manual payment settlement (`recordInvoicePaymentAction` with method/reference/audit confirmation), receivables reporting, and financial history preservation without claiming unconfigured online payment gateways.
- **Notifications & Workflows:** Delivery state tracking (`queued`, `sent`, `failed`, `skipped`), retry queue processing, idempotent workflow execution (`workflow_runs`), mandatory security alerts, and `CRON_SECRET`-protected `/api/internal/workflows/run`.
- **Super Admin Governance:** Role/permission management, invitation lifecycle, last-Super-Admin invariant protection, immutable audit history, and tombstone organization deletion (`preserve_as_platform_tombstone`).

## Phase 9 — Platform quality, technical SEO, and operational readiness (completed on branch)

Completed across:
- **Accessibility & Responsive UI:** Semantic landmarks, keyboard navigation, accessible forms/tabs/tables, light/dark theme parity, and mobile/tablet/desktop responsiveness.
- **Technical SEO & Structured Data:** Dynamic metadata, canonical URLs, Open Graph/Twitter cards, dynamic `sitemap.xml` merging static routes with published CMS pages/articles/services/case studies, `robots.txt` blocking private routes, and JSON-LD structured data (`Organization`, `WebSite`, `ProfessionalService`, `Service`, `BlogPosting`, `CreativeWork`, `FAQPage`, `BreadcrumbList`).
- **PWA & Offline Isolation:** Installable manifest, service worker with strict network-only handling for `/admin`, `/portal`, `/workspace`, `/api`, and `/auth` routes, and full cache eviction on sign-out/account switch.
- **Observability & Runbooks:** Health check endpoint (`/api/health`), rate-limiting and origin validation on sensitive endpoints, and documented backup/restore and incident rollback procedures in `docs/VERCEL-SUPABASE.md`.

