import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import manifest from "../../app/manifest.ts";
import {
  NEVER_CACHE_PATH_PREFIXES,
  PUBLIC_NAVIGATION_EXACT_PATHS,
  PWA_CACHE_VERSION,
  PWA_OFFLINE_URL,
  PWA_PRECACHED_SHELL_ASSETS,
  PWA_SHELL_CACHE_NAME,
  PWA_STATIC_CACHE_NAME,
  classifyPwaRequestStrategy,
  hasSensitiveQueryParams,
  isAllowlistedPublicNavigationPath,
  isProtectedOrSensitivePath,
  isPublicStaticAssetPath,
  isResponseSafeToCache,
  isStaleAssetOrChunkLoadError,
  shouldTriggerAuthBoundaryReset,
  shouldTriggerTenantSwitchReset,
} from "./pwa-cache-policy.ts";

test("manifest.ts provides complete installability metadata, icons, and safe public shortcuts", () => {
  const data = manifest();

  assert.equal(data.id, "/");
  assert.equal(data.start_url, "/");
  assert.equal(data.scope, "/");
  assert.equal(data.display, "standalone");
  assert.equal(data.orientation, "portrait-primary");
  assert.equal(data.prefer_related_applications, false);

  assert.ok(Array.isArray(data.icons), "Expected manifest icons array");
  const sizes = new Set(data.icons.map((icon) => icon.sizes));
  assert.ok(sizes.has("192x192"), "Expected 192x192 icon size");
  assert.ok(sizes.has("512x512"), "Expected 512x512 icon size");

  const purposes = new Set(data.icons.map((icon) => icon.purpose));
  assert.ok(purposes.has("any"), "Expected 'any' icon purpose");
  assert.ok(purposes.has("maskable"), "Expected 'maskable' icon purpose");

  assert.ok(Array.isArray(data.shortcuts), "Expected manifest shortcuts array");
  assert.ok(data.shortcuts.length >= 3, "Expected at least 3 shortcuts");
  for (const shortcut of data.shortcuts) {
    assert.ok(shortcut.url.startsWith("/"), `Shortcut URL ${shortcut.url} must be relative`);
    assert.equal(
      isProtectedOrSensitivePath(shortcut.url) && shortcut.url !== "/login",
      false,
      `Shortcut ${shortcut.url} must not point directly into an authenticated tenant route`,
    );
  }
});

test("isProtectedOrSensitivePath blocks all authenticated, identity, MFA, and API routes", () => {
  const protectedRoutes = [
    "/admin",
    "/admin/clients",
    "/admin/team",
    "/portal",
    "/portal/projects/123",
    "/portal/documents/456",
    "/portal/invoices/789",
    "/account",
    "/account/security",
    "/mfa",
    "/auth/callback",
    "/invite/accept",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/bootstrap",
    "/api/health",
    "/api/webhooks/stripe",
    "/setup-required",
    "/access-denied",
    "/access-pending",
  ];

  for (const route of protectedRoutes) {
    assert.equal(
      isProtectedOrSensitivePath(route),
      true,
      `Expected ${route} to be classified as protected/sensitive`,
    );
    assert.equal(
      isAllowlistedPublicNavigationPath(route),
      false,
      `Expected ${route} never to be allowlisted as public navigation`,
    );
    assert.equal(
      isPublicStaticAssetPath(route),
      false,
      `Expected ${route} never to be classified as a public static asset`,
    );
  }
});

