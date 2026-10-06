"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { defaultFaqs, type PublicFaq } from "@/lib/cms-public";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function EngineeringFaq({
  faqs = defaultFaqs,
}: {
  faqs?: PublicFaq[];
}) {
  const activeFaqs = faqs && faqs.length > 0 ? faqs : defaultFaqs;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section aria-labelledby="faq-section-title" className="section-faq">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="faq-header">
            <div>
              <p className="eyebrow">
                <span />
                Engineering Transparency
              </p>
              <h2 id="faq-section-title">
                Clear Answers to <em>Critical Inquiries.</em>
              </h2>
            </div>
            <p className="faq-header-sub">
              Technical diligence matters. Here is how we handle delivery cadence, code ownership, security guarantees, and ongoing platform reliability.
            </p>
          </div>
        </ScrollReveal>

        <div className="faq-accordion-list">
          {activeFaqs.map((item, idx) => {
            const isOpen = openIndex === idx;

            return (
              <ScrollReveal
                key={item.id || idx}
                variant="fade-up"
                delayMs={Math.min(idx * 50, 250)}
              >
                <div
                  className={`faq-accordion-item ${isOpen ? "item-open" : ""}`}
                >
                  <button
                    aria-expanded={isOpen}
                    className="faq-question-button"
                    onClick={() => toggle(idx)}
                    type="button"
                  >
                    <span className="faq-question-text">{item.question}</span>
                    <span className={`faq-icon-arrow ${isOpen ? "arrow-rotate" : ""}`}>
                      <ChevronDown aria-hidden="true" size={18} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="faq-answer-panel">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
