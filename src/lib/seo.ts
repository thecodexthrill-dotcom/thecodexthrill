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

export function getBreadcrumbStructuredData(
  crumbs: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: crumb.name,
      item: new URL(crumb.path, SITE_ORIGIN).toString(),
    })),
  };
}

export function getServiceStructuredData(service: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    url: new URL(service.path, SITE_ORIGIN).toString(),
    provider: {
      "@type": "Organization",
      name: "TheCodexThrill",
      url: SITE_ORIGIN,
    },
  };
}

export function getArticleStructuredData(article: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: new URL(article.path, SITE_ORIGIN).toString(),
    author: {
      "@type": "Organization",
      name: "TheCodexThrill Engineering",
      url: SITE_ORIGIN,
    },
    publisher: {
      "@type": "Organization",
      name: "TheCodexThrill",
      url: SITE_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}/icon.svg`,
      },
    },
    datePublished: article.datePublished || "2026-10-01",
  };
}

export function getCaseStudyStructuredData(project: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    abstract: project.description,
    url: new URL(project.path, SITE_ORIGIN).toString(),
    creator: {
      "@type": "Organization",
      name: "TheCodexThrill",
      url: SITE_ORIGIN,
    },
  };
}