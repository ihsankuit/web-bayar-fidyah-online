import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationsManager } from "@/components/admin/integrations-manager";
import { TrackingSettingsForm } from "@/components/admin/tracking-settings-form";
import { getIntegrationSettings } from "@/lib/integrations";
import { getTrackingSettings } from "@/lib/tracking/settings";

export const dynamic = "force-dynamic";

export default async function IntegrasiPage() {
  const [settings, tracking] = await Promise.all([
    getIntegrationSettings(),
    getTrackingSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrasi</h1>
        <p className="text-muted-foreground">
          Sambungkan platform dengan automasi seperti n8n melalui webhook &amp;
          REST API.
        </p>
      </div>

      <TrackingSettingsForm
        gaId={tracking.gaId}
        gaApiSecret={tracking.gaApiSecret}
        pixelId={tracking.pixelId}
        capiToken={tracking.capiToken}
        testEventCode={tracking.testEventCode}
        googleAdsId={tracking.googleAdsId}
        googleAdsConversionLabel={tracking.googleAdsConversionLabel}
        gtmId={tracking.gtmId}
      />

      <IntegrationsManager
        webhookUrl={settings.n8n_webhook_url}
        signingSecret={settings.webhook_signing_secret}
        apiKey={settings.api_key}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rujukan REST API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Semua endpoint memerlukan header{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              Authorization: Bearer &lt;API_KEY&gt;
            </code>
          </p>
          <ul className="space-y-2">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                GET /api/v1/donations
              </code>{" "}
              — senarai sumbangan (tapis: status, from, to, limit, offset)
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                GET /api/v1/donations/&#123;reference&#125;
              </code>{" "}
              — satu sumbangan
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">
                GET /api/v1/stats
              </code>{" "}
              — jumlah terkumpul &amp; pecahan
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
