"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  saveMurpati,
  type IntegrationState,
} from "@/app/admin/(panel)/integrasi/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [state, action] = useActionState<IntegrationState, FormData>(
    saveMurpati,
    {}
  );

  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp (Murpati)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Digunakan oleh halaman <span className="font-medium">Agihan Fidyah</span> untuk
          hantar makluman kemaskini agihan kepada pembayar. Dapatkan API Key
          di murpati.com/settings dan Session ID di murpati.com/devices
          (peranti WhatsApp mesti berstatus &quot;connected&quot;). Perlukan
          langganan Murpati Pro atau Max.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="murpati_api_key">Murpati API Key</Label>
              <Input
                id="murpati_api_key"
                name="murpati_api_key"
                type="password"
                defaultValue={apiKey}
                placeholder="sk_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="murpati_session_id">Murpati Session ID</Label>
              <Input
                id="murpati_session_id"
                name="murpati_session_id"
                defaultValue={sessionId}
                placeholder="sess_..."
              />
            </div>
          </div>
          <SaveButton />
        </form>
      </CardContent>
    </Card>
  );
}
