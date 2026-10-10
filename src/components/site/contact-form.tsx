"use client";

import { useActionState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Mail, ShieldCheck } from "lucide-react";
import { submitContactEnquiryAction, type ContactActionState } from "@/lib/supabase/contact-action";
import { AVAILABLE_SERVICES } from "@/lib/supabase/lead-service-helper";

const initialState: ContactActionState = {};

export function ContactForm({
  initialService,
  initialSource = "website",
}: {
  initialService?: string;
  initialSource?: string;
}) {
  const [state, formAction, pending] = useActionState(submitContactEnquiryAction, initialState);

  const resolvedInitialService = useMemo(() => {
    if (!initialService) return "";
    const matched = AVAILABLE_SERVICES.find(
      (s) =>
        s.slug === initialService.toLowerCase() ||
        s.title.toLowerCase() === initialService.toLowerCase(),
    );
    return matched ? matched.title : initialService;
  }, [initialService]);

  return (
    <div className="contact-grid">
      <div className="contact-form-column">
        {state.message ? (
          <div className="contact-success-card" role="status">
            <CheckCircle2 aria-hidden="true" className="contact-success-icon" size={32} />
            <h2>Enquiry Received</h2>
            <p>{state.message}</p>
            <p className="contact-success-sub">
              If your request requires a mutual NDA before deep technical discussions, our team will supply a standard agreement promptly.
            </p>
            <Link className="button button-gold" href="/services">
              Explore Our Capabilities
            </Link>
          </div>
        ) : (
          <form action={formAction} className="contact-form">
            {state.error && (
              <div aria-live="assertive" className="module-alert" role="alert">
                {state.error}
              </div>
            )}

            {/* Hidden honeypot field for bot protection */}
            <input
              aria-hidden="true"
              autoComplete="off"
              name="_hp_security"
              style={{ display: "none", position: "absolute", left: "-9999px" }}
              tabIndex={-1}
              type="text"
            />

            {/* Inbound source tracking */}
            <input name="source" type="hidden" value={initialSource} />

            <div className="contact-field-group">
              <label htmlFor="contactName">
                Your Name <span className="contact-required">*</span>
              </label>
              <input
                autoComplete="name"
                disabled={pending}
                id="contactName"
                name="contactName"
                placeholder="Ada Lovelace"
                required
                type="text"
              />
            </div>

            <div className="contact-field-group">
              <label htmlFor="email">
                Work Email <span className="contact-required">*</span>
              </label>
              <input
                autoComplete="email"
                disabled={pending}
                id="email"
                name="email"
                placeholder="ada@company.com"
                required
                type="email"
              />
            </div>

            <div className="contact-field-group">
              <label htmlFor="companyName">
                Company or Organization <span className="contact-optional">(Optional)</span>
              </label>
              <input
                autoComplete="organization"
                disabled={pending}
                id="companyName"
                name="companyName"
                placeholder="Acme Technologies"
                type="text"
              />
            </div>

            <div className="contact-field-group">
              <label htmlFor="requestedService">
                Service of Interest <span className="contact-optional">(Optional)</span>
              </label>
              <select
                defaultValue={resolvedInitialService}
                disabled={pending}
                id="requestedService"
                name="requestedService"
              >
                <option value="">General Technical Inquiry / Advisory</option>
                {AVAILABLE_SERVICES.map((s) => (
                  <option key={s.slug} value={s.title}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="contact-field-group">
              <label htmlFor="message">
                Project Overview &amp; Goals <span className="contact-required">*</span>
              </label>
              <textarea
                disabled={pending}
                id="message"
                name="message"
                placeholder="Tell us about what you want to build, the key workflows, timeline expectations, or technology requirements..."
                required
                rows={5}
              />
            </div>

            <button className="button-gold contact-submit-button" disabled={pending} type="submit">
              {pending ? "Submitting Enquiry…" : "Send Enquiry"}
            </button>
          </form>
        )}
      </div>

      <aside className="contact-info-column">
        <div className="contact-info-card">
          <p className="eyebrow"><span />Direct Communication</p>
          <h3>Direct Engineering Channel</h3>
          <p className="contact-info-desc">
            Skip the sales funnel. Your message goes straight to our engineering and product leadership.
          </p>

          <ul className="contact-details-list">
            <li>
              <Mail aria-hidden="true" size={18} />
              <div>
                <strong>Direct Email</strong>
                <a href="mailto:contact@thecodexthrill.com">
                  contact@thecodexthrill.com <ArrowUpRight aria-hidden="true" size={12} />
                </a>
              </div>
            </li>
            <li>
              <Clock aria-hidden="true" size={18} />
              <div>
                <strong>Guaranteed Response Time</strong>
                <span>Within 1 business day for all technical inquiries</span>
              </div>
            </li>
            <li>
              <ShieldCheck aria-hidden="true" size={18} />
              <div>
                <strong>Confidentiality First</strong>
                <span>Strict non-disclosure; mutual NDA supported prior to technical architecture reviews</span>
              </div>
            </li>
          </ul>

          <div className="contact-quick-links">
            <h4>Learn More About Us</h4>
            <div className="contact-link-row">
              <Link href="/services">Our Services <ArrowUpRight aria-hidden="true" size={12} /></Link>
              <Link href="/security">Security Policies <ArrowUpRight aria-hidden="true" size={12} /></Link>
              <Link href="/pricing">Pricing Approach <ArrowUpRight aria-hidden="true" size={12} /></Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

