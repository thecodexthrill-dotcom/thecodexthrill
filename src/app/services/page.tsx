import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
} from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { getPageMetadata } from "@/lib/seo";
import { getPublishedServices } from "@/lib/cms-public";

export const metadata: Metadata = getPageMetadata(
  "Engineering Services & Technical Capabilities",
  "Explore TheCodexThrill full-stack software development, web applications, cloud backends, autonomous AI, mobile PWA, and enterprise operations systems.",
  "/services",
);

const iconMap: Record<string, React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>> = {
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
};

const serviceHighlights: Record<string, { deliverables: string[]; stack: string[] }> = {
  "web-applications": {
    deliverables: [
      "Next.js App Router with React Server Components",
      "Sub-second global TTFB with edge caching & ISR",
      "WCAG 2.1 AA accessible design system",
      "End-to-end type safety with strict TypeScript",
    ],
    stack: ["Next.js 16", "React 19", "Tailwind CSS", "TypeScript", "Vercel Edge"],
  },
  "mobile-products": {
    deliverables: [
      "Offline-first Progressive Web Apps (PWA)",
      "IndexedDB persistent local database synchronization",
      "Background service worker interception & updates",
      "Biometric device authentication integration",
    ],
    stack: ["PWA Next.js", "IndexedDB", "Service Workers", "Web Cryptography", "Tailwind CSS"],
  },
  "ai-solutions": {
    deliverables: [
      "Domain-specific RAG with pgvector embeddings",
      "Model Context Protocol (FastMCP) tool servers",
      "Strict citation tracing & hallucination mitigation",
      "Human-in-the-loop review and approval workflows",
    ],
    stack: ["FastMCP", "pgvector", "Python Agents", "Supabase", "OpenAI / Claude"],
  },
  "saas-platforms": {
    deliverables: [
      "Cryptographic tenant isolation via PostgreSQL RLS",
      "Subscription entitlement & usage metering engine",
      "High-throughput webhook delivery & retry queue",
      "Tenant admin portal with role-based permissions",
    ],
    stack: ["Supabase Cloud", "PostgreSQL RLS", "Server Actions", "Stripe API", "Zod"],
  },
  "cloud-devops": {
    deliverables: [
      "Automated GitHub Actions CI/CD pipelines",
      "Zero-downtime database migration rollout",
      "Canary staging environments with automatic rollback",
      "Real-time OpenTelemetry observability & health alerts",
    ],
    stack: ["Docker", "GitHub Actions", "Vercel Edge", "Prometheus", "Supabase CLI"],
  },
  "enterprise-software": {
    deliverables: [
      "Tamper-evident audit logging for compliance",
      "AAL2 Multi-Factor Authentication (TOTP / WebAuthn)",
      "Automated financial and operations reconciliation",
      "Deep third-party ERP & CRM API integrations",
    ],
    stack: ["PostgreSQL RLS", "AAL2 MFA", "Next.js", "Audit Triggers", "Tailwind CSS"],
  },
};

export default async function ServicesPage() {
  const serviceList = await getPublishedServices();

  return (
    <>
      <PageIntro
        description="We architect, build, and scale mission-critical software systems. Every capability is delivered with zero-trust security, strict type contracts, and verifiable operational metrics."
        eyebrow="Capabilities"
        title={
          <>
            Engineering Capabilities Built to <em>Endure.</em>
          </>
        }
      />

      <section aria-label="Our engineering services" className="section-editorial">
        <div className="container-shell">
          <div className="editorial-capability-stream">
            {serviceList.map((service, idx) => {
              const Icon = (service.iconName && iconMap[service.iconName]) || Code2;
              const meta = serviceHighlights[service.slug] || {
                deliverables: [
                  "Custom architectural blueprint & schema design",
                  "Strict type-safe implementation",
                  "Automated test coverage & security audit",
                  "Zero-downtime deployment & handover",
                ],
                stack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase", "Tailwind CSS"],
              };
              const isReversed = idx % 2 === 1;

              return (
                <article
                  className={`capability-stream-row ${isReversed ? "row-reversed" : ""}`}
                  key={service.slug}
                  id={service.slug}
                >
                  <div className="capability-stream-main">
                    <div className="capability-meta-line">
                      <span className="capability-number">0{idx + 1}</span>
                      <span className="capability-divider" />
                      <span className="capability-category">Capability Specification</span>
                    </div>

                    <h2 className="capability-headline">{service.title}</h2>
                    <p className="capability-description">{service.description || service.short}</p>

                    <div className="capability-deliverables-block">
                      <h4>Engineered Deliverables:</h4>
                      <ul>
                        {meta.deliverables.map((del, dIdx) => (
                          <li key={dIdx}>
                            <span className="del-bullet" />
                            <span>{del}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="capability-action-line" style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
                      <Link className="capability-action-link" href={`/services/${service.slug}`}>
                        <span>Explore full {service.title} blueprint</span>
                        <ArrowUpRight aria-hidden="true" size={15} />
                      </Link>
                      <Link
                        className="text-link"
                        href={`/contact?service=${encodeURIComponent(service.slug)}`}
                        style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                      >
                        <span>Enquire about {service.title}</span>
                        <ArrowRight aria-hidden="true" size={14} />
                      </Link>
                    </div>
                  </div>

                  <div className="capability-stream-aside">
                    <div className="capability-tech-card">
                      <div className="tech-card-header">
                        <div className="tech-card-icon">
                          <Icon aria-hidden="true" size={24} />
                        </div>
                        <span className="tech-card-label">Core Architecture</span>
                      </div>

                      <div className="tech-card-pills">
                        {meta.stack.map((t) => (
                          <span className="tech-pill" key={t}>
                            {t}
                          </span>
                        ))}
                      </div>

                      <div className="tech-card-specs">
                        <div className="spec-row">
                          <span>Security Standard</span>
                          <strong>Zero-Trust RLS</strong>
                        </div>
                        <div className="spec-row">
                          <span>Testing Protocol</span>
                          <strong>Automated CI Gates</strong>
                        </div>
                        <div className="spec-row">
                          <span>Delivery SLA</span>
                          <strong>Production Ready</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Engineering Consultation Callout */}
      <section className="section section-muted">
        <div className="container-shell contact-panel">
          <div>
            <p className="eyebrow">
              <span />
              Need an Architectural Assessment?
            </p>
            <h2>Start with your core technical challenge.</h2>
            <p>
              We evaluate your existing infrastructure, outline target state data models, and recommend an incremental delivery path before any engagement begins.
            </p>
          </div>
          <Button asChild>
            <Link href="/contact">
              Request Technical Consultation <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
