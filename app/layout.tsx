import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bayarfidyah.online";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bayar Fidyah Online — Tunaikan Fidyah Anda dengan Mudah",
    template: "%s | Bayar Fidyah Online",
  },
  description:
    "Selesaikan tanggungan fidyah puasa anda dalam beberapa minit. Kiraan automatik, pembayaran selamat melalui FPX & kad, resit terus ke emel.",
  keywords: [
    "fidyah",
    "bayar fidyah",
    "fidyah online",
    "fidyah puasa",
    "kalkulator fidyah",
  ],
  openGraph: {
    title: "Bayar Fidyah Online",
    description:
      "Tunaikan fidyah puasa anda dengan mudah dan selamat secara dalam talian.",
    type: "website",
    locale: "ms_MY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
