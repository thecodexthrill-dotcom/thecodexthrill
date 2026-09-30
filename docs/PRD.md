# Product Requirements Document

**Status:** Baseline; requirements require review.  
**Scope:** Product intent and phased capabilities, not a claim of implementation.

## 1. Product summary

TheCodexThrill is a software development company platform for presenting services and work, publishing managed content, receiving and managing enquiries, coordinating client projects, and governing internal operations. The public brand is premium black, white, metallic gold, and refined neutrals. Tagline: “Build. Innovate. Deploy. Scale.”

The target is one cohesive application and codebase. Public visitors, customers, staff, administrators, and the global Super Admin use distinct routes and authorization boundaries within that application. Organizations are tenants; users may belong to multiple organizations, with membership and roles scoped to each organization. Tenant business data is isolated. Internal platform staff use platform-level permissions and may separately hold organization memberships; global platform administration is separate from tenant roles.

## 2. Goals

- Present the company, services, technology capabilities, portfolio, case studies, and insights clearly across devices.
- Let authorized staff manage public content and portfolio entries without code changes, using validated predefined content blocks.
- Capture and process enquiries with accountable follow-up.
- Give authenticated customers a secure view of requests, project progress, milestones, support, notifications, and shared documents as those modules are delivered.
- Provide an installable Progressive Web App (PWA), a safe offline fallback, and opt-in web push notifications.
- Give internal staff tools for CRM, projects, content, users, and platform governance according to least privilege.
- Establish security, accessibility, SEO, performance, auditability, and data governance from the start.

## 3. Users and roles

- **Visitor:** browses public pages and submits an enquiry.
- **Customer:** accesses only their own profile, enquiries, projects, documents, and notifications.
- **Staff member:** performs explicitly granted operational work within an organization or through separately granted platform-level permissions.
- **Platform roles:** Platform Admin, Developer, and Support Staff are separately assigned global platform roles. Platform Admin, Organization Owner, and Organization Admin require MFA; Super Admin is also MFA-required.
- **Organization roles:** Organization Owner, Organization Admin, Project Manager, and Client Member. Each active organization membership has one base organization role; users may belong to multiple organizations. Platform roles never derive from tenant membership.
- **Super Admin:** exactly one active global account has this designation at every committed operational state and holds platform-level governance. Do not automatically select/create the initial account. Keep the protected platform unavailable until an explicitly approved initial account is securely provisioned and the invariant established. Successors require explicit authorization, verified identity, and appropriate MFA. Transfer is atomic, serialized, and audited; recovery must preserve the invariant.

Role names are not sufficient authorization by themselves. Permissions, scope, tenant membership, and resource ownership must be evaluated server-side and in database policies where applicable.

## 4. Functional scope

### Public website

Home, About, Services, Technology, Portfolio, Case Studies, Blog/Insights, and Contact; dynamic navigation and footer; enquiry forms; responsive layouts; canonical metadata, Open Graph metadata, sitemap/robots behavior, and structured content suitable for search and answer engines (SEO/GEO/AEO). Published content must not require code edits to appear.

### CMS and media

Manage pages and typed reusable blocks, drafts, previews, publication, scheduled publication, revisions, SEO fields, navigation, homepage sections, and approval workflow. Media management must validate file type, size, and access. Content schemas are allowlisted; CMS content must never execute arbitrary code, scripts, or server queries.

### Portfolio

Manage title, slug, description, cover and gallery, technology, category, industry, client information where approved, live/demo/store/repository links, status, featured flag, SEO fields, and display order. Public entries are published dynamically. External links require safe URL validation and appropriate rel/target behavior.

### Identity and governance

Invitation-only registration, login, email verification, password recovery, secure sessions, mandatory MFA for Super Admin, Platform Admin, Organization Owner, and Organization Admin, session revocation, protected routes, user and role administration, permissions, controlled delegation, access scopes, security settings, CMS authorization, configuration, and audit logs. Unrestricted public account registration is prohibited; public enquiry forms are separate from account registration. No real invitations or account creation without explicit authorization. Invitation issuer permissions, expiry, acceptance and revocation; session expiry/refresh; recovery verification method and authority; and initial Super Admin identity/provisioning approval remain open.

### CRM

