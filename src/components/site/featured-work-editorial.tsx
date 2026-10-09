import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { portfolioProjects, type PortfolioProject } from "@/lib/public-content";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function FeaturedWorkEditorial({
  projects = portfolioProjects,
}: {
  projects?: PortfolioProject[];
}) {
  const activeProjects = projects && projects.length > 0 ? projects : portfolioProjects;
  const featured = activeProjects.slice(0, 3);

  return (
    <section aria-labelledby="featured-work-title" className="section-featured-work">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="featured-work-header">
            <div>
              <p className="eyebrow">
                <span />
                Proven Execution
              </p>
              <h2 id="featured-work-title">
                Selected <em>Production Deliveries.</em>
              </h2>
            </div>
            <div className="featured-work-header-right">
              <p>
                Real engineering challenges solved with measurable architectural outcomes. Every case study reflects verifiable systems built for high-performance operations.
              </p>
              <Link className="text-link" href="/portfolio">
                Explore full case study archive <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </ScrollReveal>

        <div className="featured-work-stream">
          {featured.map((proj, idx) => (
            <ScrollReveal
              key={proj.slug}
              variant="fade-up"
              delayMs={Math.min(idx * 90, 300)}
            >
              <article className="featured-work-row">
                <div className="featured-work-index">
                  <span>0{idx + 1}</span>
                </div>

                <div className="featured-work-content">
                  <div className="featured-work-tags">
                    <span className="featured-index-mobile">0{idx + 1}</span>
                    <span className="featured-category">{proj.category}</span>
                    <span className="tag-dot">·</span>
                    <span className="featured-industry">{proj.industry}</span>
                  </div>

                  <h3 className="featured-title">
                    <Link href={`/portfolio/${proj.slug}`}>
                      {proj.title}
                    </Link>
                  </h3>

                  <p className="featured-summary">{proj.summary}</p>

                  <div className="featured-results-list">
                    <strong>Key Architectural Outcomes:</strong>
                    <ul>
                      {proj.results.map((res, rIdx) => (
                        <li key={rIdx}>
                          <CheckCircle2 aria-hidden="true" size={15} />
                          <span>{res}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="featured-tech-row">
                    {proj.technologies.map((t) => (
                      <span className="tech-badge" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="featured-card-link-wrap">
                    <Link className="case-study-btn" href={`/portfolio/${proj.slug}`}>
                      <span>Read Architecture Blueprint</span>
                      <ArrowUpRight aria-hidden="true" size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
