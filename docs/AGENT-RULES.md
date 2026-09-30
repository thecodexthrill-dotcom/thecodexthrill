# Agent Operating Rules

These rules guide contributors and coding agents. User instructions take precedence where they explicitly define task scope; security and data protections remain mandatory.

## Before changes

1. Inspect the complete relevant workspace, applicable `AGENTS.md` instructions, Git status, docs, dependencies, configuration, migrations, and existing behavior.
2. State findings and a bounded plan before substantial changes.
   - Name the task boundary, acceptance criteria, affected files/modules, and checks. If new requirements exceed approved scope, finish independent authorized work, then pause dependent changes for user direction.
3. Preserve existing work; never overwrite or delete without necessity and explicit authorization where destructive.
4. Work only in the authorized workspace. Do not bypass sandbox or OS permissions.

## Architecture and implementation

- Keep one Next.js App Router application and modular monolith unless an approved ADR changes this.
- Use strict TypeScript, feature boundaries, validated inputs, typed server-side data access, accessible shared components, and documented design tokens.
- Keep authorization on the server and in RLS; UI visibility is never security.
- Do not add a database beyond PostgreSQL, broad UI libraries, or dependencies without specific need and rationale.
- No arbitrary executable CMS content. Never expose service-role secrets to browser code.
- Do not invent credentials, URLs, schemas, integrations, or test results.

## Data and safety

- Never reset a database or perform destructive production changes without explicit approval and a verified recovery plan.
- Treat migrations as immutable after shared application; add reviewed follow-up migrations.
- Never print secrets or sensitive data. Validate uploads and external URLs.
- Ask before production deployment, production migration, removing existing features, changing auth architecture, or major architecture changes; record architecture decisions as ADRs.
- Preserve exactly one active Super Admin at every committed state; do not implement account/role changes or recovery that can leave zero or multiple active designees.

## Verification and completion

Run relevant checks authorized by the user/task and project rules; report exact commands and results. If a required check is blocked by missing access, infrastructure, credentials, or an unresolved decision, stop dependent work and report the blocker and unmet acceptance criteria; never invent a result. Inspect the final diff for unintended changes, security issues, missing docs, and consistency. Report files created/modified/untouched, unresolved decisions, assumptions, risks, and the next gated milestone. Stop after the authorized phase and wait for review; do not start a later phase automatically. A scope or architecture change requires user review before dependent implementation proceeds.
