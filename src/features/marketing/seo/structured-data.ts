import {
  absoluteUrl,
  siteDescription,
  siteName,
  siteUrl,
} from "@/shared/lib/site";

/**
 * Single source of truth for pricing displayed on the landing.
 * Used by the UI and by structured data so they can never drift apart.
 */
export const pricing = {
  free: { price: "0", currency: "USD" },
  team: { price: "20", currency: "USD", unitText: "per user / month" },
} as const;

/**
 * Structured data (schema.org JSON-LD) for the landing page.
 *
 * Returning a single `Graph` keeps things clean: one <script> tag on the
 * page covers Organization, WebSite, SoftwareApplication and FAQPage.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/search-gallery
 */
export function landingStructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      description: siteDescription,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: siteName,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      inLanguage: "en",
      url: absoluteUrl("/"),
      description: siteDescription,
      offers: [
        {
          "@type": "Offer",
          price: pricing.free.price,
          priceCurrency: pricing.free.currency,
          name: "Free",
        },
        {
          "@type": "Offer",
          price: pricing.team.price,
          priceCurrency: pricing.team.currency,
          name: "Team",
          description: pricing.team.unitText,
        },
      ],
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name:
            "How does Mira detect procrastination in team chat?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Mira listens to your team chat (e.g. Slack), spots vague or stalled tasks, and converts them into a tiny, concrete 2-minute first step so starting feels effortless.",
          },
        },
        {
          "@type": "Question",
          name: "Is my team's chat data private?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Mira only surfaces personal next steps to each individual and aggregate load signals to leaders. There is no public shaming, and no raw messages are exposed in dashboards.",
          },
        },
        {
          "@type": "Question",
          name: "What does the leader dashboard show?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Leaders get a private view of team load, deadlines at risk and burnout signals, plus suggested actions when a task stalls — never individual blame.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a free plan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Yes. The Free plan includes 1 workspace, up to 5 users, basic chat detection and 3 rituals per week. The Team plan is $${pricing.team.price} per user / month.`,
          },
        },
      ],
    },
  ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
