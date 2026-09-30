import {
  ArrowDownRight,
  ArrowRight,
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/site/service-card";

const capabilities = [
  {
    title: "Web applications",
    description:
      "Purpose-built digital products with considered interfaces and dependable engineering beneath them.",
    icon: Code2,
  },
  {
    title: "Mobile products",
    description:
      "Useful, coherent mobile experiences shaped around the people who rely on them.",
    icon: Smartphone,
  },
  {
    title: "AI solutions",
    description:
      "Practical intelligence integrated where it creates measurable value and earns user trust.",
    icon: BrainCircuit,
  },
  {
    title: "SaaS platforms",
    description:
      "Flexible product foundations designed to grow with customers, teams, and new ideas.",
    icon: Layers3,
  },
  {
    title: "Cloud & DevOps",
    description:
      "Clear paths from development to deployment, with operations in view from day one.",
    icon: Cloud,
  },
  {
    title: "Enterprise software",
    description:
      "Connected systems and workflows built around the realities of complex organizations.",
    icon: Workflow,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero container-shell">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span />Software solutions for a brighter tomorrow</p>
            <h1>
              Build. <em>Innovate.</em><br className="hero-line-break" /> Deploy. Scale.
            </h1>
            <p className="hero-description">
              We build web, mobile, and AI solutions that help teams bring useful
              ideas into the world with clarity and care.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/contact">
                  Start your project <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/portfolio">View our work <ArrowRight aria-hidden="true" size={16} /></Link>
              </Button>
            </div>
            <p className="hero-note">Product thinking · Engineering · Delivery</p>
          </div>
          <div aria-hidden="true" className="hero-art">
            <div className="hero-orbit">
              <span className="orbit-ring" />
              <span className="orbit-ring" />
              <span className="orbit-ring" />
              <span className="orbit-core">C</span>
              <span className="orbit-node one"><Code2 /></span>
              <span className="orbit-node two"><Cloud /></span>
              <span className="orbit-node three"><Layers3 /></span>
              <span className="orbit-node four"><BrainCircuit /></span>
            </div>
            <span className="art-caption">Ideas into engineered outcomes</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="capabilities-title" className="section section-muted">
        <div className="container-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span />What we build</p>
              <h2 id="capabilities-title">Technology with a reason to exist.</h2>
            </div>
            <p>
              From first concept to dependable delivery, we bring product
              thinking and engineering together.
            </p>
          </div>
          <div className="service-grid">
            {capabilities.map((capability) => (
              <ServiceCard key={capability.title} {...capability} />
            ))}
          </div>
          <div className="section-link-row">
            <Link className="text-link" href="/services">
              See all capabilities <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section container-shell">
        <div className="statement">
          <p className="eyebrow"><span />How we work</p>
          <h2>
            Good software starts with <span>understanding.</span> Great
            software keeps earning its place.
          </h2>
        </div>
        <div className="statement-detail">
          <p>
            We make complex ideas easier to move forward: align on the problem,
            build with care, and keep improving what matters.
          </p>
          <Link className="text-link" href="/about">
            Meet our approach <ArrowDownRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-shell contact-panel">
          <div>
            <p className="eyebrow"><span />Have a challenge in mind?</p>
            <h2>Let’s make the next step count.</h2>
            <p>
              Tell us what you’re working toward. We’ll start with the problem,
              then work out what to build.
            </p>
          </div>
          <Button asChild>
            <Link href="/contact">
              Get in touch <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
