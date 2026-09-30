"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";

import { useWorkspaceDemo } from "@/components/platform/workspace-demo";

export function PortfolioShowcase() {
  const { projects } = useWorkspaceDemo();
  const featured = projects.filter((project) => project.portfolio);

  if (!featured.length) {
    return <div className="empty-work"><div><BriefcaseBusiness aria-hidden="true" size={28} /><h2>Our portfolio is taking shape.</h2><p>Approved work will appear here when available. We don’t publish client work without permission.</p></div></div>;
  }

  return <>
    <p className="demo-public-note">Session preview only: these are project details entered in this open browser session. They are not published or saved.</p>
    <div className="public-project-grid">{featured.map((project) => <Link className="public-project-card" href={`/portfolio/${project.id}`} key={project.id}><span className="service-icon"><BriefcaseBusiness aria-hidden="true" /></span><h2>{project.title}</h2><p>{project.summary}</p><span className="text-link">View project <ArrowRight size={15} /></span></Link>)}</div>
  </>;
}
