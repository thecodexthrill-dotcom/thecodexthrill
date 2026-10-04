import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/portal",
        "/api",
        "/auth",
        "/bootstrap",
        "/login",



        "/forgot-password",
        "/reset-password",
        "/invite",
        "/mfa",
        "/setup-required",
        "/access-denied",
        "/access-pending",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_ORIGIN).toString(),
    host: SITE_ORIGIN,
  };
}