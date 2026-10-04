# ADR-001: Single-Application Modular Monolith

- **Status:** Accepted baseline; Auth/RBAC implementation is in the repository, while hosted configuration and deployment remain pending.
- **Date:** 2026-09-28
- **Decision owners:** Product owner and engineering owner to confirm.

## Context

TheCodexThrill needs a premium public website and, over time, CMS, customer portal, CRM, project operations, and administrative controls. The product brief requires one unified Next.js codebase and explicitly prefers Supabase/PostgreSQL. No existing project implementation was present in the audited workspace.

## Decision

Use one Next.js App Router application with strict TypeScript and feature-oriented modular-monolith boundaries. Use Supabase Cloud/PostgreSQL as the planned relational data platform, Supabase Auth for identity, and Supabase Storage for files. Use Tailwind CSS with selectively adopted shadcn/ui/Radix primitives, Lucide icons, and Motion for purposeful animation. Serve public and protected route families from the same application. Enforce authorization server-side and through PostgreSQL RLS. CMS content is structured, validated, and rendered from predefined blocks; it cannot execute arbitrary code.

The application is an installable PWA with an offline fallback and opt-in, revocable web push. The service worker uses a public/static allowlist and does not cache authenticated or sensitive data by default. Support is a full customer/staff ticket workflow within the same application.

Organizations are tenants. Users may belong to multiple organizations, with membership and roles scoped to each organization; tenant business data is isolated. Internal platform staff operate through separately granted platform-level permissions and may also hold organization memberships. Platform-wide privileges are never inferred from organization membership. Global platform administration is separate from tenant roles.

Exactly one active global Super Admin must exist at every committed operational state. The protected platform remains unavailable until an explicitly approved initial account is securely provisioned and the invariant established; no initial account is automatically selected or created. Successors require explicit authorization, verified identity, and appropriate MFA. Transfers are atomic, serialized, and audited. Recovery must preserve the invariant, require verified identity and authorized recovery authority, and be audited; the verification procedure remains an open decision.

Identity access is invitation-only; unrestricted public account registration is prohibited. Public enquiry forms are separate from account registration. MFA is mandatory for Super Admin and privileged administrators. No real account creation or invitations without explicit authorization.

## Rationale

This satisfies the unified-codebase requirement, supports clear domain ownership without premature service distribution, and keeps relational integrity and row-level authorization central. Selective UI dependencies support consistency while controlling maintenance and bundle cost.

## Consequences

- Feature boundaries and contracts must prevent uncontrolled cross-module coupling.
- Route groups and UI state are not authorization boundaries.
- Approved organization lifecycle: Platform Admin provisions organizations; active/suspended/soft-deleted states; suspension denies tenant access; hard purge is separately reviewed and audited.
- PWA browser support/cache allowlist and ticket workflow vocabulary/service targets remain open; resolve these before their implementation.
- Owner-confirmed and approved: UUID identifiers; one base role per active organization membership; separate platform and organization roles; MFA for Super Admin, Platform Admin, Organization Owner, and Organization Admin; platform-owned TheCodexThrill sales leads and tenant-scoped client-organization CRM. The existing Supabase Cloud project `theCodexthrill` (`isgoypmebtoipfvtaflg`) was confirmed by read-only metadata and is now Owner-approved for Vercel Production, superseding the earlier development-only designation. Vercel Production association remains unverified. Audit retention and backup destination/retention/RPO/RTO remain open. Auth/RBAC decisions are recorded in the 2026-10-04 amendment below.
- Billing, analytics, automation, and AI are future feature areas requiring separate requirements and review; no extra database or service is approved by this ADR.
- The earlier development/testing-only project designation was superseded by the Owner-approved 2026-10-04 production target. Hosted changes remain gated on Vercel association and migration-history verification. Provider plan, migrations, operational recovery, and dependency versions remain to be decided before their implementation phases.
- Future services or non-Postgres stores require a documented rationale and separate reviewed ADR; MongoDB is not approved.

## Alternatives considered

- Separate applications for public, customer, and admin: rejected because the brief requires one Next.js application and codebase.
- Microservices at inception: rejected as unnecessary operational complexity for the initial scope.
- MongoDB or another database: not selected because PostgreSQL is the agreed relational baseline and no requirement justifies an additional store.
- Arbitrary CMS HTML/code: rejected due to execution and content safety risks; use validated block types.

## Open questions and review triggers

Resolve the listed audit and backup policy, remaining identity blockers, data residency, deployment topology, and integration choices before affected work. Revisit this ADR if scale, isolation, regulatory, operational, or product needs materially contradict the modular-monolith assumptions.

## Owner-approved Auth/RBAC amendment — 2026-10-04

The Owner authorized implementation in the existing Next.js App Router application using the existing Supabase Cloud project and Vercel. This supersedes earlier open decisions in this ADR concerning account lifecycle, invitation issuer/expiry/revocation, session refresh, recovery authority, and the initial Super Admin identity. The sole Owner identity is `priyanshugautamji0001@gmail.com`; public signup and direct role assignment remain prohibited. Invitations are single-use, expire within one hour, are audited and revocable; Super Admin and Platform Admin may invite staff roles, while only Super Admin may invite Platform Admin. Supabase Auth owns sessions and recovery; password changes require verified recovery claims. Privileged operations require AAL2. Initial designation and transfer use the existing one-time bootstrap/atomic transfer functions. Cloud project identity must be verified before any hosted change. Repository work does not apply migrations or deploy.
