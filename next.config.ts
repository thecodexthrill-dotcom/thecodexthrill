import type { NextConfig } from "next";

const noStoreProtectedHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.thecodexthrill.com" }],
        destination: "https://thecodexthrill.com/:path*",
        permanent: true,
      },
    ];
  },
  allowedDevOrigins: ["127.0.0.1"],
  logging: { incomingRequests: { ignore: [/\/auth\/callback/] } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/portal/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/account/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/mfa",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/auth/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/invite/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/bootstrap/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/api/:path*",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/login",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/forgot-password",
        headers: noStoreProtectedHeaders,
      },
      {
        source: "/reset-password",
        headers: noStoreProtectedHeaders,
      },
    ];
  },
};

export default nextConfig;
