"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  saveTracking,
  type IntegrationState,
} from "@/app/admin/(panel)/integrasi/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan
    </Button>
  );
}

export function TrackingSettingsForm({
  gaId,
  gaApiSecret,
  pixelId,
  capiToken,
  testEventCode,
}: {
  gaId: string;
  gaApiSecret: string;
  pixelId: string;
  capiToken: string;
  testEventCode: string;
}) {
  const [state, action] = useActionState<IntegrationState, FormData>(
    saveTracking,
    {}
  );

  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analitik & Pixel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Google Analytics &amp; Facebook Pixel dimuatkan automatik apabila id
          diisi. Peristiwa <code>Purchase</code> dicetuskan bila bayaran berjaya.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ga_measurement_id">Google Analytics ID</Label>
              <Input
                id="ga_measurement_id"
                name="ga_measurement_id"
                defaultValue={gaId}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga_api_secret">
                GA Measurement Protocol Secret
              </Label>
              <Input
                id="ga_api_secret"
                name="ga_api_secret"
                type="password"
                defaultValue={gaApiSecret}
                placeholder="Untuk peristiwa server-side (pilihan)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb_pixel_id">Facebook Pixel ID</Label>
              <Input
                id="fb_pixel_id"
                name="fb_pixel_id"
                defaultValue={pixelId}
                placeholder="123456789012345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb_capi_access_token">
                Facebook CAPI Access Token
              </Label>
              <Input
                id="fb_capi_access_token"
                name="fb_capi_access_token"
                type="password"
                defaultValue={capiToken}
                placeholder="Untuk Conversions API (pilihan)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb_test_event_code">
                FB Test Event Code (pilihan)
              </Label>
              <Input
                id="fb_test_event_code"
                name="fb_test_event_code"
                defaultValue={testEventCode}
                placeholder="TEST12345"
              />
            </div>
          </div>
          <SaveButton />
        </form>
      </CardContent>
    </Card>
  );
}
