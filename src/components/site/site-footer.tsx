import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const footerLinks = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/blog", label: "Insights" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell">
        <div className="footer-top">
          <div>
            <p className="eyebrow">TheCodexThrill</p>
            <h2>Build what moves you forward.</h2>
          </div>
          <Link className="footer-contact" href="/contact">
            Let’s talk <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} TheCodexThrill</span>
          <nav aria-label="Footer navigation">
            {footerLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <span>Build. Innovate. Deploy. Scale.</span>
        </div>
      </div>
    </footer>
  );
}
