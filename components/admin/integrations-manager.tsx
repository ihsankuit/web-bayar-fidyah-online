"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import {
  saveIntegrations,
  regenerateApiKey,
  revokeApiKey,
  testWebhook,
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

export function IntegrationsManager({
  webhookUrl,
  signingSecret,
  apiKey,
}: {
  webhookUrl: string;
  signingSecret: string;
  apiKey: string;
}) {
  const [saveState, saveAction] = useActionState<IntegrationState, FormData>(
    saveIntegrations,
    {}
  );
  const [testState, testAction] = useActionState<IntegrationState, FormData>(
    async () => testWebhook(),
    {}
  );
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (saveState.ok) toast.success(saveState.message);
    else if (saveState.error) toast.error(saveState.error);
  }, [saveState]);

  useEffect(() => {
    if (testState.ok) toast.success(testState.message);
    else if (testState.error) toast.error(testState.error);
  }, [testState]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("API key disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Webhook config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Keluar (n8n)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Peristiwa <code>donation.created</code> &amp;{" "}
            <code>donation.paid</code> akan dihantar ke URL ini.
          </p>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8n_webhook_url">URL Webhook n8n</Label>
              <Input
                id="n8n_webhook_url"
                name="n8n_webhook_url"
                defaultValue={webhookUrl}
                placeholder="https://n8n.contoh.com/webhook/xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook_signing_secret">
                Signing Secret (pilihan)
              </Label>
              <Input
                id="webhook_signing_secret"
                name="webhook_signing_secret"
                defaultValue={signingSecret}
                placeholder="Rahsia untuk tandatangan X-Signature (HMAC)"
              />
              <p className="text-xs text-muted-foreground">
                Jika diisi, setiap webhook disertakan header{" "}
                <code>X-Signature: sha256=…</code> untuk pengesahan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SaveButton />
              <form action={testAction}>
                <Button type="submit" variant="outline">
                  <Send className="h-4 w-4" /> Hantar Ujian
                </Button>
              </form>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* API key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">REST API Key</CardTitle>
          <p className="text-sm text-muted-foreground">
            Untuk n8n membaca data. Hantar sebagai{" "}
            <code>Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                type={reveal ? "text" : "password"}
                value={apiKey}
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyKey}
                aria-label="Salin"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada API key — REST API dimatikan. Jana satu untuk
              mengaktifkan.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={regenerateApiKey}>
              <Button type="submit" variant="outline">
                <RefreshCw className="h-4 w-4" />
                {apiKey ? "Jana Semula" : "Jana Kunci"}
              </Button>
            </form>
            {apiKey && (
              <form action={revokeApiKey}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  Batalkan Kunci
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
