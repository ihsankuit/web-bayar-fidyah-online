import { Suspense } from "react";
import { UtmCapture } from "@/components/site/utm-capture";
import { TrackingScripts } from "@/components/analytics/tracking-scripts";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ScrollTracker } from "@/components/analytics/scroll-tracker";
import { FloatingWhatsApp } from "@/components/site/floating-whatsapp";
import { getLandingContent } from "@/lib/settings";

/**
 * Wraps only the public site (not /admin, which lives outside this route
 * group) so marketing/analytics tags never render for admin/staff traffic.
 * Kept out of the root layout so admin pages don't need a headers()/cookies()
 * call there, which would force the whole app out of static/ISR rendering.
 */
export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { whatsapp_number } = await getLandingContent();

  return (
    <>
      <TrackingScripts />
      <UtmCapture />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <ScrollTracker />
      {children}
      <FloatingWhatsApp phone={whatsapp_number} />
    </>
  );
}
