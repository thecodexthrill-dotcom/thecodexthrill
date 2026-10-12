/**
 * Phase 7 — PWA Cache Policy, Auth-Boundary Sanitization & Offline Resilience
 *
 * Security Invariants:
 * 1. Authenticated workspaces (/admin, /portal, /account, /mfa, /auth, /invite, /bootstrap),
 *    API endpoints (/api/*), private client documents, invoices, MFA responses, and any
 *    request with credentials/tokens or Set-Cookie headers MUST NEVER be stored in
 *    Service Worker Cache Storage.
 * 2. Logout, account switching, session expiry, and tenant switching MUST immediately
 *    purge volatile client storage and notify the Service Worker to clear runtime caches.
 * 3. Stale chunk errors and waiting Service Worker updates MUST be recoverable without
 *    trapping users on an outdated build.
 */

export const PWA_CACHE_VERSION = "v2" as const;
export const PWA_SHELL_CACHE_NAME = `thecodexthrill-shell-${PWA_CACHE_VERSION}` as const;
export const PWA_STATIC_CACHE_NAME = `thecodexthrill-static-${PWA_CACHE_VERSION}` as const;
export const PWA_OFFLINE_URL = "/offline.html" as const;

export const PWA_PRECACHED_SHELL_ASSETS: readonly string[] = [
  "/offline.html",
  "/icon.svg",
  "/manifest.webmanifest",
] as const;

/**
 * Route prefixes that carry authenticated user, tenant, MFA, or operational data
 * and MUST NEVER be cached in shared or persistent Service Worker caches.
 */
export const NEVER_CACHE_PATH_PREFIXES: readonly string[] = [
  "/admin",
  "/portal",
  "/account",
  "/mfa",
  "/auth",
  "/invite",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/bootstrap",
  "/api",
  "/setup-required",
  "/access-denied",
  "/access-pending",
] as const;

/**
 * Public marketing routes eligible for network-first navigation with offline fallback.
 */
export const PUBLIC_NAVIGATION_EXACT_PATHS: readonly string[] = [
  "/",
  "/services",
  "/portfolio",
  "/about",
  "/blog",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
  "/security",
] as const;

export const PUBLIC_NAVIGATION_PREFIXES: readonly string[] = [
  "/services/",
  "/portfolio/",
  "/blog/",
] as const;

/**
 * Query parameter names that indicate sensitive auth handoff, signed URLs, or exports.
 */
export const SENSITIVE_QUERY_PARAM_NAMES: readonly string[] = [
  "token",
  "token_hash",
  "code",
  "access_token",
  "refresh_token",
  "signature",
  "signed",
  "download",
  "apikey",
  "api_key",
  "secret",
] as const;

export type PwaFetchStrategy =
  | "bypass-cross-origin"
  | "bypass-non-get"
  | "network-only-sensitive"
  | "network-only-protected-navigation"
  | "network-first-public-navigation"
  | "stale-while-revalidate-static"
  | "cache-first-shell";

export type PwaRequestDescriptor = {
  url: string;
  method?: string;
  mode?: string;
  destination?: string;
  headers?: Record<string, string | undefined>;
  appOrigin?: string;
};

/**
 * Normalizes a pathname by stripping trailing slashes (except root "/") and lowercasing.
 */
export function normalizePwaPathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return "/";
  const lowered = trimmed.toLowerCase();
  return lowered.endsWith("/") ? lowered.slice(0, -1) : lowered;
}

/**
 * Returns true if the pathname belongs to an authenticated, identity, MFA, or API boundary
 * that must never be cached.
 */
