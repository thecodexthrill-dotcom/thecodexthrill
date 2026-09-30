# Test Strategy

This is the planned verification approach. Phase 1 application source/configuration has been scaffolded, but dependencies are not installed and no automated checks have been executed in this environment. Do not infer passing results from the presence of scripts.

## Test layers

- **Static checks:** strict TypeScript, lint, formatting, dependency and secret checks as configured.
- **Unit:** domain rules, validation schemas, permission decisions, content block rendering rules, URL/file validation.
- **Integration:** feature services against isolated local/test PostgreSQL/Supabase-compatible services; migration application; Auth/Storage behavior.
- **Authorization/RLS:** authenticated and anonymous access, CRUD operations, tenant isolation, ownership, role/scope changes, revoked sessions, and exactly-one-active-Super-Admin invariant. Test concurrent transfers and account disable/delete attempts; every committed outcome must retain exactly one active designation.
- **End-to-end:** public navigation and enquiry, CMS draft/review/publish, customer access, CRM and project workflows, customer ticket creation/messages/status visibility, staff triage/assignment/resolution, attachment authorization, keyboard flows, error/empty/loading states.
- **Accessibility:** automated checks plus keyboard, focus, contrast, reduced-motion, zoom, and assistive-technology review.
- **Performance:** agreed lab and field measurement for LCP/INP/CLS, responsive assets, and realistic route/data conditions.
- **Operational:** backup restoration, migration rollback/forward fix, rate-limit behavior, notification retries, deployment rollback, and incident runbooks before launch.
- **PWA:** installability/manifest, offline fallback under loss of connectivity, safe service-worker update behavior, explicit push opt-in and revocation, denied permission behavior, and verification that private portal/admin/API data is not cached or exposed through push payloads.

## Quality gates

Run relevant checks for each change and record actual command/results. Never claim a check ran if it did not. Do not add or execute tests during a task unless requested by project instructions/user scope. Do not run tests against production data or services. Keep test data synthetic and isolate credentials. RLS policy tests are release blockers for tenant-owned data. Each roadmap phase must identify checks and evidence that satisfy its acceptance criteria. If a blocker prevents a required check, report the exact blocker and unmet criterion; do not claim phase completion. Scope changes that affect architecture, security, acceptance, or production safety require user review and, where appropriate, an ADR before implementation continues.

## Open questions

Tooling and versions, CI provider, coverage expectations, supported browser matrix, test data strategy, staging environments, accessibility audit ownership, performance measurement method, and security testing cadence.
