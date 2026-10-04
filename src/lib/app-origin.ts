import "server-only";

import { SITE_ORIGIN } from "@/lib/site-origin";

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Resolve a trusted Auth callback origin without allowing loopback in production. */
export function resolveAppOrigin(localFallback?: string): URL | null {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isProduction = process.env.VERCEL_ENV === "production"
    || (process.env.NODE_ENV === "production" && !isPreview);
  let configuredOrigin: string | undefined;

  if (isPreview) {
    const deploymentHost = process.env.VERCEL_URL;
    if (!deploymentHost || !/^[a-z0-9.-]+\.vercel\.app$/i.test(deploymentHost)) return null;
    configuredOrigin = `https://${deploymentHost}`;
  } else if (isProduction) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) return null;
    try {
      if (new URL(appBaseUrl).origin !== SITE_ORIGIN) return null;
    } catch {
      return null;
    }
    configuredOrigin = SITE_ORIGIN;
  } else {
    configuredOrigin = process.env.APP_BASE_URL || localFallback || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3000" : undefined);
  }

  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin);
    const isLocal = isLoopback(origin.hostname);
    if ((origin.protocol !== "https:" && !isLocal)
      || (isProduction && (isLocal || origin.origin !== SITE_ORIGIN))
      || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      return null;
    }
    return new URL(origin.origin);
  } catch {
    return null;
  }
}