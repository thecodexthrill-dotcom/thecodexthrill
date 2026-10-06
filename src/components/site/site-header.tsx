import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { HeaderAuthAction } from "@/components/site/header-auth-action";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Insights" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact Us" },
];

function Brand() {
  return (
    <Link aria-label="TheCodexThrill home" className="brand-lockup" href="/">
      <span aria-hidden="true" className="brand-mark-symbol">
        <svg width="30" height="30" viewBox="0 0 96 96" fill="none">
          <defs>
            <linearGradient id="header-gold-gradient" x1="19" y1="18" x2="76" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F2C777" />
              <stop offset="1" stopColor="#A96E24" />
            </linearGradient>
          </defs>
          <path d="M12 21h47L46 35H25v40H12V21Z" fill="currentColor" />
          <path d="M53 15h27L58 37v37L44 87V39l9-9V15Z" fill="url(#header-gold-gradient)" />
          <path d="M62 20h22L67 37l18 20H63L49 42l13-13V20Z" fill="currentColor" />
          <path d="m66 43 8-8m-8 8 8 8m11-16-8 8 8 8" stroke="url(#header-gold-gradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="brand-text-block">
        <span className="brand-wordmark">
          The<span>Codex</span>Thrill<sup>™</sup>
        </span>
        <span className="brand-micro-tagline">Build · Innovate · Deploy · Scale</span>
      </div>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner container-shell">
        <Brand />
        <nav aria-label="Primary navigation" className="desktop-nav">
          {navigation.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <HeaderAuthAction />
          <ThemeToggle />
          <Button asChild className="header-cta" size="small">
            <Link href="/contact">
              Get started <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </Button>
          <details className="mobile-menu">
            <summary aria-label="Open navigation menu">
              <Menu aria-hidden="true" size={20} />
            </summary>
            <nav aria-label="Mobile navigation" className="mobile-nav">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
              <HeaderAuthAction mobile />
              <Link href="/invite/accept">Accept an invitation</Link>
              <Link href="/contact">Get started</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
