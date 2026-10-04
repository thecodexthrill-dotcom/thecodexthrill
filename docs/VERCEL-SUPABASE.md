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
