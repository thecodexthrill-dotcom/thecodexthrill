import type { Metadata } from "next";
import { PortfolioShowcase } from "@/components/site/portfolio-showcase";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Portfolio",
  "Explore selected digital products and software work from TheCodexThrill.",
  "/portfolio",
);

export default function PortfolioPage() {
  return (
    <>
      <PageIntro
        description="A closer look at the products, platforms, and software experiences we help bring to life."
        eyebrow="Selected work"
        title={<>Ideas, made <em>real.</em></>}
      />
      <section className="content-section container-shell">
        <PortfolioShowcase />
      </section>
    </>
  );
}
