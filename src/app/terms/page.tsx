import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Terms of Service",
  "Review the commercial and legal terms governing software engineering engagements and portal access at TheCodexThrill.",
  "/terms",
);

export default function TermsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Commercial Terms"
        title={<>Terms of <em>Service.</em></>}
        description="Clear, transparent terms governing client engagements, deliverable ownership, and secure platform access."
      />

      <article className="section section-muted">
        <div className="article-body container-shell">
          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing the website at thecodexthrill.com, contracting with TheCodexThrill for software design and engineering services, or utilizing our authenticated client workspaces, you agree to be bound by these Terms of Service and all applicable laws and regulations.
          </p>

          <h2>2. Engineering Services and Project Scopes</h2>
          <p>
            TheCodexThrill provides bespoke software development, architecture consulting, AI solution design, and cloud engineering services. Each commercial engagement is defined by an agreed Scope of Work (SOW), proposal, or service agreement detailing deliverables, milestones, fees, and acceptance criteria.
          </p>

          <h2>3. Intellectual Property and Ownership</h2>
          <p>
            <strong>Client Deliverables:</strong> Upon full payment of all contracted fees, all custom software deliverables, bespoke source code, and design assets created specifically for the client transfer to the client as agreed in the governing engagement contract.
          </p>
          <p>
            <strong>Pre-Existing Tools and Core Frameworks:</strong> TheCodexThrill retains ownership of its pre-existing proprietary tooling, reusable foundational libraries, and internal deployment accelerators, granting clients a perpetual, non-exclusive license to utilize such components as embedded within their deliverables.
          </p>

          <h2>4. Confidentiality and Non-Disclosure</h2>
          <p>
            Both parties agree to treat all non-public technical, commercial, business, and financial information disclosed during negotiations and project execution as strictly confidential. Confidentiality obligations endure beyond project completion.
          </p>

          <h2>5. Client Portal and Authorized Access</h2>
          <p>
            Access to our client workspace and management portal is granted on a strictly invitation-only, least-privilege basis. Users are responsible for maintaining the confidentiality of their credentials and enrolling in mandatory multi-factor authentication (MFA) where required by assigned roles. Sharing credentials across individuals is prohibited.
          </p>

          <h2>6. Warranties and Limitation of Liability</h2>
          <p>
            We engineer our software according to rigorous industry standards, automated testing baselines, and security best practices. Unless explicitly provided in a written service agreement, services and preview environments are delivered &quot;as is&quot;. To the maximum extent permitted by law, TheCodexThrill shall not be liable for indirect, incidental, special, or consequential damages.
          </p>

          <h2>7. Termination and Suspension</h2>
          <p>
            Either party may terminate an engagement in accordance with the specific notice provisions of the executed contract. We reserve the right to suspend platform access immediately in the event of unauthorized security probing, credential abuse, or breach of confidentiality.
          </p>

          <h2>8. Contact and Legal Notices</h2>
          <p>
            For legal inquiries, contract clarifications, or commercial notices:
          </p>
          <p>
            <strong>TheCodexThrill Operations</strong><br />
            Email: <a href="mailto:contact@thecodexthrill.com">contact@thecodexthrill.com</a><br />
            Commercial: <a href="mailto:admin@thecodexthrill.com">admin@thecodexthrill.com</a>
          </p>

          <div className="article-endnote">
            <span><FileCheck aria-hidden="true" size={18} /> Transparent, accountable engineering agreements.</span>
            <Link className="text-link" href="/contact">
              Discuss an engagement <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}

