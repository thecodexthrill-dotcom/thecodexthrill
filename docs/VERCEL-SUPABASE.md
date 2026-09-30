# Vercel and Supabase Cloud configuration

The application accepts only the confirmed Supabase Cloud project
`isgoypmebtoipfvtaflg` or the local development stack. Browser, server, and
privileged server clients all take their project URL from the same environment
configuration.

## Vercel environment variables

Set these for each Vercel environment that should use Supabase Cloud. The
`NEXT_PUBLIC_` values are included in browser bundles at build time, so redeploy
after changing them.

| Variable | Value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://isgoypmebtoipfvtaflg.supabase.co` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The matching publishable key from this Supabase project | Public project identifier/key |
| `APP_BASE_URL` | The HTTPS origin for this Vercel environment, without a path | Server only |
| `SUPABASE_SECRET_KEY` | The matching Supabase secret key, only if privileged Auth operations are enabled | Server only; never use a `NEXT_PUBLIC_` name |

Use the production domain for Production and the intended Vercel domain for
Preview. Add each callback URL to Supabase Auth's redirect allowlist separately.
Do not put secret keys or bootstrap/transfer tokens in browser-visible
variables. The current hosted Owner transfer endpoint remains local-only; do
not configure Owner transfer tokens in Vercel or invoke that flow against
Cloud until a separately reviewed hosted transfer path is implemented.

## Auth callback origins

Password recovery and invitation links return through
`/auth/callback`. Recovery uses `APP_BASE_URL` as its redirect origin;
invitation generation and callback completion use the same configured origin.
Production origins must use HTTPS. Local loopback origins may use HTTP.

Set the hosted Supabase Auth Site URL and redirect allowlist to the deployed
application origins, including the callback path. This repository change does
not edit hosted Auth settings, email templates, SMTP settings, database state,
or user state.

## Local development

Keep the ignored `.env.local` paired with its existing local Supabase URL and
local keys. Do not replace only its URL with the Cloud URL: the URL and
publishable key must belong to the same project. Use Vercel's environment
configuration for Cloud values.