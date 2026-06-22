import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXTAUTH_URL ?? "https://alphalead.space";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/onboarding", "/home", "/chat", "/crew", "/me", "/settings", "/insights", "/day", "/night"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
