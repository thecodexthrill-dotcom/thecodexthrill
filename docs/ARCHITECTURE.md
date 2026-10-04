# Architecture Baseline

**Status:** Application Auth/RBAC integration implemented in the repository; Cloud deployment and provider verification remain pending.

## 1. System shape

One Next.js App Router application using React and strict TypeScript, organized as a modular monolith. The same deployment and codebase serve public pages, customer routes, internal operations, Admin, and Super Admin. Route groups/layouts organize presentation; they are not security boundaries.

Platform: Supabase Cloud, PostgreSQL, and Supabase Auth, with Vercel hosting. The Owner now approves the existing project `theCodexthrill` (`isgoypmebtoipfvtaflg`) for Production; this supersedes the earlier dev/testing-only decision. A read-only CLI listing confirmed matching project name, ref, region, and healthy status. The Vercel project is not linked in this workspace, so its Production target still requires external verification. No hosted resource has been changed. Planned UI: Tailwind CSS, shadcn/ui, Radix UI, Lucide icons, and Motion for restrained animations. Hosting target: Vercel. Versions, plans, and provider configuration are not selected or provisioned here.

The single application is also planned as an installable PWA, with a minimal offline fallback and opt-in web push. Service-worker caching must use an explicit allowlist; authenticated or otherwise sensitive data is excluded by default. Push is a convenience channel, not the source of truth.

## 2. Logical layers

- **Presentation:** route segments, layouts, accessible components, forms, and theme.
- **Application:** use cases, orchestration, authorization decisions, validation, and transactions.
- **Domain:** feature-owned types, policies, and rules independent of framework details where practical.
- **Infrastructure:** Supabase clients, persistence, storage, email/notification adapters, and external services.
- **Shared platform:** design tokens, schema helpers, audit/event conventions, and safe cross-feature utilities.

Proposed feature areas: public-site/content, portfolio, identity/access, CRM, customer portal, support tickets, project delivery, notifications/PWA delivery, administration, audit/governance, and future billing, analytics, automation, and AI adapters. Future areas remain outside initial delivery until separately prioritized. Features own their contracts and data access; cross-feature calls go through explicit application services rather than hidden table coupling. Avoid a premature microservice split.

## 3. Trust boundaries

Browser input, URL parameters, uploaded files, CMS content, external links, push subscriptions, and webhook payloads are untrusted. Validate at entry points. Use server-only modules for privileged operations. Browser clients may use only public configuration and user-scoped access. Never expose a Supabase service-role key to browser code. Its use is exceptional and server-only; because it bypasses RLS, every such operation must perform an equivalent explicit authorization check, be narrowly scoped, audited, and justified in code/review. Prefer user-scoped access that preserves RLS.

Enforce authorization in server actions/route handlers and data access, and enforce row access through PostgreSQL RLS. UI visibility is usability only. Organization is the tenant boundary. A user may belong to multiple organizations, with memberships and roles scoped to each organization; tenant business data must be isolated. Tenant identity must be derived from verified membership, never trusted from a client-supplied tenant ID. Internal staff operate through platform-level permissions and may separately hold organization memberships; ordinary organization membership never implies platform privileges. Global platform administration is separate from tenant roles.

Exactly one active global Super Admin must exist at every committed operational state. Do not automatically select or create the initial account. Keep the protected platform unavailable until an explicitly approved initial account is securely provisioned and the invariant is established. Successors require explicit authorization, verified identity, and appropriate MFA. Transfer must be atomic, serialized, and audited. Supabase Auth is the sole recovery authority. Password changes require a verified recovery AMR session and AAL2 when a verified TOTP factor exists.

## 4. Data and integration principles

PostgreSQL is the relational source of truth. Use explicit constraints and indexes informed by actual queries. Supabase Storage is for approved object classes with private-by-default access where appropriate. Ticket attachments and customer documents must be private, ownership-checked, and delivered through short-lived authorized access. External integrations are behind typed adapters and are not assumed to exist. No MongoDB or second database absent a reviewed ADR and explicit approval.

## 5. Content architecture

CMS blocks use a versioned discriminated union of predefined, validated block types with safe rendering components. Store structured data, not executable HTML/JS or arbitrary component names. Publishing status and preview authorization are server-controlled. Public rendering consumes published, schema-valid content only. The offline fallback must not expose drafts, previews, or authenticated content.

## 6. Configuration and environments

Separate local, preview/non-production, and production configuration and credentials. Validate required environment variables at startup without logging secret values. The development Supabase target is owner-confirmed, but the application is not connected and has no configured Supabase URL/key. Environment promotion, preview data policy, migrations, and rollback procedures must be defined before implementation/deployment.

## 7. Quality attributes

Strict typing, clear feature ownership, accessibility, reduced motion, responsive layouts, metadata, observability without sensitive payloads, testable authorization, measured Core Web Vitals, and documented operational recovery. See the design, security, database, and test documents.

## 8. Boundaries and unresolved architecture questions

The organization-based tenant model, role namespaces, approved MFA roles and platform/tenant CRM boundaries remain the architecture baseline. Audit retention and backup destination/retention/recovery objectives remain pending. Data residency, cache strategy, search provider, background jobs, notification providers, observability, PWA browser support and ticket service targets remain open. The Owner has approved Auth/RBAC policy and the designated initial Super Admin; repository implementation uses the existing Cloud project. Vercel Production association and hosted changes remain gated.
