import Link from "next/link";
import { ArrowRight, Check, Compass, Cpu, FileCheck2, GitMerge, Layout, Rocket, RefreshCw } from "lucide-react";
import { defaultProcessSteps, type PublicProcessStep } from "@/lib/cms-public";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const iconMap: Record<string, React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>> = {
  Compass,
  Cpu,
  Layout,
  GitMerge,
  FileCheck2,
  Rocket,
  RefreshCw,
};

export function EngineeringProcess({
  steps = defaultProcessSteps,
}: {
  steps?: PublicProcessStep[];
}) {
  const activeSteps = steps && steps.length > 0 ? steps : defaultProcessSteps;

  return (
    <section aria-labelledby="process-section-title" className="section-process">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="process-header">
            <div>
              <p className="eyebrow">
                <span />
                TheCodexThrill Methodology
              </p>
              <h2 id="process-section-title">
                From First Schema to <em>Production Scale.</em>
              </h2>
            </div>
            <div className="process-header-desc">
              <p>
                Engineering excellence is a repeatable discipline. Our 7-stage software development lifecycle ensures every milestone is predictable, verifiable, and free of unpleasant surprises.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Vertical Editorial Timeline */}
        <div className="process-timeline">
          {activeSteps.map((stage, idx) => {
            const Icon = iconMap[stage.iconName] || Compass;

            return (
              <ScrollReveal
                key={stage.id || stage.stepNumber}
                variant="fade-up"
                delayMs={Math.min(idx * 60, 300)}
              >
                <div className="process-step-block">
                  <div className="process-step-indicator">
                    <span className="step-num">{stage.stepNumber}</span>
                    <div className="step-line" />
                  </div>

                  <div className="process-step-card">
                    <div className="step-card-top">
                      <div className="step-badge-wrap">
                        <span className="step-phase-badge">{stage.phaseName}</span>
                        <span className="step-duration">{stage.duration}</span>
                      </div>
                      <div className="step-icon-circle">
                        <Icon aria-hidden="true" size={20} />
                      </div>
                    </div>

                    <h3 className="step-name">{stage.name}</h3>
                    <p className="step-summary">{stage.summary}</p>

                    <div className="step-deliverables-grid">
                      <div className="deliverables-sub">
                        <strong>Deliverables:</strong>
                        <ul>
                          {stage.deliverables.map((item, dIdx) => (
                            <li key={dIdx}>
                              <Check aria-hidden="true" size={14} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="step-gate-box">
                        <span className="gate-title">Quality Gate Criterion</span>
                        <p>{stage.qualityGate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal variant="fade-up" delayMs={100}>
          <div className="process-cta-banner">
            <div className="process-cta-copy">
              <h3>Have an engineering milestone to meet?</h3>
              <p>We scope sprint deliverables clearly and deploy code to production every week.</p>
            </div>
            <Link className="button-gold" href="/contact">
              Schedule Architecture Briefing <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
