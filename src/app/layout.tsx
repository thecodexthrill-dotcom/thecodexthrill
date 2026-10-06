import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistration } from "@/components/site/service-worker";
import { SiteFrame } from "@/components/site/site-frame";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WorkspaceDemoProvider } from "@/components/platform/workspace-demo";
import { SITE_ORIGIN } from "@/lib/site-origin";

import "./globals.css";

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "TheCodexThrill",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/icon.svg`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: "TheCodexThrill",
    url: SITE_ORIGIN,
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "TheCodexThrill | Build. Innovate. Deploy. Scale.",
    template: "%s | TheCodexThrill",
  },
  description:
    "We design and build thoughtful software, web applications, mobile products, and AI solutions for ambitious teams.",
  applicationName: "TheCodexThrill",
  openGraph: {
    type: "website",
    siteName: "TheCodexThrill",
    title: "TheCodexThrill | Build. Innovate. Deploy. Scale.",
    description:
      "A software engineering company building digital products for what comes next.",
    url: SITE_ORIGIN,
  },
  twitter: {
    card: "summary",
    title: "TheCodexThrill | Build. Innovate. Deploy. Scale.",
    description:
      "A software engineering company building digital products for what comes next.",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TheCodexThrill",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#11110f" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <head>
        {structuredData.map((entry) => (
          <script
            key={entry["@type"]}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(entry).replace(/</g, "\\u003c"),
            }}
          />
        ))}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <WorkspaceDemoProvider>
            <SiteFrame>{children}</SiteFrame>
          </WorkspaceDemoProvider>
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}