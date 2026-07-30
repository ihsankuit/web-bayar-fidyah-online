"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2, Wifi } from "lucide-react";
import { toast } from "sonner";

import {
  saveMurpati,
  testMurpatiConnection,
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

export function MurpatiSettingsForm({
  apiKey,
  sessionId,
}: {
  apiKey: string;
  sessionId: string;
}) {
  const [saveState, saveAction] = useActionState<IntegrationState, FormData>(
    saveMurpati,
    {}
  );
  const [testState, testAction] = useActionState<IntegrationState, FormData>(
    async () => testMurpatiConnection(),
    {}
  );
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (saveState.ok) toast.success(saveState.message);
    else if (saveState.error) toast.error(saveState.error);
  }, [saveState]);

  useEffect(() => {
    if (testState.ok) toast.success(testState.message);
    else if (testState.error) toast.error(testState.error);
  }, [testState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp Blast (Murpati)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Untuk hantar kemas kini (contoh: status agihan fidyah) kepada
          pembayar melalui WhatsApp dari halaman{" "}
          <a href="/admin/whatsapp" className="underline">
            WhatsApp
          </a>
          . Dapatkan API key di{" "}
          <a
            href="https://murpati.com/settings"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            murpati.com/settings
          </a>{" "}
          (tab API Keys) dan Session ID di{" "}
          <a
            href="https://murpati.com/devices"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            murpati.com/devices
          </a>
          . Memerlukan langganan Murpati Pro/Max.
        </p>
      </CardHeader>
      <CardContent>
        <form action={saveAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="murpati_api_key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="murpati_api_key"
                name="murpati_api_key"
                type={reveal ? "text" : "password"}
                defaultValue={apiKey}
                placeholder="sk_..."
                className="max-w-md font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setReveal((v) => !v)}
                aria-label="Papar/sembunyi"
              >
                {reveal ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="murpati_session_id">Session ID Peranti</Label>
            <Input
              id="murpati_session_id"
              name="murpati_session_id"
              defaultValue={sessionId}
              placeholder="sess_..."
              className="max-w-md font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SaveButton />
            <form action={testAction}>
              <Button type="submit" variant="outline">
                <Wifi className="h-4 w-4" /> Uji Sambungan
              </Button>
            </form>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
