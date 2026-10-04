import type { MetadataRoute } from "next";
import { articles, services } from "@/lib/public-content";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = ["/", "/services", "/portfolio", "/about", "/pricing", "/blog", "/contact"];
  const detailRoutes = [
    ...services.map(({ slug }) => `/services/${slug}`),
    ...articles.map(({ slug }) => `/blog/${slug}`),
  ];

  return [...publicRoutes, ...detailRoutes].map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}