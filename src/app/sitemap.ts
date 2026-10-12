import type { MetadataRoute } from "next";
import {
  getPublishedArticles,
  getPublishedCaseStudies,
  getPublishedPages,
  getPublishedServices,
} from "@/lib/cms-public";
import { articles, portfolioProjects, services } from "@/lib/public-content";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cmsServices, cmsArticles, cmsCaseStudies, cmsPages] = await Promise.all([
    getPublishedServices(),
    getPublishedArticles(),
    getPublishedCaseStudies(),
    getPublishedPages(),
  ]);

  const publicRoutes = [
    "/",
    "/services",
    "/portfolio",
    "/about",
    "/pricing",
    "/blog",
    "/contact",
    "/privacy",
    "/terms",
    "/security",
  ];

  const serviceSlugs = new Set([
    ...services.map((s) => s.slug),
    ...cmsServices.map((s) => s.slug),
  ]);
  const articleSlugs = new Set([
    ...articles.map((a) => a.slug),
    ...cmsArticles.map((a) => a.slug),
  ]);
  const caseStudySlugs = new Set([
    ...portfolioProjects.map((p) => p.slug),
    ...cmsCaseStudies.map((p) => p.slug),
  ]);
  const standalonePagePaths = cmsPages
    .map((p) => `/${p.slug.replace(/^\/+/, "")}`)
    .filter((p) => !publicRoutes.includes(p));

  const allPaths = Array.from(
    new Set([
      ...publicRoutes,
      ...standalonePagePaths,
      ...Array.from(serviceSlugs).map((slug) => `/services/${slug}`),
      ...Array.from(articleSlugs).map((slug) => `/blog/${slug}`),
      ...Array.from(caseStudySlugs).map((slug) => `/portfolio/${slug}`),
    ]),
  );

  return allPaths.map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}