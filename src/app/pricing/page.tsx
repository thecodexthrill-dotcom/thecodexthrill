import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Pricing approach",
  "Understand how TheCodexThrill scopes product and engineering work.",
  "/pricing",
);

const engagements = [
  { number: "01", title: "Discover", description: "Clarify the problem, users, constraints, and the right first outcome.", items: ["Shared problem framing", "A focused definition of the work", "A clear next-step recommendation"] },
  { number: "02", title: "Build", description: "Design and engineer a useful product increment with the right people involved.", items: ["Agreed scope and milestones", "Regular review points", "Quality and accessibility in view"] },
  { number: "03", title: "Continue", description: "Improve and support a product as new evidence and needs emerge.", items: ["A prioritized improvement queue", "Visible decisions and progress", "Scope reviewed as needs change"] },
];

export default function PricingPage() {
  return (
    <>
      <PageIntro eyebrow="Working together" title={<>Clear scope. <em>Thoughtful investment.</em></>} description="Every product challenge has a different shape. We start by understanding the work, then agree on a scope and commercial approach together." />
      <section className="section section-muted">
        <div className="container-shell pricing-grid">
          {engagements.map((item) => (
            <article className="pricing-card" key={item.number}>
              <span className="pricing-number">{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <ul>{item.items.map((feature) => <li key={feature}><Check aria-hidden="true" size={16} />{feature}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
      <section className="section container-shell pricing-note">
        <div><p className="eyebrow"><span />No one-size-fits-all quote</p><h2>Start with a conversation about the work.</h2><p>Specific fees and timelines depend on the agreed scope. Nothing is quoted or committed by this page.</p></div>
        <Button asChild><Link href="/contact">Discuss your project <ArrowRight size={16} /></Link></Button>
      </section>
    </>
  );
}
