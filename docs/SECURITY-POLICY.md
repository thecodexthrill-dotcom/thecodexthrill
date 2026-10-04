# Security Policy Baseline

Security is a design and operations requirement. This baseline does not claim the system is implemented, compliant, or invulnerable.

## Identity and authorization

Use Supabase Auth with secure server-managed sessions and the approved cookie/session configuration. Validate identity server-side; use verified user claims rather than trusting client state. Apply least privilege, deny by default, server-side permission checks, tenant membership checks, and PostgreSQL RLS. Organizations are tenants; memberships and roles are organization-scoped, and one user may belong to multiple organizations. Internal platform staff use separately granted platform-level permissions; organization membership alone never grants platform-wide access.

Registration is invitation-only; unrestricted public account registration is prohibited. Public enquiry forms are separate from account registration. No real account creation or invitation may occur without explicit authorization. Require MFA for Super Admin, Platform Admin, Organization Owner, and Organization Admin; enforce verified AAL2 at server and applicable RLS/database boundaries. Supabase Auth manages session refresh; protected operations verify identity and permissions server-side.

Exactly one active global Super Admin must exist at every committed operational state. The protected platform remains unavailable until an explicitly approved initial account is securely provisioned and the invariant established. Do not automatically select/create an initial account or weaken the invariant for an empty database. Successors require explicit authorization, verified identity, and appropriate MFA. Transfer must be atomic, serialized, and audited. Supabase Auth is the sole recovery authority. Password updates require a verified recovery AMR session; no public signup or direct role assignment is permitted.

## Input, content, and files

Validate all untrusted inputs with maintained schemas at server boundaries. Use parameterized database access. Protect state-changing browser requests against CSRF as applicable to the chosen session model. Rate-limit login, recovery, enquiry, upload, and other abuse-prone actions. Encode output appropriately. CMS content uses validated predefined blocks only; no arbitrary executable code. Validate upload size, type, content, ownership, and storage policy; consider malware scanning based on risk. Validate external URLs and avoid unsafe schemes.

## Secrets and errors

Keep secrets in approved environment/secret stores; never commit them, send them to browser bundles, or expose Supabase service-role keys client-side. Service-role access bypasses RLS and is exceptional: prefer user-scoped clients; where unavoidable, use only server-side for a narrowly scoped operation with explicit equivalent authorization checks, audit coverage, and reviewable justification. Minimize secret access and rotate/revoke on exposure. Do not log credentials, tokens, sensitive personal data, or raw request bodies by default. Return safe errors without stack traces or internal details to users.

## Storage and PWA caching

Keep customer documents, ticket attachments, and private media in non-public storage locations. Authorize every upload, read, replacement, and deletion against verified ownership and tenant/ticket scope; validate size, declared and detected type, and content. Issue short-lived access only after authorization. Do not place private object URLs or authenticated API responses into a public cache. Service-worker caching uses an explicit public-asset allowlist; authenticated, customer, staff, and admin data are excluded by default. Web push is opt-in, revocable, and must not put sensitive content in notification payloads.

## Audit and monitoring

Record attributable, timestamped events for privileged actions, role/scope changes, publishing, security settings, and sensitive data operations. Protect logs from application-level update/delete and unauthorized access; minimize/redact payloads. Audit retention/purge and whether external tamper-evident archival is required remain PENDING owner approval. Monitoring and alerting providers and incident ownership are OPEN QUESTIONS. Audit logs supplement, not replace, authorization.

## Database and operations

Enable RLS on exposed tables and test policies. Review migrations and test backups/restores before production. Separate environments and credentials. Use non-production data that is synthetic or appropriately protected. Production changes require review, approval, rollback/recovery plan, and audit trail. Define vulnerability/dependency scanning, patch cadence, incident response, data breach handling, and disaster recovery before launch.

## Threats to review

Cross-tenant access, privilege escalation, account takeover, insecure recovery, loss or duplication of the sole Super Admin, CSRF/XSS, injection, malicious uploads, SSRF via URL processing, spam/credential stuffing, broken object authorization, ticket attachment leakage, service-worker cache leakage, push subscription abuse, secret leakage, unsafe previews, webhook forgery/replay, and migration/backup failure.

## Open questions

Applicable laws and data residency, security owner, incident contacts and timelines, vulnerability disclosure channel, audit retention, backup destination/retention, encryption expectations, scanning providers, and RPO/RTO require explicit decisions. Invitation rules, session refresh, recovery authority, and the designated initial Super Admin identity are approved by the owner. Security review does not constitute legal advice or a certification.
