"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness } from "lucide-react";
import { useWorkspaceDemo } from "@/components/platform/workspace-demo";

export function PublicPortfolioDetail({ slug }: { slug: string }) {
  const { projects } = useWorkspaceDemo();
  const project = projects.find((item) => item.id === slug && item.portfolio);
  return <section className="container-shell public-project-detail">
    <Link className="text-link" href="/portfolio"><ArrowLeft size={15} />All work</Link>
    {project ? <><p className="eyebrow"><span />Session portfolio preview</p><span className="service-icon"><BriefcaseBusiness aria-hidden="true" /></span><h1>{project.title}</h1><p className="public-project-summary">{project.summary}</p><p className="demo-public-note">This project was added in the current app session and marked for preview. It is not a published client case study or saved record.</p><div className="public-detail-actions"><Link className="text-link" href="/services">Explore services <ArrowRight size={15} /></Link><Link className="text-link" href="/contact">Contact <ArrowRight size={15} /></Link></div></> : <div className="empty-work"><div><BriefcaseBusiness aria-hidden="true" size={26} /><h1>Project preview unavailable</h1><p>This session-only project is missing or was not selected for the portfolio preview. Choose it again from Admin → Portfolio.</p><Link className="text-link" href="/admin/portfolio">Open portfolio manager <ArrowRight size={15} /></Link></div></div>}
  </section>;
}