test("classifyPwaRequestStrategy strictly isolates authenticated and sensitive requests from caching", () => {
  // 1. Cross-origin requests (e.g. Supabase Cloud API or Storage signed URLs)
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://isgoypmebtoipfvtaflg.supabase.co/rest/v1/organizations",
      method: "GET",
      appOrigin: "https://thecodexthrill.com",
    }),
    "bypass-cross-origin",
  );

  // 2. Non-GET mutations
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://thecodexthrill.com/admin/clients",
      method: "POST",
    }),
    "bypass-non-get",
  );

  // 3. Authenticated workspace navigations
  for (const route of ["/admin", "/admin/team", "/portal", "/portal/invoices", "/account", "/mfa"]) {
    assert.equal(
      classifyPwaRequestStrategy({
        url: `https://thecodexthrill.com${route}`,
        method: "GET",
        mode: "navigate",
        destination: "document",
      }),
      "network-only-protected-navigation",
      `Expected ${route} navigation to be network-only-protected-navigation`,
    );
  }

  // 4. Sensitive query parameters (auth callbacks, recovery tokens, signed downloads)
  for (const query of [
    "?token_hash=pkce_123&type=recovery",
    "?code=oauth_code_abc",
    "?access_token=jwt_xyz",
    "?signature=signed_doc_url",
    "?download=invoice.pdf",
  ]) {
    assert.equal(
      classifyPwaRequestStrategy({
        url: `https://thecodexthrill.com/${query}`,
        method: "GET",
        mode: "navigate",
      }),
      "network-only-sensitive",
      `Expected query ${query} to force network-only-sensitive`,
    );
    assert.equal(hasSensitiveQueryParams(new URLSearchParams(query)), true);
  }

  // 5. Explicit auth or Server Action headers
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://thecodexthrill.com/services",
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    }),
    "network-only-sensitive",
  );
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://thecodexthrill.com/services",
      method: "GET",
      headers: { "Next-Action": "action_id_123" },
    }),
    "network-only-sensitive",
  );

  // 6. Next.js RSC flight requests must never be cached as HTML or static assets
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://thecodexthrill.com/services?_rsc=1a2b3c",
      method: "GET",
      headers: { RSC: "1" },
    }),
    "network-only-sensitive",
  );

  // 7. Precached shell assets
  for (const shellAsset of PWA_PRECACHED_SHELL_ASSETS) {
    assert.equal(
      classifyPwaRequestStrategy({
        url: `https://thecodexthrill.com${shellAsset}`,
        method: "GET",
      }),
      "cache-first-shell",
    );
  }

  // 8. Immutable static bundles
  assert.equal(
    classifyPwaRequestStrategy({
      url: "https://thecodexthrill.com/_next/static/chunks/main-abc123.js",
      method: "GET",
      destination: "script",
    }),
    "stale-while-revalidate-static",
  );

  // 9. Public marketing navigation
  for (const publicPath of [...PUBLIC_NAVIGATION_EXACT_PATHS, "/services/cloud-architecture", "/portfolio/fintech-core", "/blog/zero-trust-pwa"]) {
    assert.equal(
      classifyPwaRequestStrategy({
        url: `https://thecodexthrill.com${publicPath}`,
        method: "GET",
        mode: "navigate",
        destination: "document",
      }),
      "network-first-public-navigation",
      `Expected ${publicPath} to use network-first-public-navigation`,
    );
  }
});

test("isResponseSafeToCache rejects Set-Cookie, private, no-store, non-200, and opaque responses", () => {
  assert.equal(
    isResponseSafeToCache({
      status: 200,
      type: "basic",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    }),
    true,
  );

  assert.equal(
    isResponseSafeToCache({
      status: 200,
      type: "basic",
      headers: { "set-cookie": "sb-access-token=secret; HttpOnly" },
    }),
    false,
    "Responses setting cookies must never be cached",
  );

  assert.equal(
    isResponseSafeToCache({
      status: 200,
      type: "basic",
      headers: { "cache-control": "private, no-cache, no-store, max-age=0" },
    }),
    false,
    "Private or no-store responses must never be cached",
  );

  assert.equal(
    isResponseSafeToCache({
      status: 401,
      type: "basic",
      headers: {},
    }),
    false,
  );

  assert.equal(
    isResponseSafeToCache({
      status: 200,
      type: "opaque",
      headers: {},
    }),
    false,
  );
});

