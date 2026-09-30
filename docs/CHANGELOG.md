# Changelog

Notable project changes are recorded here. This log documents repository artifacts, not releases.

## 2026-09-28 — Phase 0 documentation baseline

- Added project overview and required product, architecture, roadmap, design, database, RBAC, security, route, API, test, and agent guidance documents.
- Recorded the proposed single-application modular monolith in ADR-001.
- No application code, dependencies, Supabase resources, schemas, migrations, or production resources were created.

## 2026-09-28 — Phase 0.2 documentation remediation

- Documented the approved installable PWA, offline fallback, and opt-in web push behavior and security boundaries.
- Specified customer/staff support ticket capabilities across product, architecture, roadmap, routes, API contracts, and verification strategy.
- Strengthened the exactly-one-active-Super-Admin invariant and required atomic, serialized designation transfer.
- Clarified exceptional server-only service-role use, storage access, notification behavior, phase blockers, scope review, and design-system acceptance guidance.
- No application code, dependencies, Supabase resources, schema, SQL, migrations, or production resources were created or modified.

## 2026-09-28 — Phase 1 application foundation started

- Added a strict TypeScript Next.js App Router scaffold, Tailwind/shadcn-style Radix UI foundation, theme tokens/toggle, shared layout/navigation/footer, and initial Home, Services, Portfolio, About, and Contact routes.
- Added SEO metadata and routes, installable PWA manifest, safe offline navigation fallback, and placeholder-free Supabase SSR/browser client preparation with public-only environment examples.
- Dependency installation and lint/typecheck/build are blocked because Node.js and package managers are unavailable in the execution environment. Phase 1 remains incomplete; no Supabase project or production resources were created.
