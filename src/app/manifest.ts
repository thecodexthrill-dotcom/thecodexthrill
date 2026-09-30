import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TheCodexThrill",
    short_name: "CodexThrill",
    description: "Build. Innovate. Deploy. Scale.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#11110f",
    theme_color: "#11110f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
