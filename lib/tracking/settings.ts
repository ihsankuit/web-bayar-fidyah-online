import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Analytics/tracking config, managed from Admin > Integrasi and stored in the
 * admin-only `integration_settings` table. Read server-side via the service
 * role; falls back to environment variables so existing setups keep working.
 *
 * The public ids (gaId, pixelId) are safe to render into the page; the secrets
 * (gaApiSecret, capiToken) are only used in server routes.
 */
export interface TrackingSettings {
  gaId: string;
  gaApiSecret: string;
  pixelId: string;
  capiToken: string;
  testEventCode: string;
  googleAdsId: string;
  googleAdsConversionLabel: string;
  gtmId: string;
}

export async function getTrackingSettings(): Promise<TrackingSettings> {
  const fallback: TrackingSettings = {
    gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
    gaApiSecret: process.env.GA_API_SECRET ?? "",
    pixelId: process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "",
    capiToken: process.env.FB_CAPI_ACCESS_TOKEN ?? "",
    testEventCode: process.env.FB_TEST_EVENT_CODE ?? "",
    googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "",
    googleAdsConversionLabel:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? "",
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
  };

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("integration_settings")
      .select(
        "ga_measurement_id, ga_api_secret, fb_pixel_id, fb_capi_access_token, fb_test_event_code, google_ads_id, google_ads_conversion_label, gtm_id"
      )
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      return {
        gaId: data.ga_measurement_id || fallback.gaId,
        gaApiSecret: data.ga_api_secret || fallback.gaApiSecret,
        pixelId: data.fb_pixel_id || fallback.pixelId,
        capiToken: data.fb_capi_access_token || fallback.capiToken,
        testEventCode: data.fb_test_event_code || fallback.testEventCode,
        googleAdsId: data.google_ads_id || fallback.googleAdsId,
        googleAdsConversionLabel:
          data.google_ads_conversion_label || fallback.googleAdsConversionLabel,
        gtmId: data.gtm_id || fallback.gtmId,
      };
    }
  } catch {
    // service role/table unavailable — use env fallback.
  }
  return fallback;
}
