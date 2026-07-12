import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { UtmCapture } from "@/components/site/utm-capture";
import { TrackingScripts } from "@/components/analytics/tracking-scripts";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bayarfidyahonline.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bayar Fidyah Online — Tunaikan Fidyah Puasa Anda di Malaysia",
    template: "%s | Bayar Fidyah Online",
  },
  description:
    "Bayar fidyah puasa Ramadan secara online di Malaysia. Kiraan automatik, pembayaran selamat FPX & kad, resit ke emel. Bayar dalam 3 minit — kadar RM2.00 sehari.",
  keywords: [
    "fidyah",
    "bayar fidyah",
    "fidyah online",
    "fidyah puasa",
    "kalkulator fidyah",
    "fidyah Malaysia",
    "cara bayar fidyah",
    "kadar fidyah Malaysia",
    "hukum fidyah puasa",
    "qada fidyah",
  ],
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
  },
  openGraph: {
    title: "Bayar Fidyah Online — Tunaikan Fidyah Puasa Anda di Malaysia",
    description:
      "Bayar fidyah puasa Ramadan secara online di Malaysia. Kiraan automatik, pembayaran selamat FPX & kad, resit ke emel. Bayar dalam 3 minit.",
    type: "website",
    locale: "ms_MY",
    url: siteUrl,
    siteName: "Bayar Fidyah Online",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bayar Fidyah Online — Tunaikan Fidyah Puasa Anda di Malaysia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bayar Fidyah Online — Tunaikan Fidyah Puasa Anda di Malaysia",
    description:
      "Bayar fidyah puasa Ramadan secara online di Malaysia. Kiraan automatik, pembayaran selamat FPX & kad, resit ke emel.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://gate.chip-in.asia" />
        <link rel="dns-prefetch" href="https://gate.chip-in.asia" />
      </head>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <TrackingScripts />
        <UtmCapture />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}