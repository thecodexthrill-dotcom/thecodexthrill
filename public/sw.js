/* global self, caches, Response, URL, clients */

const CACHE_VERSION = "v2";
const SHELL_CACHE_NAME = `thecodexthrill-shell-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `thecodexthrill-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_STATIC_CACHE_ENTRIES = 80;

const PRECACHED_SHELL_ASSETS = [
  "/offline.html",
  "/icon.svg",
  "/manifest.webmanifest",
];

const NEVER_CACHE_PATH_PREFIXES = [
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
];

const PUBLIC_NAVIGATION_EXACT_PATHS = [
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
];

const PUBLIC_NAVIGATION_PREFIXES = ["/services/", "/portfolio/", "/blog/"];

const SENSITIVE_QUERY_PARAMS = [
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
];

function normalizePathname(pathname) {
  const trimmed = (pathname || "").trim();
  if (!trimmed || trimmed === "/") return "/";
  const lowered = trimmed.toLowerCase();
  return lowered.endsWith("/") ? lowered.slice(0, -1) : lowered;
}

function isProtectedOrSensitivePath(pathname) {
  const normalized = normalizePathname(pathname);
  return NEVER_CACHE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function isAllowlistedPublicNavigationPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (isProtectedOrSensitivePath(normalized)) return false;
  if (PUBLIC_NAVIGATION_EXACT_PATHS.includes(normalized)) return true;
  return PUBLIC_NAVIGATION_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function isPublicStaticAssetPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (isProtectedOrSensitivePath(normalized)) return false;
  if (PRECACHED_SHELL_ASSETS.includes(normalized)) return true;
  if (normalized.startsWith("/_next/static/")) return true;
  if (normalized.startsWith("/brand/")) return true;
  return false;
}

function hasSensitiveQueryParams(searchParams) {
  for (const key of searchParams.keys()) {
    if (SENSITIVE_QUERY_PARAMS.includes(key.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

function isResponseSafeToCache(response) {
  if (!response || response.status !== 200) return false;
  if (response.type && response.type !== "basic" && response.type !== "default") {
    return false;
  }
  const setCookie = (response.headers.get("set-cookie") || "").trim();
  if (setCookie.length > 0) return false;

  const cacheControl = (
    response.headers.get("cache-control") || ""
  ).toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
    return false;
  }
  return true;
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const excess = keys.slice(0, keys.length - maxEntries);
      await Promise.all(excess.map((req) => cache.delete(req)));
    }
  } catch {
    // Non-fatal cache maintenance
  }
}

async function serveOfflineFallback() {
  try {
    const cache = await caches.open(SHELL_CACHE_NAME);
    const cachedOffline = await cache.match(OFFLINE_URL);
    if (cachedOffline) {
      const body = await cachedOffline.text();
      return new Response(body, {
        status: 503,
        statusText: "Service Unavailable (Offline)",
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      });
    }
  } catch {
    // Fall through to minimal inline fallback
  }
  return new Response(
    "<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Offline · TheCodexThrill</title></head><body style='background:#080909;color:#f5f4f0;font-family:sans-serif;padding:32px'><h1>You are offline.</h1><p>Reconnect to the network and reload to continue.</p></body></html>",
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    },
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHED_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("thecodexthrill-") &&
                key !== SHELL_CACHE_NAME &&
                key !== STATIC_CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (
    data.type === "AUTH_BOUNDARY_RESET" ||
    data.type === "PURGE_SENSITIVE_CACHES"
  ) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== SHELL_CACHE_NAME)
              .map((key) => caches.delete(key)),
          ),
        )
        .then(async () => {
          const shellCache = await caches.open(SHELL_CACHE_NAME);
          const shellKeys = await shellCache.keys();
          await Promise.all(
            shellKeys
              .filter((req) => {
                const reqPath = normalizePathname(new URL(req.url).pathname);
                return !PRECACHED_SHELL_ASSETS.includes(reqPath);
              })
              .map((req) => shellCache.delete(req)),
          );
        }),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    return;
  }

  if (parsedUrl.origin !== self.location.origin) {
    return;
  }

  // Never intercept or cache requests carrying auth headers, server actions, RSC flight queries, or sensitive query tokens
  if (
    request.headers.get("authorization") ||
    request.headers.get("next-action") ||
    request.headers.get("rsc") === "1" ||
    parsedUrl.searchParams.has("_rsc") ||
    hasSensitiveQueryParams(parsedUrl.searchParams)
  ) {
    return;
  }

  const pathname = normalizePathname(parsedUrl.pathname);
  const isNavigation =
    request.mode === "navigate" || request.destination === "document";

  // Protected / sensitive routes: strictly network-only; provide offline shell only on navigation failure
  if (isProtectedOrSensitivePath(pathname)) {
    if (isNavigation) {
      event.respondWith(
        fetch(request, { cache: "no-store" }).catch(() =>
          serveOfflineFallback(),
        ),
      );
    }
    return;
  }

  // Pre-cached shell assets (/offline.html, /icon.svg, /manifest.webmanifest)
  if (PRECACHED_SHELL_ASSETS.includes(pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(pathname);
        const networkPromise = fetch(request)
          .then((response) => {
            if (isResponseSafeToCache(response)) {
              void cache.put(pathname, response.clone());
            }
            return response;
          })
          .catch(() => null);
        return cached || (await networkPromise) || Response.error();
      }),
    );
    return;
  }

  // Immutable/public static assets (/_next/static/*, /brand/*)
  if (isPublicStaticAssetPath(pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (isResponseSafeToCache(response)) {
              void cache
                .put(request, response.clone())
                .then(() =>
                  trimCache(STATIC_CACHE_NAME, MAX_STATIC_CACHE_ENTRIES),
                );
            }
            return response;
          })
          .catch(() => null);
        return cached || (await fetchPromise) || Response.error();
      }),
    );
    return;
  }

  // Public marketing navigation: network-first, falling back to /offline.html when offline
  if (isNavigation && isAllowlistedPublicNavigationPath(pathname)) {
    event.respondWith(
      fetch(request).catch(() => serveOfflineFallback()),
    );
  }
});

// Safe opt-in Web Push handler (never displays sensitive payloads; requires configured VAPID provider)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TheCodexThrill", body: "You have a new workspace notification." };
  }

  const safeTitle =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim().slice(0, 120)
      : "TheCodexThrill Notification";
  const safeBody =
    typeof payload.body === "string" && payload.body.trim().length > 0
      ? payload.body.trim().slice(0, 240)
      : "Open your workspace to view the latest update.";
  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "/login";
  const safeUrl =
    rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/login";

  event.waitUntil(
    self.registration.showNotification(safeTitle, {
      body: safeBody,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: safeUrl },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";
  const safePath =
    rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/";
  const targetUrl = new URL(safePath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
