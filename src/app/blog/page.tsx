import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { ArticleIndex } from "@/components/site/article-index";
import { getPublishedArticles } from "@/lib/cms-public";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Insights",
  "Perspectives on product thinking and software engineering.",
  "/blog",
);

export default async function BlogPage() {
  const articles = await getPublishedArticles();

  return (
    <>
      <PageIntro eyebrow="Ideas & practice" title={<>Notes for building <em>well.</em></>} description="Practical perspectives on shaping useful products, thoughtful engineering, and the decisions that connect them." />
      <section className="content-section container-shell"><ArticleIndex initialArticles={articles} /></section>
    </>
  );
}
