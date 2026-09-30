import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { ArticleIndex } from "@/components/site/article-index";

export const metadata: Metadata = {
  title: "Insights",
  description: "Perspectives on product thinking and software engineering.",
};

export default function BlogPage() {
  return (
    <>
      <PageIntro eyebrow="Ideas & practice" title={<>Notes for building <em>well.</em></>} description="Practical perspectives on shaping useful products, thoughtful engineering, and the decisions that connect them." />
      <section className="content-section container-shell"><ArticleIndex /></section>
    </>
  );
}