test("shouldTriggerAuthBoundaryReset detects logout, session expiry, account switching, and tenant switching", () => {
  assert.deepEqual(
    shouldTriggerAuthBoundaryReset({
      previousUserId: "user-1",
      nextUserId: null,
      authEvent: "SIGNED_OUT",
    }),
    { shouldReset: true, reason: "signed_out" },
  );

  assert.deepEqual(
    shouldTriggerAuthBoundaryReset({
      previousUserId: "user-1",
      nextUserId: null,
      authEvent: "TOKEN_REFRESHED",
    }),
    { shouldReset: true, reason: "session_expired" },
  );

  assert.deepEqual(
    shouldTriggerAuthBoundaryReset({
      previousUserId: "user-1",
      nextUserId: "user-2",
      authEvent: "SIGNED_IN",
    }),
    { shouldReset: true, reason: "account_switched" },
  );

  assert.deepEqual(
    shouldTriggerAuthBoundaryReset({
      previousUserId: "user-1",
      nextUserId: "user-1",
      authEvent: "TOKEN_REFRESHED",
    }),
    { shouldReset: false, reason: "none" },
  );

  assert.equal(shouldTriggerTenantSwitchReset("org-alpha", "org-beta"), true);
  assert.equal(shouldTriggerTenantSwitchReset("org-alpha", "org-alpha"), false);
  assert.equal(shouldTriggerTenantSwitchReset(null, "org-alpha"), false);
});

test("isStaleAssetOrChunkLoadError identifies deployment skew and chunk failures accurately", () => {
  assert.equal(
    isStaleAssetOrChunkLoadError(new Error("ChunkLoadError: Loading chunk 482 failed.")),
    true,
  );
  assert.equal(
    isStaleAssetOrChunkLoadError("TypeError: Failed to fetch dynamically imported module"),
    true,
  );
  assert.equal(
    isStaleAssetOrChunkLoadError(new Error("Database constraint 23503")),
    false,
  );
});

test("public/sw.js and public/offline.html stay synchronized with pwa-cache-policy invariants", () => {
  const repoRoot = process.cwd();
  const swSource = fs.readFileSync(path.join(repoRoot, "public", "sw.js"), "utf8");
  const offlineHtml = fs.readFileSync(path.join(repoRoot, "public", "offline.html"), "utf8");

  assert.ok(
    swSource.includes(`CACHE_VERSION = "${PWA_CACHE_VERSION}"`),
    "Expected public/sw.js to match PWA_CACHE_VERSION",
  );
  assert.ok(swSource.includes(PWA_OFFLINE_URL), "Expected public/sw.js to reference PWA_OFFLINE_URL");
  assert.ok(swSource.includes(PWA_SHELL_CACHE_NAME.replace(PWA_CACHE_VERSION, "")));
  assert.ok(swSource.includes(PWA_STATIC_CACHE_NAME.replace(PWA_CACHE_VERSION, "")));

  for (const prefix of NEVER_CACHE_PATH_PREFIXES) {
    assert.ok(
      swSource.includes(`"${prefix}"`),
      `Expected public/sw.js to enforce NEVER_CACHE_PATH_PREFIXES entry ${prefix}`,
    );
  }

  assert.ok(swSource.includes("SKIP_WAITING"), "Expected public/sw.js to support SKIP_WAITING");
  assert.ok(
    swSource.includes("AUTH_BOUNDARY_RESET"),
    "Expected public/sw.js to support AUTH_BOUNDARY_RESET cache purge",
  );
  assert.ok(
    swSource.includes('self.addEventListener("push"'),
    "Expected public/sw.js to register a push notification listener",
  );
  assert.ok(
    swSource.includes('self.addEventListener("notificationclick"'),
    "Expected public/sw.js to register a notificationclick listener",
  );

  assert.ok(
    offlineHtml.includes("Zero-Trust Offline Boundary"),
    "Expected public/offline.html to explain the zero-trust offline cache boundary",
  );
  assert.ok(
    offlineHtml.includes("Retry connection"),
    "Expected public/offline.html to provide an interactive retry action",
  );
});

