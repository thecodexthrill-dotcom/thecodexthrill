import type { Metadata } from "next";
import { PublicPortfolioDetail } from "@/components/site/public-portfolio-detail";
import { getPublishedCaseStudies, getPublishedCaseStudyBySlug } from "@/lib/cms-public";
import { getPageMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const projects = await getPublishedCaseStudies();
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedCaseStudyBySlug(slug);

  if (project) {
    return getPageMetadata(
      `${project.title} — Case Study`,
      project.summary,
      `/portfolio/${project.slug}`,
    );
  }

  return {
    title: "Project preview",
    robots: { index: false, follow: false },
  };
}

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getPublishedCaseStudyBySlug(slug);
  return <PublicPortfolioDetail initialProject={project} slug={slug} />;
}
