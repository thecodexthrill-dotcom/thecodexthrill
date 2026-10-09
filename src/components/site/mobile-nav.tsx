"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { HeaderAuthAction } from "@/components/site/header-auth-action";

export type NavItem = {
  href: string;
  label: string;
};

export function MobileNav({ navigation }: { navigation: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu automatically on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="mobile-menu-wrapper">
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls="mobile-navigation-drawer"
        className="mobile-menu-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        {isOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
      </button>

      {isOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        id="mobile-navigation-drawer"
        className={`mobile-nav-drawer ${isOpen ? "drawer-open" : "drawer-closed"}`}
        aria-hidden={!isOpen}
      >
        <div className="mobile-nav-inner">
          <div className="mobile-nav-eyebrow">
            <span>Navigation</span>
          </div>

          <nav aria-label="Mobile navigation" className="mobile-nav-links">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  className={`mobile-nav-link ${isActive ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="mobile-nav-active-dot" aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>

          <div className="mobile-nav-divider" />

          <div className="mobile-nav-eyebrow">
            <span>Access &amp; Actions</span>
          </div>

          <div className="mobile-nav-actions">
            <div className="mobile-nav-auth" onClick={() => setIsOpen(false)}>
              <HeaderAuthAction mobile />
            </div>

            <Link
              className="mobile-nav-link subtle"
              href="/invite/accept"
              onClick={() => setIsOpen(false)}
            >
              <span>Accept an invitation</span>
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>

            <Link
              className="mobile-nav-cta-btn"
              href="/contact"
              onClick={() => setIsOpen(false)}
            >
              <span>Get started</span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

