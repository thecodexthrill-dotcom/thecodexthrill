import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Terminal, Cpu, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { HeroEditorial } from "@/components/site/hero-editorial";
import { CapabilitiesEditorial } from "@/components/site/capabilities-editorial";
import { EngineeringProcess } from "@/components/site/engineering-process";
import { IndustriesEditorial } from "@/components/site/industries-editorial";
import { FeaturedWorkEditorial } from "@/components/site/featured-work-editorial";
import { TechStackMatrix } from "@/components/site/tech-stack-matrix";
import { EngineeringFaq } from "@/components/site/engineering-faq";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { getPageMetadata } from "@/lib/seo";
import {
  getPublishedHeroSettings,
  getPublishedHeroSlides,
  getPublishedCapabilities,
  getPublishedProcessSteps,
  getPublishedIndustries,
  getPublishedTechStack,
  getPublishedFaqs,
  getPublishedCaseStudies,
} from "@/lib/cms-public";

export const metadata: Metadata = getPageMetadata(
  "TheCodexThrill — Engineering Digital Products That Scale",
  "TheCodexThrill architects and builds high-performance web applications, enterprise platforms, autonomous AI systems, and mission-critical cloud software.",
  "/",
);

export default async function HomePage() {
  const [
    heroSettings,
    heroSlides,
    capabilities,
    processSteps,
    industries,
    techStack,
    faqs,
    caseStudies,
  ] = await Promise.all([
    getPublishedHeroSettings(),
    getPublishedHeroSlides(),
    getPublishedCapabilities(),
    getPublishedProcessSteps(),
    getPublishedIndustries(),
    getPublishedTechStack(),
    getPublishedFaqs(),
    getPublishedCaseStudies(),
  ]);

  return (
    <>
      {/* 1. Hero Editorial Section with Multi-Image Slideshow & Verification Strip */}
      <HeroEditorial settings={heroSettings} slides={heroSlides} />

      {/* 2. Capabilities Section (Content > Containers) */}
      <CapabilitiesEditorial capabilities={capabilities} />

      {/* 3. Engineering Process (7-Stage Methodology) */}
      <EngineeringProcess steps={processSteps} />

      {/* 4. Strategic Industry Verticals */}
      <IndustriesEditorial industries={industries} />

      {/* 5. Production Case Study Spotlights */}
      <FeaturedWorkEditorial projects={caseStudies} />

      {/* 6. Comprehensive Technology Stack Matrix */}
      <TechStackMatrix items={techStack} />

      {/* 7. Engineering FAQs */}
      <EngineeringFaq faqs={faqs} />

      {/* 8. Conversion Section with Architectural Focus */}
      <section className="section-final-conversion">
        <div className="container-shell">
          <ScrollReveal variant="fade-up">
            <div className="conversion-card">
            <div className="conversion-content">
              <div className="conversion-badge">
                <span className="badge-dot" />
                <span>Next Release Window Opening</span>
              </div>
              <h2 className="conversion-title">
                Let&apos;s Architect Your Next <em>Breakthrough Platform.</em>
              </h2>
              <p className="conversion-desc">
                Whether you need a full greenfield product built from first schema, a legacy system modernized without downtime, or practical AI agents embedded into your workflows—we bring senior engineering firepower to your team.
              </p>
              <div className="conversion-actions">
                <Button asChild size="default" className="conversion-primary-btn">
                  <Link href="/contact">
                    Start an Engineering Inquiry <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="conversion-secondary-btn">
                  <Link href="/portfolio">
                    Review Architecture Case Studies <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="conversion-aside">
              <div className="conversion-audit-box">
                <div className="audit-box-header">
                  <Terminal aria-hidden="true" size={16} />
                  <span>TheCodexThrill Guarantee</span>
                </div>
                <ul>
                  <li>
                    <ShieldCheck aria-hidden="true" size={15} />
                    <span>Zero-Trust database security policies by default</span>
                  </li>
                  <li>
                    <Cpu aria-hidden="true" size={15} />
                    <span>Strict 100% TypeScript compilation and automated tests</span>
                  </li>
                  <li>
                    <Terminal aria-hidden="true" size={15} />
                    <span>Full IP and source code repository ownership transferred</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
    </>
  );
}
