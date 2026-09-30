import type { Metadata } from "next";

const siteUrl = "https://thecodexthrill.com";

export function getPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = new URL(path, siteUrl);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "TheCodexThrill",
      title: `${title} | TheCodexThrill`,
      description,
      url,
    },
    twitter: { card: "summary", title: `${title} | TheCodexThrill`, description },
  };
}
