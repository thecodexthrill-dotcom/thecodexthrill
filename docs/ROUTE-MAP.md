# Route Map (Planned)

Routes are a navigation and ownership proposal. None are implemented. Exact URL naming and locale strategy are open to review. Every protected route requires server-side authorization; layouts and middleware alone are not sufficient.

| Route family | Example routes | Access / owner |
|---|---|---|
| Public | `/`, `/about`, `/services`, `/technology`, `/portfolio`, `/portfolio/[slug]`, `/case-studies/[slug]`, `/insights`, `/insights/[slug]`, `/contact` | Published content; public-site/content and portfolio |
| Identity | `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/forgot-password`, `/auth/reset-password` | Public entry; identity policy controls availability |
| Customer portal | `/portal`, `/portal/profile`, `/portal/requests`, `/portal/projects/[id]`, `/portal/documents`, `/portal/notifications`, `/portal/support` | Authenticated customer; own tenant/resources only |
| Customer support | `/portal/support`, `/portal/support/new`, `/portal/support/[ticketId]` | Authenticated customer; own tenant and tickets only |
| CRM | `/admin/crm/leads`, `/admin/crm/contacts`, `/admin/crm/companies` | Staff permission and scope |
| Delivery | `/admin/projects`, `/admin/projects/[id]`, `/admin/tasks` | Assigned/delegated scope |
| Staff support | `/admin/support/tickets`, `/admin/support/tickets/[ticketId]` | Explicit support permission and assigned/delegated scope |
| CMS | `/admin/content/pages`, `/admin/content/pages/[id]`, `/admin/content/media`, `/admin/content/navigation` | Content permissions; preview is protected |
| Administration | `/admin/users`, `/admin/roles`, `/admin/audit`, `/admin/settings` | Explicit delegated permissions; sensitive actions re-check authorization |

## Route behavior requirements

Use separate public and authenticated layouts for usability. Authenticate and authorize each data operation on the server; return safe not-found/forbidden behavior without leaking resource existence where appropriate. Keep drafts and previews private and non-indexable. Define canonical URLs, metadata, sitemap, robots rules, and redirect behavior for published content. Route IDs never imply access. API and server-action contracts are documented separately.

The PWA manifest and service worker provide installability and an offline fallback. The offline route must be safe without authentication and must not imply that private actions succeeded. Cache only explicitly allowlisted public/static assets; do not cache customer, support, staff, or admin data by default. Push permission is requested only after an explicit user action and can be revoked.

## Open questions

Public URL taxonomy, locale prefixes, customer organization switching, admin path naming, support route ownership, and whether registration is enabled.
