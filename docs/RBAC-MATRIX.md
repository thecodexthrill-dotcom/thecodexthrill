# RBAC Baseline

This is a conceptual matrix, not an implemented permission set. Authorization must combine role permission, assigned scope, tenant membership, resource relationship, and server-side policy. Deny by default.

Organizations are tenants. Users may hold memberships in multiple organizations; each active membership has one base organization role from Organization Owner, Organization Admin, Project Manager, or Client Member. Platform Admin, Developer, and Support Staff are separate platform roles; Global Super Admin is a separate singleton designation. Organization membership alone never grants platform-wide access. Mandatory MFA applies to Super Admin, Platform Admin, Organization Owner, and Organization Admin.

| Capability | Visitor | Customer | Staff | Administrator | Super Admin |
|---|---|---|---|---|---|
| Read published public content | Yes | Yes | Yes | Yes | Yes |
| Submit public enquiry | Yes | Yes | Yes | Yes | Yes |
| Read own customer/project records | No | Own tenant/resources only | Assigned scope only | Delegated scope | Platform scope as needed |
| Manage CRM/project work | No | No | Explicit assigned permissions | Delegated scope | Platform governance |
| Create/edit CMS drafts | No | No | If granted | If delegated | Yes |
| Publish/manage users and roles | No | No | No by default | Explicit delegation only | Yes |
| Change platform security/configuration | No | No | No | Explicit limited delegation | Yes |
| Read privileged audit records | No | No | No by default | Delegated scope | Yes |
| Create/read own support tickets | No | Own tenant/tickets | No by default | Delegated support scope | Platform governance |
| Triage/manage support tickets | No | No | Explicit support permission and assignment | Delegated support scope | Platform governance |

## Invariants and delegation

- Exactly one active global Super Admin must exist at every committed operational state. Keep the protected platform unavailable until an explicitly approved initial account is securely provisioned and the invariant established; do not weaken the invariant for an empty database or select/create an account automatically.
- Successors require explicit authorization, verified identity, and appropriate MFA. Designation transfer must be serialized, atomic, and audited, preserving exactly one active account at every committed operational state. Prevent disabling, deleting, demoting, or removing the current designee except through an authorized transfer that preserves the invariant.
- Recovery requires verified identity, authorized recovery authority, and audit logging, and must preserve the invariant. Supabase Auth is the sole recovery authority; password changes require a verified recovery session.
- Super Admin designation is not self-service and cannot be granted by an ordinary role administrator.
- Delegation is explicit, scoped, time-bounded where practical, auditable, and cannot exceed the delegator's authority.
- Separate role management from permission grant where appropriate. Enforce mandatory MFA for Super Admin, Platform Admin, Organization Owner, and Organization Admin at server/database boundaries using verified AAL2 sessions.
- Revoke sessions/authorization promptly after account, role, membership, or scope changes.
- Ticket access is tenant- and ticket-scoped: customers see only tickets belonging to their verified customer membership; staff need explicit support permission and scope. Ticket attachments inherit ticket access controls.

## Enforcement and tests

Check access in server use cases and data access, with RLS as a database boundary. Never rely on hidden buttons or route obscurity. Tests must cover unauthenticated, wrong-role, wrong-scope, cross-tenant, ownership, revoked-session, invitation-only access, and exactly-one-active-Super-Admin cases, including concurrent transfer and account-change race conditions. Invitation creation is available to Super Admin and Platform Admin with verified AAL2; only Super Admin may invite Platform Admin. Invitations grant only the stored role, expire after one hour, are single-use, and may be revoked. Supabase Auth is the sole recovery and session authority.
