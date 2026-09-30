# Supabase Cloud configuration

The application is configured for the existing Supabase Cloud project
`isgoypmebtoipfvtaflg`. Browser and server clients use the same public project
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
| `APP_BASE_URL` | `https://thecodexthrill-xi.vercel.app` | Production; local origin for Development |
| `SUPABASE_SECRET_KEY` | The project `service_role` key for audited server-side Auth Admin operations | Server only, all environments that run those operations |
| `OWNER_SUPER_ADMIN_EMAIL` | The approved Owner email | Server only, all environments that run bootstrap |
| `INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN` | A unique high-entropy value per environment | Server only, all environments that run bootstrap |

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

Public Auth signup is disabled to preserve the invitation-only policy. Custom
SMTP/Gmail delivery is not configured or verified; do not send Owner email
until a production SMTP sender is configured and verified.

## Local development

The ignored `.env.local` targets Supabase Cloud and the local Next.js origin.
Do not start local Supabase/Mailpit or replace the Cloud URL/key with local
values. Keep all secret values in `.env.local` or the existing Vercel project's
server-only environment configuration.
