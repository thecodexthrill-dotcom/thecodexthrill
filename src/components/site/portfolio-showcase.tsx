"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";

import { useWorkspaceDemo } from "@/components/platform/workspace-demo";
import { portfolioProjects, type PortfolioProject } from "@/lib/public-content";

export function PortfolioShowcase({ initialProjects }: { initialProjects?: PortfolioProject[] }) {
  const { projects } = useWorkspaceDemo();
  const sessionFeatured = projects.filter((project) => project.portfolio);
  const allProjects = initialProjects && initialProjects.length > 0 ? initialProjects : portfolioProjects;

  return (
    <>
      <div className="public-project-grid">
        {allProjects.map((project) => (
          <article className="public-project-card" key={project.slug}>
            <div className="project-card-header">
              <span className="record-status">{project.category}</span>
              <span className="project-card-industry">{project.industry}</span>
            </div>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <div className="project-card-tech">
              {project.technologies.slice(0, 3).map((tech) => (
                <span className="project-tech-pill" key={tech}>
                  {tech}
                </span>
              ))}
            </div>
            <Link className="text-link" href={`/portfolio/${project.slug}`}>
              View Case Study <ArrowRight size={15} />
            </Link>
          </article>
        ))}
      </div>

      {sessionFeatured.length > 0 && (
        <section style={{ marginTop: "48px" }}>
          <p className="demo-public-note">
            Session preview: additional project details entered in this local browser session.
          </p>
          <div className="public-project-grid" style={{ marginTop: "16px" }}>
            {sessionFeatured.map((project) => (
              <Link className="public-project-card" href={`/portfolio/${project.id}`} key={project.id}>
                <span className="service-icon"><BriefcaseBusiness aria-hidden="true" /></span>
                <h2>{project.title}</h2>
                <p>{project.summary}</p>
                <span className="text-link">View project <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
