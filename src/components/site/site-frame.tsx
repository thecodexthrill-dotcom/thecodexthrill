"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { buildProxyAuthCallbackRedirect } from "@/lib/supabase/auth-callback";
import { classifyAuthLinkError } from "@/lib/supabase/auth-link-status";

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

  useEffect(() => {
    if (isPlatform || isIdentity || typeof window === "undefined") return;

    const currentUrl = new URL(window.location.href);
    const callbackRedirect = buildProxyAuthCallbackRedirect(currentUrl);
    if (callbackRedirect) {
      window.location.replace(callbackRedirect.pathname + callbackRedirect.search + window.location.hash);
      return;
    }

    if (window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const isInvite = hashParams.get("type") === "invite";
      if (hashParams.has("error") || hashParams.has("error_code") || hashParams.has("error_description")) {
        const rawError = hashParams.get("error_code") ?? hashParams.get("error") ?? hashParams.get("error_description") ?? "";
        const status = classifyAuthLinkError(rawError);
        const destination = isInvite
          ? `/invite/accept?invite=${status}`
          : `/reset-password?auth=${status === "invalid" ? "link-invalid" : status}`;
        window.location.replace(destination);
        return;
      }
      if (hashParams.has("access_token") && hashParams.has("refresh_token")) {
        const destination = isInvite ? "/invite/accept" : "/reset-password";
        window.location.replace(destination + window.location.hash);
      }
    }
  }, [isIdentity, isPlatform, pathname]);

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
