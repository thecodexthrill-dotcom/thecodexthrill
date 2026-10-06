import type { Metadata } from "next";

import { PageIntro } from "@/components/site/page-intro";
import { ContactForm } from "@/components/site/contact-form";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Contact",
  "Start a conversation with TheCodexThrill about your software architecture, web application, or product challenge.",
  "/contact",
);

export default function ContactPage() {
  return (
    <>
      <PageIntro
        description="A useful first conversation starts with what you’re trying to make possible. Share the challenge, the ambition, or the question you’re working through."
        eyebrow="Get in touch"
        title={<>Let’s talk about what’s <em>next.</em></>}
      />
      <section className="section container-shell">
        <ContactForm />
      </section>
    </>
  );
}
