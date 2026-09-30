import type { Metadata } from "next";
import { MessageCircleMore } from "lucide-react";

import { PageIntro } from "@/components/site/page-intro";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Contact",
  "Start a conversation with TheCodexThrill about your software or product challenge.",
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
      <section className="content-section container-shell">
        <div className="empty-work">
          <div>
            <MessageCircleMore aria-hidden="true" size={28} />
            <h2>Our secure enquiry channel is being prepared.</h2>
            <p>
              Enquiry delivery will be enabled after the approved submission
              flow and abuse protections are in place. This page does not
              currently collect or send personal information.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
