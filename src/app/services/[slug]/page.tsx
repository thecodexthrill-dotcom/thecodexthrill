import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
} from "lucide-react";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/public-content";
import { getPublishedServiceBySlug } from "@/lib/cms-public";
import {
  getPageMetadata,
  getServiceStructuredData,
  getBreadcrumbStructuredData,
} from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

const iconMap: Record<string, React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>> = {
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
};

export function generateStaticParams() {
  return services.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedServiceBySlug(slug);
  if (!service) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return getPageMetadata(service.title, service.description, `/services/${service.slug}`);
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getPublishedServiceBySlug(slug);
  if (!service) notFound();

  const Icon = (service.iconName && iconMap[service.iconName]) || Code2;
  const features =
    service.features && service.features.length > 0
      ? service.features
      : [
          "Understand the workflow and desired outcome",
          "Choose a clear first step and validate assumptions",
          "Build with quality, access, and future change in mind",
        ];

  const breadcrumbSchema = getBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Services", path: "/services" },
    { name: service.title, path: `/services/${service.slug}` },
  ]);
  const serviceSchema = getServiceStructuredData({
    title: service.title,
    description: service.description,
    path: `/services/${service.slug}`,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbSchema, serviceSchema]).replace(/</g, "\\u003c"),
        }}
      />
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
              {features.map((feature, idx) => (
                <li key={idx}>
                  <Check aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="section container-shell service-detail-bottom">
        <div className="service-detail-icon"><Icon aria-hidden="true" /></div>
        <div>
          <p className="eyebrow"><span />Explore the next step</p>
          <h2>Bring us the challenge you’re working through.</h2>
        </div>
        <Button asChild>
          <Link
            href={
              !service.ctaUrl || service.ctaUrl === "/contact"
                ? `/contact?service=${encodeURIComponent(service.slug)}`
                : service.ctaUrl
            }
          >
            {service.ctaLabel || `Enquire about ${service.title}`} <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
      <div className="container-shell back-link-row">
        <Link className="text-link" href="/services">
          <ArrowLeft size={15} /> All services
        </Link>
      </div>
    </>
  );
}
