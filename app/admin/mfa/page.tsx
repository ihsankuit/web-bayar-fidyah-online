"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/logo";

/** Only allow same-origin relative paths as a post-challenge redirect target. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/admin";
}

function MfaForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        setChecking(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        // Nothing to challenge — let the panel layout decide where to go.
        router.replace(safeNext(search.get("next")));
        return;
      }
      setFactorId(verified.id);
      setChecking(false);
    })();
  }, [router, search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast.success("Pengesahan berjaya.");
      router.replace(safeNext(search.get("next")));
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kod tidak sah. Cuba lagi."
      );
      setCode("");
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (checking) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Logo className="mb-3 h-10" />
        <CardTitle>Pengesahan Dua Langkah</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Kod dari aplikasi authenticator</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="123456"
              maxLength={6}
              required
              autoFocus
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || code.length < 6}
          >
            {loading && <Loader2 className="animate-spin" />}
            Sahkan
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={signOut}
          >
            Log keluar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminMfaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Suspense>
        <MfaForm />
      </Suspense>
    </div>
  );
}
