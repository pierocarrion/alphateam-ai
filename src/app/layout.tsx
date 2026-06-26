import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import {
  siteDescription,
  siteKeywords,
  siteLocale,
  siteName,
  siteUrl,
} from "@/shared/lib/site";

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

const title = siteName;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${title} — Stop team procrastination before it spreads`,
    template: `%s · ${title}`,
  },
  description: siteDescription,
  applicationName: title,
  keywords: siteKeywords,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "Productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: siteLocale,
    url: siteUrl,
    siteName: title,
    title: `${title} — Stop team procrastination before it spreads`,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} — Stop team procrastination before it spreads`,
    description: siteDescription,
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
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" toastOptions={{ style: { background: "#221f2a", color: "#f3ece1", border: "1px solid rgba(255,236,214,0.14)" } }} />
      </body>
    </html>
  );
}
