import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Privacy Policy",
  "Understand how TheCodexThrill collects, protects, and governs client and visitor information.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Trust & Governance"
        title={<>Privacy <em>Policy.</em></>}
        description="We treat data confidentiality, security, and privacy with the same engineering rigor we bring to software development."
      />

      <article className="section section-muted">
        <div className="article-body container-shell">
          <h2>1. Overview and Commitment</h2>
          <p>
            TheCodexThrill (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides high-performance software engineering, enterprise web applications, AI solutions, and digital product consulting. This Privacy Policy details how we handle information collected through our public website (thecodexthrill.com) and our client portal and administrative workspaces.
          </p>
          <p>
            We operate on principles of data minimization and least privilege: we collect only information necessary to deliver, secure, and improve our services, and we never sell, rent, or trade client or user personal information.
          </p>

          <h2>2. Information We Collect</h2>
          <p>
            <strong>Public Visitors and Enquiries:</strong> When you submit a project enquiry or contact form, we collect your name, business email address, company name, and details of your project requirements.
          </p>
          <p>
            <strong>Authenticated Platform Users:</strong> For invited client members and staff, we collect authenticated profile details (email address, full name, avatar if provided), session metadata, multifactor authentication factor registrations, and security audit logs required to ensure workspace integrity.
          </p>
          <p>
            <strong>Technical and Usage Data:</strong> Standard server access logs including IP addresses, browser user-agents, request timestamps, and referrers to monitor platform security, protect against automated abuse, and guarantee uptime.
          </p>

          <h2>3. How We Use Your Information</h2>
          <p>
            We use collected information solely for legitimate business and engineering operations:
          </p>
          <ul>
            <li>Responding to project enquiries and commercial consultations.</li>
            <li>Provisioning secure, invitation-only tenant organizations and user workspaces.</li>
            <li>Enforcing enterprise authentication boundaries, including mandatory multi-factor authentication (MFA) for privileged accounts.</li>
            <li>Maintaining immutable audit event trails for security and governance.</li>
            <li>Complying with contractual obligations and applicable regulatory standards.</li>
          </ul>

          <h2>4. Client Data Isolation and Security Architecture</h2>
          <p>
            All client tenant data is protected by PostgreSQL Row-Level Security (RLS) in our Supabase Cloud infrastructure. Organization records, memberships, projects, and documents are strictly compartmentalized by organization identifiers. Staff access is bounded by explicit role-based access controls (RBAC) and audited.
          </p>

          <h2>5. Data Retention and Erasure</h2>
          <p>
            We retain operational project data for the duration of the commercial engagement and for a reasonable period thereafter to fulfill warranty and legal obligations. Security audit events are preserved according to our governance baseline. You may request data access, export, or deletion at any time by contacting our engineering team.
          </p>

          <h2>6. Third-Party Infrastructure</h2>
          <p>
            Our core platform is hosted on enterprise cloud providers: Vercel for application delivery and edge network routing, and Supabase Cloud (AWS) for database, authentication, and encrypted storage. All data is encrypted in transit using TLS 1.3/1.2 and encrypted at rest using AES-256.
          </p>

          <h2>7. Contact and Rights Inquiries</h2>
          <p>
            If you have questions regarding this Privacy Policy or wish to exercise your rights under GDPR, CCPA, or applicable data protection regulations, please reach out directly:
          </p>
          <p>
            <strong>TheCodexThrill Engineering &amp; Governance</strong><br />
            Email: <a href="mailto:contact@thecodexthrill.com">contact@thecodexthrill.com</a><br />
            Security: <a href="mailto:security@thecodexthrill.com">security@thecodexthrill.com</a>
          </p>

          <div className="article-endnote">
            <span><ShieldCheck aria-hidden="true" size={18} /> Enterprise-grade data protection by design.</span>
            <Link className="text-link" href="/contact">
              Contact our team <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}

