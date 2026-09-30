# Architecture Baseline

**Status:** Baseline approved; application integration and provider configuration remain pending.

## 1. System shape

One Next.js App Router application using React and strict TypeScript, organized as a modular monolith. The same deployment and codebase serve public pages, customer routes, internal operations, Admin, and Super Admin. Route groups/layouts organize presentation; they are not security boundaries.

Planned platform: Supabase Cloud, PostgreSQL, Supabase Auth, and Supabase Storage. The owner confirmed the dedicated development/testing project `theCodexthrill` (`isgoypmebtoipfvtaflg`) in organization `thecodexthrill-dotcom's Org`, region `ap-northeast-2`; it is not a production workload. Read-only metadata matched this identity. Repository connection remains unconfigured: public Supabase URL and publishable key are blank, and no project credentials are committed. Do not connect or modify hosted resources until configuration and the required implementation gates are reviewed. Planned UI: Tailwind CSS, shadcn/ui, Radix UI, Lucide icons, and Motion for restrained animations. Hosting target: Vercel. Versions, plans, and provider configuration are not selected or provisioned here.

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

Exactly one active global Super Admin must exist at every committed operational state. Do not automatically select or create the initial account. Keep the protected platform unavailable until an explicitly approved initial account is securely provisioned and the invariant is established. Successors require explicit authorization, verified identity, and appropriate MFA. Transfer must be atomic, serialized, and audited. Recovery must use authorized recovery authority, verified identity, and audit logging while preserving the invariant; its verification procedure remains undecided.

## 4. Data and integration principles

PostgreSQL is the relational source of truth. Use explicit constraints and indexes informed by actual queries. Supabase Storage is for approved object classes with private-by-default access where appropriate. Ticket attachments and customer documents must be private, ownership-checked, and delivered through short-lived authorized access. External integrations are behind typed adapters and are not assumed to exist. No MongoDB or second database absent a reviewed ADR and explicit approval.

## 5. Content architecture

CMS blocks use a versioned discriminated union of predefined, validated block types with safe rendering components. Store structured data, not executable HTML/JS or arbitrary component names. Publishing status and preview authorization are server-controlled. Public rendering consumes published, schema-valid content only. The offline fallback must not expose drafts, previews, or authenticated content.

## 6. Configuration and environments

Separate local, preview/non-production, and production configuration and credentials. Validate required environment variables at startup without logging secret values. The development Supabase target is owner-confirmed, but the application is not connected and has no configured Supabase URL/key. Environment promotion, preview data policy, migrations, and rollback procedures must be defined before implementation/deployment.

## 7. Quality attributes

Strict typing, clear feature ownership, accessibility, reduced motion, responsive layouts, metadata, observability without sensitive payloads, testable authorization, measured Core Web Vitals, and documented operational recovery. See the design, security, database, and test documents.

## 8. Boundaries and unresolved architecture questions

The organization-based tenant model and separate platform administration are approved. The development project identity, organization lifecycle, membership role model, role namespace separation, specified mandatory MFA roles, and platform/tenant CRM boundaries are confirmed. Audit retention and backup destination/retention/recovery objectives remain pending as described in the database specification. Deployment topology, data residency, cache strategy, search provider, background jobs, email/web-push providers, and observability vendors remain open. PWA browser support and safe cache allowlist, ticket workflow vocabulary and service targets, invitation/session policy details, recovery verification method/authority, and initial Super Admin identity/provisioning approval also require decisions. Resolve them before affected implementation; record material changes as ADRs.
