import "server-only";

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Resolve the trusted origin used for Supabase Auth callbacks. */
export function resolveAppOrigin(localFallback?: string): URL | null {
  let configuredOrigin: string | undefined;

  if (process.env.VERCEL_ENV === "preview") {
    const deploymentHost = process.env.VERCEL_URL;
    if (!deploymentHost || !/^[a-z0-9.-]+\.vercel\.app$/i.test(deploymentHost)) return null;
    configuredOrigin = `https://${deploymentHost}`;
  } else {
    configuredOrigin = process.env.APP_BASE_URL || localFallback;
  }

  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin);
    const isLocal = isLoopback(origin.hostname);
    if ((origin.protocol !== "https:" && !isLocal)
      || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      return null;
    }
    return new URL(origin.origin);
  } catch {
    return null;
  }
}
