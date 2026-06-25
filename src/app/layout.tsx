import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/messages";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const siteUrl =
  process.env.NEXTAUTH_URL ?? "https://alphalead.space";
const title = "AlphaLead AI";
const description =
  "A gentle, anti-guilt productivity companion for teams. Mira detects procrastination in team chat, shrinks tasks into 2-minute starts, and gives leaders private insights — without shame.";
const keywords = [
  "productivity",
  "team productivity",
  "anti-procrastination",
  "AI teammate",
  "team chat AI",
  "task detection",
  "focus app",
  "burnout prevention",
  "crew management",
  "AlphaLead AI",
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${title} — Stop team procrastination before it spreads`,
    template: `%s · ${title}`,
  },
  description,
  applicationName: title,
  keywords,
  authors: [{ name: "AlphaLead AI" }],
  creator: "AlphaLead AI",
  publisher: "AlphaLead AI",
  category: "Productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: title,
    title: `${title} — Stop team procrastination before it spreads`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} — Stop team procrastination before it spreads`,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15131A" },
    { media: "(prefers-color-scheme: dark)", color: "#15131A" },
  ],
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const lang = isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;

  return (
    <html
      lang={lang}
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" toastOptions={{ style: { background: "#221f2a", color: "#f3ece1", border: "1px solid rgba(255,236,214,0.14)" } }} />
      </body>
    </html>
  );
}