Leads, contacts, companies, sources, pipeline stages, assignments, follow-ups, notes, activities, search, filters, conversion, and reporting.

TheCodexThrill sales leads from public/business development are platform-owned. CRM records belonging to client organizations are tenant-scoped and isolated by `organization_id`; platform sales leads and tenant CRM use separate authorization paths.

### Customer and delivery operations

Customer profiles, enquiries, project requests, progress, milestones, notifications, support tickets, and documents; internal projects, tasks, milestones, assignments, deadlines, statuses, and activity history.

### Support tickets

Customers can create tickets, view their own ticket history, exchange messages, provide attachments where permitted, and follow ticket status through resolution. Authorized staff can triage, categorize, prioritize, assign, communicate, update status, resolve, and review ticket activity. The workflow must preserve tenant isolation, auditable changes, safe file access, and notifications. Exact status values, priority levels, service targets, escalation rules, and retention remain open decisions.

### Notifications and PWA

Provide in-app notification history with read/unread state and user preferences. Email and web push are planned delivery channels, with web push strictly opt-in and revocable. Browser permission denial must not block core portal use. The installable PWA provides an offline fallback for connectivity loss; sensitive customer, staff, and administrative data must not be made available offline by default. Push delivery is best-effort and must not be treated as the authoritative record of an event.

### Later capabilities

Billing, proposals, invoices, analytics, automation, AI integrations, campaigns/promotions, and advanced reporting are future scope, not Phase 0 or an implicit commitment to a specific vendor or implementation. Automation and AI features require explicit data-use, access, human-review, and failure-handling requirements before implementation.

## 5. Non-functional requirements

- TypeScript strict mode; modular monolith; typed server-side access.
- Server-side authorization and PostgreSQL RLS; organization-based tenant isolation, multi-organization membership, organization-scoped roles, and separation of platform-level permissions from tenant roles.
- Validate inputs at trust boundaries; secure uploads, secrets, sessions, and errors; rate-limit abuse-prone endpoints.
- Accessible keyboard interactions, semantic markup, visible focus, contrast, and reduced-motion support.
- Mobile-first responsive experience; coherent light and dark themes.
- Installable PWA behavior with offline fallback and opt-in, revocable web push; no sensitive-data offline cache by default.
- Performance targets: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 under an agreed measurement method. Targets are not guarantees.
- Version-controlled, reviewed, reversible database migrations and tested backup/recovery procedures before production.

## 6. Success measures (to define before launch)

Open questions include conversion goals, lead response service levels, content publishing latency, customer task completion, availability, analytics consent, and performance measurement populations. No numeric business targets are asserted by this baseline.

## 7. Out of scope for Phase 0

Application code, Next.js initialization, dependency installation, database schema/migrations, production resources, external integrations, authentication implementation, and operational modules. Phase 0 produces documentation only.

## 8. Open questions

- What legal entity, operating jurisdictions, privacy notices, audit retention periods, and cookie/consent requirements apply?
- Who may issue invitations, and what are their expiry, acceptance, and revocation rules? What session expiry and refresh policy applies?
- What recovery verification procedure and recovery authority are approved? Do not infer a verification method.
- Which explicitly approved account will be the initial Super Admin, and what provisioning authorization will be given? The protected platform remains unavailable until provisioned and the invariant established.
- The dedicated non-production development Supabase project is owner-confirmed as `theCodexthrill` (ref `isgoypmebtoipfvtaflg`) in organization `thecodexthrill-dotcom's Org`, region `ap-northeast-2`; read-only metadata matches. The repository is not connected to it. Hosted changes remain separately gated.
- Which email, push, analytics, support, billing, and monitoring providers are approved, if any?
- What content approval roles, publishing schedules/timezone, and revision retention apply?
- What availability, RPO/RTO, backup retention, data residency, and incident response targets are required?
- Which audit purge/legal-hold rule, backup destination, database and Storage retention, and restore-test policies are approved? See the pending choices in the database specification.
- Which portfolio/client details may be published and who approves client consent?
- What supported browsers/locales and accessibility conformance target are contractual?
- Which PWA browsers/platforms are supported, what content is safe to cache, and which web-push provider and delivery expectations are approved?
- What ticket status/priority vocabulary, response targets, escalation path, attachment rules, and retention apply?
