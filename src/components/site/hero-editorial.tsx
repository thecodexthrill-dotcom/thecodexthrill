import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, ShieldCheck, Cpu, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSlideshow } from "@/components/site/hero-slideshow";
import {
  defaultHeroSettings,
  defaultHeroSlides,
  type PublicHeroSettings,
  type PublicHeroSlide,
} from "@/lib/cms-public";

export function HeroEditorial({
  settings = defaultHeroSettings,
  slides = defaultHeroSlides,
}: {
  settings?: PublicHeroSettings;
  slides?: PublicHeroSlide[];
}) {
  const currentSettings = settings || defaultHeroSettings;
  const currentSlides = slides && slides.length > 0 ? slides : defaultHeroSlides;

  return (
    <section className="hero-editorial-wrap">
      <div className="container-shell">
        <div className="hero-editorial-header">
          <div className="hero-editorial-badge animate-hero-badge">
            <span className="badge-dot" />
            <span className="badge-text">{currentSettings.badgeText}</span>
          </div>

          <h1 className="hero-editorial-title animate-hero-title">
            {currentSettings.title.includes("Scale") ? (
              <>
                {currentSettings.title.replace("Scale.", "")}
                <em>Scale.</em>
              </>
            ) : (
              currentSettings.title
            )}
          </h1>

          <p className="hero-editorial-lead animate-hero-lead">{currentSettings.lead}</p>

          <div className="hero-editorial-actions animate-hero-cta">
            <Button asChild size="default" className="hero-primary-btn">
              <Link href={currentSettings.primaryCtaUrl}>
                {currentSettings.primaryCtaLabel} <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="hero-secondary-btn">
              <Link href={currentSettings.secondaryCtaUrl}>
                {currentSettings.secondaryCtaLabel} <ArrowUpRight aria-hidden="true" size={16} />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="hero-ghost-btn">
              <Link href="/services">
                Engineering Capabilities <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </Button>
          </div>
        </div>

        {/* Dynamic Multi-Image Slideshow */}
        <HeroSlideshow slides={currentSlides} />

        {/* Engineering Proof Metrics Strip */}
        <div className="hero-proof-strip animate-hero-strip">
          <div className="proof-strip-item">
            <div className="proof-strip-icon">
              <ShieldCheck aria-hidden="true" size={20} />
            </div>
            <div className="proof-strip-text">
              <strong>Zero-Trust RLS Architecture</strong>
              <span>Row-Level Security on every tenant table with AAL2 MFA gates</span>
            </div>
          </div>

          <div className="proof-strip-item">
            <div className="proof-strip-icon">
              <Cpu aria-hidden="true" size={20} />
            </div>
            <div className="proof-strip-text">
              <strong>Sub-50ms Latency Budget</strong>
              <span>Edge-rendered Next.js App Router with streaming and ISR</span>
            </div>
          </div>

          <div className="proof-strip-item">
            <div className="proof-strip-icon">
              <CheckCircle2 aria-hidden="true" size={20} />
            </div>
            <div className="proof-strip-text">
              <strong>Deterministic Quality</strong>
              <span>63+ automated end-to-end test suites, strict TypeScript, 0 lints</span>
            </div>
          </div>

          <div className="proof-strip-item">
            <div className="proof-strip-icon">
              <Database aria-hidden="true" size={20} />
            </div>
            <div className="proof-strip-text">
              <strong>Zero-Downtime Releases</strong>
              <span>Reversible declarative migrations verified against Supabase Cloud</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