export function isProtectedOrSensitivePath(pathname: string): boolean {
  const normalized = normalizePwaPathname(pathname);
  return NEVER_CACHE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * Returns true if the pathname is an allowlisted public marketing route.
 */
export function isAllowlistedPublicNavigationPath(pathname: string): boolean {
  const normalized = normalizePwaPathname(pathname);
  if (isProtectedOrSensitivePath(normalized)) return false;
  if (PUBLIC_NAVIGATION_EXACT_PATHS.includes(normalized)) return true;
  return PUBLIC_NAVIGATION_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

/**
 * Returns true if the pathname is an immutable or public static asset safe for
 * bounded static caching.
 */
export function isPublicStaticAssetPath(pathname: string): boolean {
  const normalized = normalizePwaPathname(pathname);
  if (isProtectedOrSensitivePath(normalized)) return false;
  if (PWA_PRECACHED_SHELL_ASSETS.includes(normalized)) return true;
  if (normalized.startsWith("/_next/static/")) return true;
  if (normalized.startsWith("/brand/")) return true;
  return false;
}

/**
 * Checks whether a URL's query string contains any token, code, or signed-URL parameters.
 */
export function hasSensitiveQueryParams(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    const lower = key.trim().toLowerCase();
    if (SENSITIVE_QUERY_PARAM_NAMES.includes(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * Classifies a request into an explicit Service Worker fetch strategy.
 * Authenticated APIs, tenant documents, invoices, MFA, and RSC/Server Action payloads
 * are strictly classified as network-only.
 */
export function classifyPwaRequestStrategy(
  descriptor: PwaRequestDescriptor,
): PwaFetchStrategy {
  const method = (descriptor.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    return "bypass-non-get";
  }

  let parsedUrl: URL;
  const baseOrigin = descriptor.appOrigin ?? "https://thecodexthrill.com";
  try {
    parsedUrl = new URL(descriptor.url, baseOrigin);
  } catch {
    return "network-only-sensitive";
  }

  if (parsedUrl.origin !== new URL(baseOrigin).origin) {
    return "bypass-cross-origin";
  }

  const headers = descriptor.headers ?? {};
  const normalizedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") {
      normalizedHeaders[k.toLowerCase()] = v;
    }
  }

  // Never cache requests carrying explicit Authorization, Server Actions, or RSC state trees on protected routes
  if (
    normalizedHeaders["authorization"] ||
    normalizedHeaders["next-action"] ||
    normalizedHeaders["x-supabase-auth"]
  ) {
    return "network-only-sensitive";
  }

  if (hasSensitiveQueryParams(parsedUrl.searchParams)) {
    return "network-only-sensitive";
  }

  const pathname = normalizePwaPathname(parsedUrl.pathname);
  const isNavigation =
    descriptor.mode === "navigate" || descriptor.destination === "document";

  if (isProtectedOrSensitivePath(pathname)) {
    return isNavigation
      ? "network-only-protected-navigation"
      : "network-only-sensitive";
  }

  // Next.js RSC flight requests (? _rsc= or RSC: 1 header) must not pollute static caches
  if (
    normalizedHeaders["rsc"] === "1" ||
    parsedUrl.searchParams.has("_rsc")
  ) {
    return "network-only-sensitive";
  }

  if (PWA_PRECACHED_SHELL_ASSETS.includes(pathname)) {
    return "cache-first-shell";
  }

  if (isPublicStaticAssetPath(pathname)) {
    return "stale-while-revalidate-static";
  }

  if (isNavigation && isAllowlistedPublicNavigationPath(pathname)) {
    return "network-first-public-navigation";
  }

  return "network-only-sensitive";
}

/**
 * Verifies that an HTTP response is safe to store in a Service Worker cache.
 * Rejects non-200 responses, opaque/cross-origin responses, responses setting cookies,
 * and responses marked `no-store` or `private`.
 */
export function isResponseSafeToCache(response: {
  status: number;
  type?: string;
  headers?: { get(name: string): string | null } | Record<string, string | undefined>;
}): boolean {
  if (response.status !== 200) return false;
  if (response.type && response.type !== "basic" && response.type !== "default") {
    return false;
  }

  const getHeader = (name: string): string => {
    if (!response.headers) return "";
    if (typeof (response.headers as { get?: unknown }).get === "function") {
      return (
        (response.headers as { get(n: string): string | null }).get(name) ?? ""
      );
    }
    const record = response.headers as Record<string, string | undefined>;
    const foundKey = Object.keys(record).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    return foundKey ? (record[foundKey] ?? "") : "";
  };

  const setCookie = getHeader("set-cookie").trim();
  if (setCookie.length > 0) return false;

  const cacheControl = getHeader("cache-control").toLowerCase();
  if (
    cacheControl.includes("no-store") ||
    cacheControl.includes("private")
  ) {
    return false;
  }

  return true;
}

/**
 * Determines whether an authentication state transition requires an immediate
 * client + Service Worker boundary purge (logout, session expiry, or user switch).
 */
export function shouldTriggerAuthBoundaryReset(params: {
  previousUserId: string | null | undefined;
  nextUserId: string | null | undefined;
  authEvent?: string | null;
}): { shouldReset: boolean; reason: "signed_out" | "session_expired" | "account_switched" | "none" } {
  const prev = params.previousUserId?.trim() || null;
  const next = params.nextUserId?.trim() || null;
  const event = (params.authEvent ?? "").toUpperCase();

  if (event === "SIGNED_OUT") {
    return { shouldReset: true, reason: "signed_out" };
  }
  if (prev !== null && next === null) {
    return { shouldReset: true, reason: "session_expired" };
  }
  if (prev !== null && next !== null && prev !== next) {
    return { shouldReset: true, reason: "account_switched" };
  }
  return { shouldReset: false, reason: "none" };
}

/**
 * Determines whether a tenant/organization context switch requires purging
 * volatile client state.
 */
export function shouldTriggerTenantSwitchReset(
  previousOrganizationId: string | null | undefined,
  nextOrganizationId: string | null | undefined,
): boolean {
  const prev = previousOrganizationId?.trim() || null;
  const next = nextOrganizationId?.trim() || null;
  return prev !== null && next !== null && prev !== next;
}

/**
 * Detects whether a runtime error is caused by a stale Next.js asset/chunk after
 * a new deployment so the client can safely reload once to fetch the latest bundle.
 */
export function isStaleAssetOrChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const rawMessage =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);
  const normalized = rawMessage.toLowerCase();
  return (
    normalized.includes("chunkloaderror") ||
    normalized.includes("loading chunk") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("error loading dynamically imported module") ||
    normalized.includes("unable to preload css")
  );
}

/**
 * Purges volatile client storage and instructs the active Service Worker to clear
 * any runtime caches while preserving the user's non-sensitive theme preference.
 */
export async function purgeSensitiveClientStateAndCaches(options?: {
  reason?: string;
  clearSupabaseLocalStorage?: boolean;
}): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const reloadGuard = window.sessionStorage.getItem("ctt_chunk_reload_at");
    window.sessionStorage.clear();
    if (reloadGuard) {
      window.sessionStorage.setItem("ctt_chunk_reload_at", reloadGuard);
    }
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (lower === "theme") continue;
      if (
        lower.startsWith("ctt_") ||
        lower.startsWith("workspace-demo") ||
        (options?.clearSupabaseLocalStorage &&
          (lower.startsWith("sb-") || lower.includes("supabase")))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore localStorage access errors
  }

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== PWA_SHELL_CACHE_NAME)
          .map((key) => window.caches.delete(key)),
      );
    }
  } catch {
    // Ignore CacheStorage errors
  }

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "AUTH_BOUNDARY_RESET",
        reason: options?.reason ?? "boundary_transition",
      });
    }
  } catch {
    // Ignore postMessage errors
  }
}

