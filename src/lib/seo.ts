import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/site-origin";

export function getPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = new URL(path, SITE_ORIGIN);
  const shareTitle = `${title} | TheCodexThrill`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "TheCodexThrill",
      title: shareTitle,
      description,
      url,
    },
    twitter: { card: "summary", title: shareTitle, description },
  };
}