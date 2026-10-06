"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2 } from "lucide-react";
import { useWorkspaceDemo } from "@/components/platform/workspace-demo";
import { portfolioProjects, type PortfolioProject } from "@/lib/public-content";

export function PublicPortfolioDetail({
  slug,
  initialProject,
}: {
  slug: string;
  initialProject?: PortfolioProject | null;
}) {
  const curated = initialProject ?? portfolioProjects.find((item) => item.slug === slug);
  const { projects } = useWorkspaceDemo();
  const sessionProject = projects.find((item) => item.id === slug && item.portfolio);

  if (curated) {
    return (
      <section className="container-shell public-project-detail">
        <Link className="text-link" href="/portfolio">
          <ArrowLeft size={15} /> Back to all selected work
        </Link>

        <div className="portfolio-detail-header" style={{ marginTop: "24px" }}>
          <p className="eyebrow"><span />{curated.category} · {curated.industry}</p>
          <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3.4rem)", marginTop: "12px", lineHeight: "1.15" }}>
            {curated.title}
          </h1>
          <p className="public-project-summary" style={{ fontSize: "16px", marginTop: "16px", maxWidth: "720px", color: "var(--muted)", lineHeight: "1.7" }}>
            {curated.summary}
          </p>

          <div className="portfolio-meta-bar" style={{ display: "flex", gap: "24px", flexWrap: "wrap", margin: "24px 0", padding: "16px 20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface)" }}>
            <div>
              <small style={{ display: "block", color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em" }}>Client</small>
              <strong style={{ fontSize: "13px" }}>{curated.client}</strong>
            </div>
            <div>
              <small style={{ display: "block", color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em" }}>Engagement Duration</small>
              <strong style={{ fontSize: "13px" }}>{curated.timeline}</strong>
            </div>
            <div>
              <small style={{ display: "block", color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em" }}>Governance &amp; Security</small>
              <strong style={{ fontSize: "13px" }}>Zero-Trust RLS / AAL2 MFA</strong>
            </div>
          </div>
        </div>

        <div className="portfolio-detail-body" style={{ display: "grid", gap: "36px", marginTop: "32px" }}>
          <section>
            <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Engineering &amp; Architecture Challenge</h2>
            <p style={{ color: "var(--muted)", lineHeight: "1.75", maxWidth: "780px" }}>
              {curated.challenge ?? curated.description}
            </p>
          </section>

          {curated.solution && (
            <section>
              <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Engineered Solution &amp; Delivery</h2>
              <p style={{ color: "var(--muted)", lineHeight: "1.75", maxWidth: "780px" }}>
                {curated.solution}
              </p>
            </section>
          )}

          <section>
            <h2 style={{ fontSize: "20px", marginBottom: "14px" }}>Technology Stack</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {curated.technologies.map((tech) => (
                <span className="project-tech-pill" key={tech}>
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
            <section style={{ padding: "24px", border: "1px solid var(--line)", borderRadius: "16px", background: "var(--surface)" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <BriefcaseBusiness aria-hidden="true" size={18} style={{ color: "var(--gold)" }} /> Key Deliverables
              </h3>
              <ul style={{ display: "grid", gap: "10px", padding: 0, margin: 0, listStyle: "none" }}>
                {curated.deliverables.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: "var(--muted)", lineHeight: "1.5" }}>
                    <span style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section style={{ padding: "24px", border: "1px solid color-mix(in srgb, var(--gold) 40%, var(--line))", borderRadius: "16px", background: "color-mix(in srgb, var(--gold) 4%, var(--surface))" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 aria-hidden="true" size={18} style={{ color: "var(--gold)" }} /> Verified Outcomes
              </h3>
              <ul style={{ display: "grid", gap: "10px", padding: 0, margin: 0, listStyle: "none" }}>
                {curated.results.map((result) => (
                  <li key={result} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: "var(--foreground)", lineHeight: "1.5" }}>
                    <CheckCircle2 aria-hidden="true" size={14} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "3px" }} />
                    <span>{result}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="public-detail-actions" style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--line)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <Link className="button button-gold" href="/contact">
            Start a Similar Engagement <ArrowRight size={15} />
          </Link>
          <Link className="button button-secondary" href="/services">
            Explore Capabilities
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-shell public-project-detail">
      <Link className="text-link" href="/portfolio">
        <ArrowLeft size={15} /> All work
      </Link>
      {sessionProject ? (
        <>
          <p className="eyebrow"><span />Session portfolio preview</p>
          <span className="service-icon"><BriefcaseBusiness aria-hidden="true" /></span>
          <h1>{sessionProject.title}</h1>
          <p className="public-project-summary">{sessionProject.summary}</p>
          <p className="demo-public-note">
            This project was added in the current app session and marked for preview. It is not a published client case study or saved record.
          </p>
          <div className="public-detail-actions">
            <Link className="text-link" href="/services">Explore services <ArrowRight size={15} /></Link>
            <Link className="text-link" href="/contact">Contact <ArrowRight size={15} /></Link>
          </div>
        </>
      ) : (
        <div className="empty-work">
          <div>
            <BriefcaseBusiness aria-hidden="true" size={26} />
            <h1>Case study not found</h1>
            <p>The requested case study could not be located in our published archive.</p>
            <Link className="text-link" href="/portfolio">
              Return to portfolio <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
