import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/site/page-intro";
import { articles } from "@/lib/public-content";
import { getPublishedArticleBySlug } from "@/lib/cms-public";
import { getPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return getPageMetadata(article.title, article.excerpt, `/blog/${article.slug}`);
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  return (
    <>
      <PageIntro eyebrow={article.category} title={<>{article.title}</>} description={`${article.excerpt} · ${article.readingTime}`} />
      <article className="section section-muted">
        <div className="article-body container-shell">
          {article.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <div className="article-endnote"><span>Build. Innovate. Deploy. Scale.</span><Link className="text-link" href="/contact">Continue the conversation <ArrowRight size={15} /></Link></div>
        </div>
      </article>
      <div className="container-shell back-link-row"><Link className="text-link" href="/blog"><ArrowLeft size={15} /> All insights</Link></div>
    </>
  );
}
