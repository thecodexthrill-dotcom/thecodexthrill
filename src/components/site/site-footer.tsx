import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

type FooterLink = { href: string; label: string; isExternal?: boolean };

const footerGroups: { title: string; links: FooterLink[] }[] = [
  {
    title: "Services",
    links: [
      { href: "/services/web-applications", label: "Web applications" },
      { href: "/services/enterprise-software", label: "Enterprise software" },
      { href: "/services/ai-solutions", label: "AI solutions" },
      { href: "/services/mobile-products", label: "Mobile products" },
      { href: "/services/cloud-devops", label: "Cloud & DevOps" },
      { href: "/services/saas-platforms", label: "SaaS platforms" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/portfolio", label: "Selected work" },
      { href: "/blog", label: "Insights & blog" },
      { href: "/pricing", label: "Pricing approach" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/portal", label: "Client portal" },
      { href: "/admin", label: "Admin workspace" },
      { href: "/account/security", label: "Account security & MFA" },
      { href: "/invite/accept", label: "Accept invitation" },
      { href: "/login", label: "Login" },
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/security", label: "Security & governance" },
      { href: "mailto:security@thecodexthrill.com", label: "Vulnerability report", isExternal: true },
    ],
  },
];

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

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
              Engineering high-performance web applications, enterprise platforms, and AI solutions built for resilience and scale.
            </p>
            <a className="footer-brand-link" href="mailto:contact@thecodexthrill.com">
              <span>contact@thecodexthrill.com</span>
              <ArrowUpRight aria-hidden="true" size={13} />
            </a>
            <div className="footer-security-badge">
              <ShieldCheck aria-hidden="true" size={15} />
              <span>Supabase Cloud · Zero-Trust RLS</span>
            </div>
          </div>

          {footerGroups.map((group) => (
            <nav aria-label={group.title} className="footer-link-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((item) => (
                  <li key={item.href + item.label}>
                    {item.isExternal ? (
                      <a href={item.href}>
                        <span>{item.label}</span>
                        <ArrowUpRight aria-hidden="true" size={12} />
                      </a>
                    ) : (
                      <Link href={item.href}>
                        <span>{item.label}</span>
                        <ArrowUpRight aria-hidden="true" size={12} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-info">
            <p>© {year} <span>TheCodexThrill</span>. All rights reserved.</p>
            <p className="footer-bottom-motto">
              Build <i /> Innovate <i /> Deploy <i /> Scale
            </p>
          </div>

          <div className="footer-social-links">
            <a
              aria-label="TheCodexThrill on GitHub"
              className="footer-social-icon"
              href="https://github.com/thecodexthrill"
              rel="noreferrer"
              target="_blank"
            >
              <GithubIcon size={16} />
            </a>
            <a
              aria-label="TheCodexThrill on LinkedIn"
              className="footer-social-icon"
              href="https://linkedin.com/company/thecodexthrill"
              rel="noreferrer"
              target="_blank"
            >
              <LinkedinIcon size={16} />
            </a>
            <a
              aria-label="TheCodexThrill on Twitter"
              className="footer-social-icon"
              href="https://x.com/thecodexthrill"
              rel="noreferrer"
              target="_blank"
            >
              <TwitterIcon size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}