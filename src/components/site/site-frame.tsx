"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPlatform = pathname.startsWith("/admin") || pathname.startsWith("/portal");
  const isIdentity =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invite/") ||
    pathname === "/mfa" ||
    pathname.startsWith("/bootstrap/") ||
    pathname.startsWith("/access-") ||
    pathname.startsWith("/setup-required");

  if (isPlatform || isIdentity) return children;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
