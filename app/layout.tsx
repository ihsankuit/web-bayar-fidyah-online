import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getSeoSettings } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.title,
      template: "%s | Bayar Fidyah Online",
    },
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: "Bayar Fidyah Online" }],
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
    alternates: {
      canonical: "/",
      // Single-language site: ms-MY is the only version, and x-default points
      // at it so Google has no ambiguity about what to serve elsewhere.
      languages: {
        "ms-MY": "/",
        "x-default": "/",
      },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      locale: "ms_MY",
      url: SITE_URL,
      siteName: "Bayar Fidyah Online",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        {/* Warm up the tracking/analytics origins (loaded via GTM) so they
            don't pay full connection setup on the critical path. */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://www.clarity.ms" />
        <link rel="dns-prefetch" href="https://region1.google-analytics.com" />
      </head>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}