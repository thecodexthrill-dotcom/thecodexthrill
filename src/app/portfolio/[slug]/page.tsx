import type { Metadata } from "next";
import { PublicPortfolioDetail } from "@/components/site/public-portfolio-detail";

export const metadata: Metadata = { title: "Project preview", robots: { index: false, follow: false } };

export default async function PortfolioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPortfolioDetail slug={slug} />;
}
