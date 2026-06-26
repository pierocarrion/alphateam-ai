import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          // Setup y onboarding
          "/onboarding",
          "/setup",
          "/setup/",
          // Rutas internas de la app (grupo (app), URLs en raíz)
          "/home",
          "/chat",
          "/crew",
          "/me",
          "/settings",
          "/insights",
          "/team-insights",
          "/day",
          "/night",
          "/tasks",
          "/task",
          "/progress",
          "/projects",
          "/project",
          "/ritual",
          "/capture",
          "/requests",
          "/members",
          "/knowledge",
          "/backstage",
          "/feedback-intelligence",
          "/alpha-space",
          "/profile",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
