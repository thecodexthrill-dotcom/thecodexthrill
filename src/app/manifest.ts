import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TheCodexThrill",
    short_name: "CodexThrill",
    description:
      "Build. Innovate. Deploy. Scale. Custom software engineering, AI solutions, and client delivery portal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#080909",
    theme_color: "#080909",
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    categories: ["business", "productivity", "developer tools"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Capabilities & Services",
        short_name: "Services",
        description: "Explore web, mobile, cloud, and AI engineering capabilities.",
        url: "/services",
      },
      {
        name: "Selected Work",
        short_name: "Portfolio",
        description: "Review case studies and production software systems.",
        url: "/portfolio",
      },
      {
        name: "Start a Project",
        short_name: "Contact",
        description: "Submit an engineering or product inquiry.",
        url: "/contact",
      },
      {
        name: "Client & Staff Workspace",
        short_name: "Workspace",
        description: "Sign in to the authenticated portal or admin workspace.",
        url: "/login",
      },
    ],
  };
}
