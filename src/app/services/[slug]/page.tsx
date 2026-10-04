import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/public-content";
import { getPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return getPageMetadata(service.title, service.description, `/services/${service.slug}`);
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <>
      <PageIntro
        eyebrow="Our capabilities"
        title={<>{service.title} <em>with purpose.</em></>}
        description={service.description}
      />
      <section className="section section-muted">
        <div className="container-shell service-detail-grid">
          <div>
            <p className="eyebrow"><span />A considered approach</p>
            <h2>Start with the people and the problem.</h2>
          </div>
          <div className="service-detail-copy">
            <p>{service.description}</p>
            <ul>
              <li><Check aria-hidden="true" />Understand the workflow and desired outcome</li>
              <li><Check aria-hidden="true" />Choose a clear first step and validate assumptions</li>
              <li><Check aria-hidden="true" />Build with quality, access, and future change in mind</li>
            </ul>
          </div>
        </div>
      </section>
      <section className="section container-shell service-detail-bottom">
        <div className="service-detail-icon"><Icon aria-hidden="true" /></div>
        <div><p className="eyebrow"><span />Explore the next step</p><h2>Bring us the challenge you’re working through.</h2></div>
        <Button asChild><Link href="/contact">Start a conversation <ArrowRight size={16} /></Link></Button>
      </section>
      <div className="container-shell back-link-row"><Link className="text-link" href="/services"><ArrowLeft size={15} /> All services</Link></div>
    </>
  );
}
