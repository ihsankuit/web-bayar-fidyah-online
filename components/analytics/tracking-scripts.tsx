import Script from "next/script";
import { getTrackingSettings } from "@/lib/tracking/settings";

/**
 * Loads Google Analytics (GA4), Google Ads conversion tracking, Google Tag
 * Manager, and the Facebook Pixel base scripts using ids managed from
 * Admin > Integrasi (or the env fallback). Each is only injected when its id
 * is configured, so the site runs fine without any tracking set up. GA4 and
 * Google Ads share the same gtag.js loader — only one <Script src> tag is
 * needed even when both are configured, since gtag supports multiple
 * `config` targets. GTM is independent (it has its own loader and can carry
 * its own GA4/Ads/Pixel tags configured in the GTM UI) — use it instead of,
 * or alongside, the ids above.
 */
export async function TrackingScripts() {
  const { gaId, pixelId, googleAdsId, gtmId } = await getTrackingSettings();

  // When GTM is active, it handles GA4, Google Ads, and FB Pixel via its own
  // tags. Loading gtag.js or fbevents.js separately would corrupt the global
  // gtag/fbq state and silently break GA4 Event (gaawe) tags in GTM.
  // So: if gtmId is set, skip standalone gtag + pixel injection entirely.
  if (gtmId) {
    return (
      <>
        {/*
          lazyOnload: GTM (and everything it pulls in — GA4, Ads, Pixel,
          Clarity) is heavy third-party JS and was the main Total Blocking
          Time contributor. Deferring it to browser idle keeps the main thread
          free during load. No events are lost: the analytics trackers push to
          `window.dataLayer` (initialised as `[]` on their own), so events
          queue and GTM replays them once it loads.
        */}
        <Script id="gtm-init" strategy="lazyOnload">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      </>
    );
  }

  // No GTM — fall back to standalone gtag + FB Pixel.
  const gtagId = gaId || googleAdsId;

  return (
    <>
      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${gaId ? `gtag('config', '${gaId}');` : ""}
              ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ""}
            `}
          </Script>
        </>
      )}

      {pixelId && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
