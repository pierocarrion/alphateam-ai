import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXTAUTH_URL ?? "https://alphalead.space";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
