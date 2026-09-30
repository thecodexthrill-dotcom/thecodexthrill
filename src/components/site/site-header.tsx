import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";

const navigation = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Work" },
  { href: "/blog", label: "Insights" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

function Brand() {
  return (
    <Link aria-label="TheCodexThrill home" className="brand-lockup" href="/">
      <span aria-hidden="true" className="brand-mark">
        C<span>.</span>
      </span>
      <span className="brand-wordmark">
        THECODEX<span>THRILL</span>
      </span>
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
          <Link className="header-login" href="/login">Login</Link>
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
              <Link className="mobile-login-link" href="/login">Login</Link>
              <Link href="/invite/accept">Accept an invitation</Link>
              <Link href="/contact">Get started</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
