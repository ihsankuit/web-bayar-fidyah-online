import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
    "Bayar fidyah puasa Ramadan secara online di semua negeri di Malaysia — Selangor, Kedah, Johor, Pahang, Perak & lain-lain. Kiraan automatik, pembayaran selamat FPX, kad & QR, resit ke emel. Bayar dalam 3 minit — kadar RM2.00 sehari.",
  keywords: [
    "fidyah",
    "bayar fidyah",
    "bayar fidyah online",
    "fidyah online",
    "fidyah puasa",
    "bayaran fidyah",
    "kalkulator fidyah",
    "kalkulator fidyah online",
    "fidyah Malaysia",
    "cara bayar fidyah",
    "cara bayar fidyah online",
    "kadar fidyah Malaysia",
    "kadar fidyah 2026",
    "hukum fidyah puasa",
    "qada fidyah",
    "fidyah selangor",
    "fidyah kedah",
    "fidyah johor",
    "fidyah pahang",
    "fidyah perak",
    "fidyah orang meninggal",
    "cupak beras fidyah",
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
      "Bayar fidyah puasa Ramadan secara online — semua negeri di Malaysia. Kiraan automatik, pembayaran selamat FPX, kad & QR, resit ke emel. Bayar dalam 3 minit.",
    type: "website",
    locale: "ms_MY",
    url: siteUrl,
    siteName: "Bayar Fidyah Online",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bayar Fidyah Online — Tunaikan Fidyah Puasa Anda di Malaysia",
    description:
      "Bayar fidyah puasa Ramadan secara online — semua negeri di Malaysia. Kiraan automatik, pembayaran selamat FPX, kad & QR, resit ke emel.",
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
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}