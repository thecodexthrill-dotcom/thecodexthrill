import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, Lock, ShieldCheck, UserCheck } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Security & Trust",
  "Discover the engineering architecture, access controls, and security standards protecting TheCodexThrill and its clients.",
  "/security",
);

const securityPillars = [
  {
    icon: Lock,
    title: "Database Row-Level Security",
    description:
      "Every data query is enforced at the database level by PostgreSQL Row-Level Security (RLS) in Supabase Cloud. Tenant organizations are isolated so that no cross-tenant data leakage is structurally possible.",
  },
  {
    icon: KeyRound,
    title: "Mandatory Multi-Factor Authentication",
    description:
      "All privileged platform and organization administrators (Super Admin, Platform Admin, Organization Owner, Organization Admin) must verify Authenticator Assurance Level 2 (AAL2) with TOTP before performing administrative actions.",
  },
  {
    icon: UserCheck,
    title: "Invitation-Only Zero Trust Onboarding",
    description:
      "Public account creation is strictly disabled. New accounts require cryptographically validated, single-use, 1-hour invitations issued by verified administrators with automated anti-scanner protections.",
  },
  {
    icon: ShieldCheck,
    title: "Immutable Audited Governance",
    description:
      "All authentication state changes, role delegations, organization status modifications, and administrative operations write structured, immutable audit events for complete traceability.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro
        eyebrow="Security & Governance"
        title={<>Engineered for <em>Zero Trust.</em></>}
        description="Security is not a feature layered on top; it is the foundational constraint of our database schema, authentication lifecycle, and delivery infrastructure."
      />

      <section aria-label="Security architecture pillars" className="section container-shell">
        <div className="value-grid">
          {securityPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article className="value-card" key={pillar.title}>
                <span className="service-icon"><Icon aria-hidden="true" size={24} /></span>
                <h2>{pillar.title}</h2>
                <p>{pillar.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <article className="section section-muted">
        <div className="article-body container-shell">
          <h2>1. Infrastructure Security and Cloud Isolation</h2>
          <p>
            TheCodexThrill application runs on enterprise edge infrastructure backed by Supabase Cloud (AWS, region ap-northeast-2). Communication is secured with TLS 1.3/1.2 enforcing modern cryptographic cipher suites and HTTP Strict Transport Security (HSTS).
          </p>
          <p>
            Database access utilizes least-privilege service roles with direct SQL table grants revoked from public and anonymous roles. Operations utilize hardened <code>SECURITY DEFINER</code> functions with explicitly pinned search paths to prevent SQL injection and schema confusion attacks.
          </p>

          <h2>2. Authentication and Session Management</h2>
          <p>
            Authentication sessions are managed via httpOnly, secure, Lax SameSite cookies. Passwords are never stored in application tables and are hashed using bcrypt/argon2 via Supabase Auth. Password recovery links require fresh verification claims and enforce MFA when factors are enrolled.
          </p>

          <h2>3. Single Super Admin Invariant</h2>
          <p>
            The platform enforces a strict architectural invariant: exactly one active global Super Admin designation exists at every committed state. Successor transfers are atomic, serialized, and require multi-factor verification, preventing administrative lockout or unauthorized privilege escalation.
          </p>

          <h2>4. Responsible Vulnerability Disclosure</h2>
          <p>
            We take security vulnerabilities seriously and welcome responsible disclosure from security researchers. If you believe you have discovered a security issue affecting TheCodexThrill, please report it immediately:
          </p>
          <p>
            <strong>Security Response Team</strong><br />
            Email: <a href="mailto:security@thecodexthrill.com">security@thecodexthrill.com</a><br />
            PGP/Encrypted Communications: Available upon request.
          </p>
          <p>
            Please provide detailed reproduction steps and allow adequate time for remediation before any public disclosure. We do not take legal action against researchers acting in good faith.
          </p>

          <div className="article-endnote">
            <span><ShieldCheck aria-hidden="true" size={18} /> Verified security boundaries at every layer.</span>
            <Link className="text-link" href="/contact">
              Security inquiries <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}

