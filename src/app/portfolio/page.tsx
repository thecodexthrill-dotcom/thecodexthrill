import type { Metadata } from "next";
import { PortfolioShowcase } from "@/components/site/portfolio-showcase";
import { PageIntro } from "@/components/site/page-intro";
import { getPublishedCaseStudies } from "@/lib/cms-public";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Portfolio",
  "Explore selected digital products and software work from TheCodexThrill.",
  "/portfolio",
);

export default async function PortfolioPage() {
  const projects = await getPublishedCaseStudies();

  return (
    <>
      <PageIntro
        description="A closer look at the products, platforms, and software experiences we help bring to life."
        eyebrow="Selected work"
        title={<>Ideas, made <em>real.</em></>}
      />
      <section className="content-section container-shell">
        <PortfolioShowcase initialProjects={projects} />
      </section>
    </>
  );
}
