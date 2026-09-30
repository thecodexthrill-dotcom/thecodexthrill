# Supabase Cloud configuration

The application is configured for the existing Supabase Cloud project
`isgoypmebtoipfvtaflg`. Browser and server clients use the same public project
URL and publishable key. The privileged server client reads only the
server-side `SUPABASE_SECRET_KEY` variable.

## Vercel environment variables

Set these in the existing Vercel project for each required environment. The
public values are included in browser bundles at build time, so redeploy after
changing them.

| Variable | Required value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://isgoypmebtoipfvtaflg.supabase.co` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The matching publishable key from this Supabase project | Public |
| `APP_BASE_URL` | The HTTPS origin serving this environment, without a path | Server only |
| `SUPABASE_SECRET_KEY` | The project `service_role` key, only for audited server-side Auth Admin operations | Server only |
| `OWNER_SUPER_ADMIN_EMAIL` | The approved Owner email | Server only |
| `INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN` | A unique high-entropy server-only bootstrap token | Server only |

Never add secret keys or bootstrap tokens to `NEXT_PUBLIC_` variables. Do not
configure an Owner transfer token until the Owner has completed invitation
acceptance, password setup, and MFA enrollment and the transfer is explicitly
approved. The existing active designation must be preserved until an audited,
atomic transfer succeeds.

## Auth callback origins

Password recovery and invitation callbacks return through
`/auth/callback`, with the environment's `APP_BASE_URL` as the origin. Use the
production HTTPS origin for Production and the intended HTTPS Vercel origin for
Preview. In the hosted Supabase Auth URL configuration, set the Site URL to the
production origin and allow the exact callback URLs for the Production and
Preview origins. This repository does not change hosted Auth settings, email
templates, SMTP settings, database state, or user state.

The current hosted Auth configuration still needs review: its Site URL is a
localhost origin and its redirect allowlist is empty. Public Auth signup is
enabled in the project, while this application uses invitation-only access.
Configure hosted Auth deliberately before sending Owner invitations or recovery
emails. Custom SMTP/Gmail delivery is also not verified by this repository
change.

## Local development

`.env.local` is configured to target Supabase Cloud. Do not start local
Supabase/Mailpit or replace the Cloud URL/key with local values. Keep all
secret values in the ignored `.env.local` or the existing Vercel project's
server-only environment configuration.
