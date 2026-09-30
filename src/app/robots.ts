import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/login", "/forgot-password", "/reset-password", "/invite", "/auth"] },
    sitemap: "https://thecodexthrill.com/sitemap.xml",
    host: "https://thecodexthrill.com",
  };
}
