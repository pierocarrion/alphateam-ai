import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlphaTeam AI",
    short_name: "AlphaTeam",
    description:
      "A gentle, anti-guilt productivity companion for teams. Mira detects procrastination in team chat and shrinks tasks into 2-minute starts.",
    start_url: "/",
    display: "standalone",
    background_color: "#15131A",
    theme_color: "#15131A",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
