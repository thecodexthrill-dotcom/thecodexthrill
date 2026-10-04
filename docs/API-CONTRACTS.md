# API and Server-Action Contracts (Planned)

No API endpoints or server actions exist yet. Prefer typed feature use cases behind a small number of route handlers/server actions; do not expose database tables as an accidental public API. Select REST/RPC conventions when implementation scope is approved.

## Contract rules

- Validate request body, path, query, and content type at the server boundary with explicit schemas.
- Derive user identity from the verified session. Derive organization tenant/resource access from verified membership and authorization checks, never client assertions. Users may belong to multiple organizations; platform-wide permissions are separate and never implied by organization membership.
- Apply authentication, permission/scope checks, RLS-backed data access, CSRF protections as applicable, and rate limits before state changes.
- Use stable response/error shapes with safe public messages and correlation identifiers; never return stack traces or secrets.
- Define pagination/filter limits, sorting allowlists, idempotency for retryable operations, and concurrency behavior where relevant.
- Audit privileged operations and avoid sensitive values in logs.
- Validate external callbacks/webhooks, signatures, timestamps, and replay handling before processing.

## Planned contract families

Public read: published pages, navigation, portfolio, insights. Public write: enquiry submission; this is separate from account registration. Identity: invitation-only registration and other flows supported by approved Supabase Auth configuration; unrestricted public account registration is prohibited. No real invitation or account creation without explicit authorization. CMS: page/block drafts, preview, revisions, publish/schedule, media, navigation. CRM: leads, contacts, companies, activities. Delivery: projects, tasks, milestones, assignments, and activity. Portal: own requests, projects, milestones, files, notification preferences/history. Support: customer ticket creation/read/messages and permitted attachments; staff triage, categorization, priority, assignment, status, replies, resolution, and activity. Administration: users, organization-scoped roles/memberships, platform permissions, audit, security configuration, and atomic Super Admin transfer. Billing, analytics, automation, and AI contracts are deferred until those features are separately approved. These are domains, not committed endpoint names.

Support operations must authorize both the actor and the ticket's organization/ownership on every request; attachment access follows ticket scope. Internal platform staff require explicit platform-level permissions; organization membership alone does not grant platform-wide access. Super Admin transfer requires explicit authorization and must be serialized, atomic, audited, and preserve exactly one active global designee at every committed operational state. The protected platform remains unavailable until an explicitly approved initial Super Admin account is provisioned and the invariant established. PWA manifest and offline fallback are public/static behavior; push subscription registration/removal requires explicit opt-in and authenticated ownership. Do not include sensitive ticket or account content in push payloads.

## Open questions

Endpoint style/versioning, rate-limit provider and thresholds, standard pagination/error schema, webhook needs, public API requirements, generated client strategy, audit retention, backup destination/retention/RPO/RTO. Invitation issuer/expiry/acceptance/revocation, Supabase Auth session/recovery behavior, and initial Owner identity are approved in the Auth/RBAC implementation. Privileged MFA roles are approved in the database and security specifications. No credentials or secret values are specified. The production domain is `https://thecodexthrill.com`; Vercel association remains unverified.
