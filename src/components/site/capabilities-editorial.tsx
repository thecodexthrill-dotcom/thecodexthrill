import Link from "next/link";
import { ArrowRight, ArrowUpRight, Code2, Cloud, BrainCircuit, ShieldCheck, Smartphone, Layers } from "lucide-react";
import { defaultCapabilities, type PublicCapability } from "@/lib/cms-public";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const iconMap: Record<string, React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>> = {
  Code2,
  Cloud,
  BrainCircuit,
  ShieldCheck,
  Smartphone,
  Layers,
};

export function CapabilitiesEditorial({
  capabilities = defaultCapabilities,
}: {
  capabilities?: PublicCapability[];
}) {
  const items = capabilities && capabilities.length > 0 ? capabilities : defaultCapabilities;

  return (
    <section aria-labelledby="capabilities-editorial-title" className="section-editorial">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="editorial-section-intro">
            <div className="editorial-intro-left">
              <p className="eyebrow">
                <span />
                Engineering Core
              </p>
              <h2 id="capabilities-editorial-title">
                Disciplined Engineering.<br />
                <em>Zero Superfluous Complexity.</em>
              </h2>
            </div>
            <div className="editorial-intro-right">
              <p>
                We reject off-the-shelf templates and brittle agency shortcuts. Every system we build is designed for high concurrency, clear operational visibility, and seamless long-term maintenance.
              </p>
              <Link className="text-link" href="/services">
                Browse all service specifications <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </ScrollReveal>

        {/* Editorial Asymmetric Flow */}
        <div className="editorial-capability-stream">
          {items.map((item, index) => {
            const Icon = iconMap[item.iconName] || Code2;
            const isReversed = index % 2 === 1;

            return (
              <ScrollReveal
                key={item.id}
                variant="fade-up"
                delayMs={Math.min(index * 75, 300)}
              >
                <article
                  className={`capability-stream-row ${isReversed ? "row-reversed" : ""}`}
                  id={item.slug}
                >
                <div className="capability-stream-main">
                  <div className="capability-meta-line">
                    <span className="capability-number">{item.numberLabel}</span>
                    <span className="capability-divider" />
                    <span className="capability-category">{item.title}</span>
                  </div>

                  <h3 className="capability-headline">{item.headline}</h3>
                  <p className="capability-description">{item.description}</p>

                  <div className="capability-deliverables-block">
                    <h4>Core Engineering Deliverables:</h4>
                    <ul>
                      {item.deliverables.map((del, dIdx) => (
                        <li key={dIdx}>
                          <span className="del-bullet" />
                          <span>{del}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="capability-action-line">
                    <Link className="capability-action-link" href={`/services/${item.serviceSlug || item.slug}`}>
                      <span>Deep-dive into {item.title}</span>
                      <ArrowUpRight aria-hidden="true" size={15} />
                    </Link>
                  </div>
                </div>

                <div className="capability-stream-aside">
                  <div className="capability-tech-card">
                    <div className="tech-card-header">
                      <div className="tech-card-icon">
                        <Icon aria-hidden="true" size={24} />
                      </div>
                      <span className="tech-card-label">Production Stack</span>
                    </div>

                    <div className="tech-card-pills">
                      {item.technologies.map((t) => (
                        <span className="tech-pill" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="tech-card-specs">
                      <div className="spec-row">
                        <span>Architecture</span>
                        <strong>Modular & Micro-service Ready</strong>
                      </div>
                      <div className="spec-row">
                        <span>Security Gate</span>
                        <strong>Row-Level Security (RLS)</strong>
                      </div>
                      <div className="spec-row">
                        <span>Delivery Speed</span>
                        <strong>Continuous Integration</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          );
        })}
      </div>
      </div>
    </section>
  );
}
