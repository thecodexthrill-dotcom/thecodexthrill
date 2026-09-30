import type { Metadata } from "next";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "About",
  "Learn about TheCodexThrill’s thoughtful, engineering-led approach to building digital products.",
  "/about",
);

const principles = [
  {
    number: "01",
    title: "Understand before building",
    description:
      "The best solutions begin with a shared view of the problem and the people it affects.",
  },
  {
    number: "02",
    title: "Make the complex feel clear",
    description:
      "Thoughtful design and deliberate engineering make powerful technology easier to use.",
  },
  {
    number: "03",
    title: "Build for what comes next",
    description:
      "Good foundations leave room to learn, adapt, and keep creating value over time.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro
        description="TheCodexThrill brings product thinking and software engineering together to help ambitious ideas become useful, enduring digital products."
        eyebrow="About us"
        title={<>Technology should move people <em>forward.</em></>}
      />
      <section className="section section-muted">
        <div className="container-shell statement">
          <p className="eyebrow"><span />Our point of view</p>
          <h2>
            Build. Innovate. Deploy. <span>Scale.</span>
          </h2>
        </div>
      </section>
      <section aria-label="Our principles" className="section container-shell">
        <div className="value-grid">
          {principles.map((principle) => (
            <article className="value-card" key={principle.number}>
              <span>{principle.number}</span>
              <h2>{principle.title}</h2>
              <p>{principle.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
