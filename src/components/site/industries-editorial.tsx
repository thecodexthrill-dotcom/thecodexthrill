import Link from "next/link";
import { ArrowUpRight, Landmark, Activity, Boxes, Truck, ShoppingBag, ShieldCheck } from "lucide-react";
import { defaultIndustries, type PublicIndustry } from "@/lib/cms-public";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const iconMap: Record<string, React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>> = {
  Landmark,
  Activity,
  Boxes,
  Truck,
  ShoppingBag,
  ShieldCheck,
};

export function IndustriesEditorial({
  industries = defaultIndustries,
}: {
  industries?: PublicIndustry[];
}) {
  const activeIndustries = industries && industries.length > 0 ? industries : defaultIndustries;

  return (
    <section aria-labelledby="industries-section-title" className="section-industries">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="industries-header">
            <div>
              <p className="eyebrow">
                <span />
                Strategic Verticals
              </p>
              <h2 id="industries-section-title">
                Engineered for <em>High-Consequence</em> Domains.
              </h2>
            </div>
            <p className="industries-header-sub">
              We operate where software failure is not an option. From regulated financial ledgers to remote clinical tablets, our engineering patterns adapt to the strict constraints of your industry.
            </p>
          </div>
        </ScrollReveal>

        {/* Editorial Sector Grid */}
        <div className="industries-editorial-grid">
          {activeIndustries.map((ind, idx) => {
            const Icon = iconMap[ind.iconName] || Landmark;
            return (
              <ScrollReveal
                key={ind.id || ind.slug}
                variant="fade-up"
                delayMs={Math.min(idx * 75, 300)}
              >
                <article className="industry-editorial-card">
                  <div className="ind-card-top">
                    <span className="ind-accent-badge">{ind.accent}</span>
                    <div className="ind-icon-wrap">
                      <Icon aria-hidden="true" size={20} />
                    </div>
                  </div>

                  <h3 className="ind-title">{ind.title}</h3>

                  <div className="ind-problem-box">
                    <span className="ind-label">The Industry Bottleneck:</span>
                    <p>{ind.challenge}</p>
                  </div>

                  <div className="ind-solution-box">
                    <span className="ind-label">Our Engineered Solution:</span>
                    <p>{ind.solution}</p>
                  </div>

                  <div className="ind-card-footer">
                    <div className="ind-compliance-tags">
                      {ind.complianceTags.map((c) => (
                        <span className="compliance-tag" key={c}>
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="ind-metric-strip">
                      <strong>Impact:</strong> {ind.metrics}
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal variant="fade-up" delayMs={100}>
          <div className="industries-bottom-bar">
            <p>Don&apos;t see your specific domain listed? Our core systems architecture scales to any data-intensive domain.</p>
            <Link className="text-link" href="/contact">
              Request an Industry Architecture Assessment <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
