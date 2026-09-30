import type { Metadata } from "next";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { getPageMetadata } from "@/lib/seo";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { services } from "@/lib/public-content";

export const metadata: Metadata = getPageMetadata(
  "Services",
  "Explore TheCodexThrill software development, web and mobile applications, AI, SaaS, cloud, and enterprise capabilities.",
  "/services",
);

export default function ServicesPage() {
  return (
    <>
      <PageIntro
        description="A considered blend of product direction, design, and engineering—shaped around the work your business needs to do."
        eyebrow="Capabilities"
        title={<>Build with clarity. <em>Scale with confidence.</em></>}
      />
      <section aria-label="Our services" className="content-section container-shell">
        <div className="service-grid">
          {services.map(({ slug, title, short, icon: Icon }) => (
            <Link className="service-card service-card-link" href={`/services/${slug}`} key={slug}>
              <span className="service-icon"><Icon aria-hidden="true" /></span>
              <h2>{title}</h2>
              <p>{short}</p>
              <span className="service-more">Explore service <ArrowRight aria-hidden="true" size={15} /></span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section section-muted">
        <div className="container-shell contact-panel">
          <div>
            <p className="eyebrow"><span />A good place to begin</p>
            <h2>Start with the challenge.</h2>
            <p>We’ll help shape the right next step for your product or team.</p>
          </div>
          <Button asChild>
            <Link href="/contact">Talk with us <ArrowRight size={16} /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
