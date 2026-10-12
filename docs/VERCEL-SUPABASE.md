# Supabase Cloud configuration

The application code currently targets Supabase Cloud project
`isgoypmebtoipfvtaflg`. Before configuring Vercel Production or applying any migration, verify through read-only project metadata that this is the Owner-approved Cloud project for Production. Repository changes do not alter hosted resources. Browser and server clients use the same public project
URL and publishable key. The privileged server client reads only the
server-side `SUPABASE_SECRET_KEY` variable.

## Existing Vercel project variables

Configure the existing `thecodexthrill` Vercel project. Public values are
included in browser bundles at build time, so changing them requires a new
deployment.

| Variable | Required value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://isgoypmebtoipfvtaflg.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The matching publishable key from this Supabase project | Production, Preview, Development |
| `APP_BASE_URL` | `https://thecodexthrill.com` | Production; local origin for Development |
| `SUPABASE_SECRET_KEY` | The project `service_role` key for audited server-side Auth Admin operations | Server only, all environments that run those operations |
| `OWNER_SUPER_ADMIN_EMAIL` | `priyanshugautamji0001@gmail.com` | Server only, Production bootstrap |
| `INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN` | A unique high-entropy value per environment | Server only, all environments that run bootstrap |
| `CRON_SECRET` | High-entropy secret (minimum 16 characters) | Server only, Production & Preview scheduled workflow runs |

Preview callback origins are derived from Vercel's server-only `VERCEL_URL` for
the current deployment; the Preview environment does not need a fixed
`APP_BASE_URL`. Never prefix a secret or deployment URL with `NEXT_PUBLIC_`.
Do not configure an Owner transfer token until the Owner has completed
invitation acceptance, password setup, and MFA enrollment and the transfer is
explicitly approved. The existing active designation must be preserved until
an audited, atomic transfer succeeds.

## Auth callback origins

Password recovery and invitation callbacks return through `/auth/callback`.
Production uses `APP_BASE_URL`; Vercel Preview uses the trusted server-side
`VERCEL_URL` assigned to that deployment. Hosted Supabase Auth uses the
Production Site URL and allows the exact Production callback, constrained
project Preview deployment URLs, and localhost development callback. The
project-scoped redirect allowlist is configured in Supabase Auth.

Public Auth signup is disabled to preserve the invitation-only policy. Verify Cloud Auth email delivery and redirect allowlists before sending invitations. Repository checks do not send email.

## Cloud-backed development

The Next.js app may run locally while using only the approved Supabase Cloud project. Keep .env.local pointed at that project. The backend target remains Cloud in every environment.

## Scheduled workflow automation (`/api/automation/run`)

Background operational sweeps (overdue invoice escalation, stale support ticket alerts, overdue task reminders, lead follow-up reminders, and invitation expiry checks) execute via `GET` or `POST /api/automation/run`:

- **Authentication:** Requires a valid `Authorization: Bearer <CRON_SECRET>` or `x-automation-secret` header (minimum 16 characters; legacy aliases `WORKFLOW_AUTOMATION_SECRET` and `AUTOMATION_CRON_SECRET` supported) verified via constant-time comparison in `verifySchedulerRequest`. Interactive sweeps can also be triggered by authorized platform staff (`runAutomationSweepAction`) from `/admin/notifications`.
- **Idempotency & Deduplication:** Each workflow rule deduplicates notifications within its configured time window and records execution outcomes (`workflow.automation_completed` / `workflow.automation_failed`) in `public.audit_events`.
- **Sanitized Logging & Failure Throttling:** Operational failures are sanitized (`logSanitizedOperationalEvent`) to redact secrets/PII and throttled to prevent audit table flooding.

## Production observability and health checks

- **Platform Integration & Automation Health:** Super Admins and Platform Admins inspect live integration status (`resolvePlatformIntegrationStatus`), automation sweep health (`computeAutomationJobHealth`), and operational telemetry under `/admin/notifications` and `/admin/analytics`, and review immutable security events under `/admin/security`.
- **CSV Export Security:** Executive analytics CSV exports (`/api/admin/analytics/export`) enforce server-side RBAC, MFA AAL2 for privileged roles, and spreadsheet formula injection neutralization (`sanitizeCsvCell`).

## Database backup, retention, and restore runbook

1. **Automated Cloud Backups:** Supabase Cloud (`isgoypmebtoipfvtaflg`) manages daily automated PostgreSQL snapshots and Point-in-Time Recovery (PITR). Verify backup status in the Supabase Dashboard under **Database -> Backups**.
2. **Audit & Financial Retention Invariants:**
   - `public.audit_events` rows are append-only and protected against mutation or deletion by triggers.
   - Deleting an organization uses the audited tombstone flow (`preserve_as_platform_tombstone`): `audit_events.organization_id` is detached to `NULL` while preserving `organization_id`, `organization_name`, and `organization_slug` inside `audit_events.details`, and organizations with invoices or active projects are blocked from permanent deletion until dependencies are resolved.
3. **Restore Verification Drill:**
   - Never restore directly over Production without explicit Owner authorization.
   - To verify backup integrity, restore the snapshot to an isolated staging/branch project, run `npm run typecheck`, `npm test`, and verify row counts on `organizations`, `profiles`, `tenant_projects`, `tenant_invoices`, and `audit_events`.

## Incident response and deployment rollback

1. **Application Rollback:** If a Production deployment introduces a regression, promote the previous known-good Production deployment immediately via the Vercel Dashboard (**Deployments -> Instant Rollback**) without modifying database state.
2. **Secret Rotation:** If `SUPABASE_SECRET_KEY` or `CRON_SECRET` is suspected of exposure, rotate the key in Supabase/Vercel environment settings and redeploy Production and Preview environments.
3. **Compromised Account Containment:** Use `/admin/team` (requires Super Admin + MFA AAL2) to suspend the affected user or revoke sessions immediately; all containment actions emit mandatory security notifications and immutable `audit_events`.

