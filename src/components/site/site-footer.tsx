import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const footerGroups = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/portfolio", label: "Selected work" },
      { href: "/blog", label: "Insights" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/services", label: "All services" },
      { href: "/services/web-applications", label: "Web & applications" },
      { href: "/services/enterprise-software", label: "Enterprise software" },
      { href: "/services/ai-solutions", label: "AI & automation" },
      { href: "/services/mobile-products", label: "Mobile products" },
      { href: "/services/cloud-devops", label: "Cloud & DevOps" },
    ],
  },
] as const;

function BrandMark() {
  return (
    <svg aria-hidden="true" className="footer-logo-mark" viewBox="0 0 96 96" fill="none">
      <defs>
        <linearGradient id="footer-gold" x1="19" y1="18" x2="76" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F2C777" />
          <stop offset="1" stopColor="#A96E24" />
        </linearGradient>
      </defs>
      <path d="M12 21h47L46 35H25v40H12V21Z" fill="currentColor" />
      <path d="M53 15h27L58 37v37L44 87V39l9-9V15Z" fill="url(#footer-gold)" />
      <path d="M62 20h22L67 37l18 20H63L49 42l13-13V20Z" fill="currentColor" />
      <path d="m66 43 8-8m-8 8 8 8m11-16-8 8 8 8" stroke="url(#footer-gold)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container-shell footer-shell">
        <section id="footer-top" aria-labelledby="footer-cta-title" className="footer-cta">
          <div className="footer-cta-copy">
            <p className="footer-eyebrow"><span />The next great thing starts here</p>
            <h2 id="footer-cta-title">
              Let&apos;s Build Something <em>Extraordinary.</em>
            </h2>
            <p className="footer-cta-description">
              We turn ambitious ideas into thoughtful software and digital
              products built to move business forward.
            </p>
          </div>
          <Link className="button-gold footer-button-primary" href="/contact">
            Start a Project <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
          <span aria-hidden="true" className="footer-cta-orbit" />
        </section>

        <div className="footer-main">
          <div className="footer-brand-column">
            <Link aria-label="TheCodexThrill home" className="footer-brand" href="/">
              <BrandMark />
              <span className="footer-brand-lockup">
                <span className="footer-wordmark">The<span>Codex</span>Thrill<sup>™</sup></span>
                <span className="footer-tagline">Build <i /> Innovate <i /> Deploy <i /> Scale</span>
              </span>
            </Link>
            <p className="footer-brand-description">
              Software, AI and digital experiences engineered for what comes next.
            </p>
          </div>

          {footerGroups.map((group) => (
            <nav aria-label={group.title} className="footer-link-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((item) => (
                  <li key={item.href + item.label}>
                    <Link href={item.href}>
                      <span>{item.label}</span>
                      <ArrowUpRight aria-hidden="true" size={12} />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footer-bottom">
          <p>© {year} <span>TheCodexThrill</span></p>
        </div>
      </div>
    </footer>
  );
}