# TheCodexThrill

**Build. Innovate. Deploy. Scale.**

TheCodexThrill is a software development company platform built with Next.js App Router and Supabase Cloud. Production uses the canonical origin `https://thecodexthrill.com`; local application development runs on localhost and does not make localhost a production Auth redirect.

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

## Current configuration

The browser and server Supabase clients are configured for the approved Cloud project through environment variables. Authentication callback URLs are resolved from `APP_BASE_URL` in Production and the deployment URL in Vercel Preview. The production resolver rejects localhost and any production origin other than `https://thecodexthrill.com`. Local Next.js development can use `http://localhost:3000`.

### Initial repository audit â€” 2026-09-28

The workspace contained no files or folders before this documentation baseline was added. No Git repository was initialized, so Git status and pre-existing uncommitted changes could not be determined. No application framework, dependency manifests, source tree, project configuration, Supabase configuration, database migrations, or prior documentation were present. No existing work was overwritten or deleted.

## Planned development prerequisites

## Local development

Requires Node.js 20.9 or newer and npm. Install dependencies with `npm install`, provide the approved Supabase Cloud URL and publishable key in the ignored `.env.local`, set `APP_BASE_URL=http://localhost:3000` for local Next.js callback testing, then run `npm run dev`. The browser and server clients use the configured Cloud project; the application backend remains the existing Supabase Cloud project. Never place service-role or secret keys in `NEXT_PUBLIC_*` variables.

`npm run lint`, `npm run typecheck`, and `npm run build` are the foundation checks. They have not yet been run because Node.js/npm are unavailable in the current environment. No lockfile exists until dependency installation is performed. No Git repository was initialized.
