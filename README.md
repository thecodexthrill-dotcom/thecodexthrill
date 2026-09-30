# TheCodexThrill

**Build. Innovate. Deploy. Scale.**

TheCodexThrill is a premium software development company platform. Its application foundation is under development in this repository, following the documentation baseline and architecture decisions below. No external services or production resources are configured.

## Product direction

The product is planned as one installable PWA and modular monolith: a public company website and CMS alongside customer, support, CRM, project, and administrative experiences in one Next.js App Router application. The PWA includes an offline fallback and opt-in push notifications. Supabase Cloud provides the planned PostgreSQL database, Auth, and Storage services. See [the PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [architecture decision record](docs/DECISIONS/ADR-001-architecture.md).

## Documentation map

- [Product requirements](docs/PRD.md)
- [Architecture and module boundaries](docs/ARCHITECTURE.md)
- [Development roadmap](docs/ROADMAP.md)
- [Design system requirements](docs/DESIGN-SYSTEM.md)
- [Database governance](docs/DATABASE-SPECIFICATION.md)
- [RBAC baseline](docs/RBAC-MATRIX.md)
- [Security policy](docs/SECURITY-POLICY.md)
- [Route map](docs/ROUTE-MAP.md)
- [API contracts](docs/API-CONTRACTS.md)
- [Test strategy](docs/TEST-STRATEGY.md)
- [Agent operating rules](docs/AGENT-RULES.md)
- [Changelog](docs/CHANGELOG.md)
- [Decisions](docs/DECISIONS/ADR-001-architecture.md)

## Current status

Phase 1 source and configuration scaffolding has started. This workspace did not have Node.js or a package manager available when work began, so dependencies could not be installed and runtime verification has not run. Supabase clients are prepared but are not connected; no Auth flow or live backend is claimed.

### Initial repository audit — 2026-09-28

The workspace contained no files or folders before this documentation baseline was added. No Git repository was initialized, so Git status and pre-existing uncommitted changes could not be determined. No application framework, dependency manifests, source tree, project configuration, Supabase configuration, database migrations, or prior documentation were present. No existing work was overwritten or deleted.

## Planned development prerequisites

## Local development

Requires Node.js 20.9 or newer and npm. Install dependencies with `npm install`, copy `.env.example` to `.env.local`, fill in only approved non-production Supabase URL and publishable key values when available, then run `npm run dev` and open `http://localhost:3000`. Never place service-role or secret keys in `NEXT_PUBLIC_*` variables. Without Supabase values, the public pages can run; Supabase clients throw a clear configuration error only if called.

`npm run lint`, `npm run typecheck`, and `npm run build` are the foundation checks. They have not yet been run because Node.js/npm are unavailable in the current environment. No lockfile exists until dependency installation is performed. No Git repository was initialized.
