import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Terminal, Cpu, Lock } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { getPageMetadata } from "@/lib/seo";
import { getPublishedPageBySlug } from "@/lib/cms-public";

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPageBySlug("about");
  return getPageMetadata(
    cmsPage?.seo_title || "About TheCodexThrill",
    cmsPage?.seo_description ||
      "Learn about TheCodexThrill’s engineering-first philosophy, zero-trust security standards, and disciplined approach to building enduring digital software.",
    "/about",
  );
}

const engineeringPrinciples = [
  {
    number: "01",
    title: "Understand the Domain Before Writing Code",
    description:
      "The best software begins with deep architectural clarity. We map domain models, user workflows, and data bottlenecks before opening an editor.",
  },
  {
    number: "02",
    title: "Zero-Trust Security by Default",
    description:
      "Security is enforced at the database engine level. We use PostgreSQL Row-Level Security, AAL2 Multi-Factor Authentication, and least-privilege service roles on every table.",
  },
  {
    number: "03",
    title: "Strict Type & API Contracts",
    description:
      "From database schema to client components, every entity is bound by strict TypeScript types and runtime Zod validation schemas. Undefined behavior is eliminated at compile time.",
  },
  {
    number: "04",
    title: "Deterministic CI/CD & Automated Testing",
    description:
      "Every pull request executes automated unit, integration, and security regression suites. Reversible declarative migrations ensure zero-downtime database upgrades.",
  },
  {
    number: "05",
    title: "Sub-50ms Global Performance Targets",
    description:
      "We harness Next.js Server Components, streaming hydration, and edge caching to deliver instantaneous perceived load times regardless of network conditions.",
  },
  {
    number: "06",
    title: "Unconditional Code Stewardship",
    description:
      "We build software you own completely. Zero proprietary lock-in, zero obfuscated dependencies. Clean documentation, structured commits, and seamless repository handover.",
  },
];

const securityStandards = [
  {
    title: "Database Row-Level Security (RLS)",
    desc: "Every database query executes within the isolated context of the authenticated user's organization. Cross-tenant leakage is mathematically impossible.",
    icon: ShieldCheck,
  },
  {
    title: "AAL2 Multi-Factor Authentication",
    desc: "Sensitive administrative actions require high-assurance TOTP or WebAuthn hardware biometric challenges, safeguarding against compromised credentials.",
    icon: Lock,
  },
  {
    title: "Tamper-Evident Audit Ledgers",
    desc: "All state-changing operations trigger automated audit logs containing actor ID, timestamp, IP metadata, and diff payload for compliance verification.",
    icon: Terminal,
  },
  {
    title: "Zero-Downtime Migration Architecture",
    desc: "Database schema evolutions are scripted as declarative, backward-compatible migrations deployed via Supabase CLI and validated in automated test environments.",
    icon: Cpu,
  },
];

export default async function AboutPage() {
  const cmsPage = await getPublishedPageBySlug("about");

  return (
    <>
      <PageIntro
        description={
          cmsPage?.content
            ? cmsPage.content.split("\n\n")[0]
            : "TheCodexThrill brings senior product architecture and software engineering together to build high-performance digital products that withstand enterprise scale."
        }
        eyebrow="About us"
        title={
          cmsPage?.title ? (
            <>{cmsPage.title}</>
          ) : (
            <>
              Engineering Software Designed for <em>Decades.</em>
            </>
          )
        }
      />

      {/* Point of View & CMS Content */}
      <section className="section section-muted">
        <div className="container-shell">
          <div className="statement">
            <div>
              <p className="eyebrow">
                <span />
                Our Point of View
              </p>
              <h2>
                Build. Innovate. Deploy. <span>Scale.</span>
              </h2>
            </div>
            <div className="statement-detail">
              <p>
                We founded TheCodexThrill on a direct premise: modern software companies deserve engineering partners who value substance over spectacle. Too many projects fail not from lack of ambition, but from undisciplined architecture, bloated frameworks, and fragile dependencies.
              </p>
              <p>
                We reject agency bureaucracy and generic templates. Every line of code we ship is crafted by senior engineers who treat software as mission-critical infrastructure.
              </p>
              {cmsPage?.content && cmsPage.content.split("\n\n").length > 1 && (
                <div style={{ marginTop: "20px", display: "grid", gap: "14px" }}>
                  {cmsPage.content
                    .split("\n\n")
                    .slice(1)
                    .map((paragraph, idx) => (
                      <p key={idx} style={{ margin: 0, color: "var(--foreground)", fontSize: "15px", lineHeight: "1.75" }}>
                        {paragraph}
                      </p>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Core Engineering Principles */}
      <section aria-label="Our engineering principles" className="section container-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              <span />
              Core Principles
            </p>
            <h2>How We Approach Software Craftsmanship.</h2>
          </div>
          <p>
            These non-negotiable standards govern every database table, server action, and UI component we deliver.
          </p>
        </div>

        <div className="value-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {engineeringPrinciples.map((principle) => (
            <article className="value-card" key={principle.number} style={{ minHeight: "auto" }}>
              <span>{principle.number}</span>
              <h2 style={{ margin: "24px 0 10px", fontSize: "18px" }}>{principle.title}</h2>
              <p>{principle.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Security & Governance Foundation */}
      <section aria-labelledby="security-posture-title" className="section section-muted">
        <div className="container-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span />
                Defense in Depth
              </p>
              <h2 id="security-posture-title">Our Zero-Trust Security Architecture.</h2>
            </div>
            <p>
              We design software for regulated and high-liability industries. Security is verified continuously across all layers of our stack.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            {securityStandards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  style={{
                    padding: "26px",
                    borderRadius: "18px",
                    border: "1px solid var(--line)",
                    background: "var(--background)",
                  }}
                >
                  <div style={{ color: "var(--gold-ink)", marginBottom: "14px" }}>
                    <Icon aria-hidden="true" size={24} />
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600 }}>{item.title}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: "1.6" }}>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Delivery CTA */}
      <section className="section container-shell">
        <div className="contact-panel">
          <div>
            <p className="eyebrow">
              <span />
              Ready to collaborate?
            </p>
            <h2>Bring your most demanding software challenge.</h2>
            <p>
              We provide upfront architecture assessments, clear milestone pricing, and immediate engineering velocity.
            </p>
          </div>
          <Button asChild>
            <Link href="/contact">
              Initiate Discussion <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
