import type { MetadataRoute } from "next";
import { articles, portfolioProjects, services } from "@/lib/public-content";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
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
  const detailRoutes = [
    ...services.map(({ slug }) => `/services/${slug}`),
    ...articles.map(({ slug }) => `/blog/${slug}`),
    ...portfolioProjects.map(({ slug }) => `/portfolio/${slug}`),
  ];

  return [...publicRoutes, ...detailRoutes].map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}