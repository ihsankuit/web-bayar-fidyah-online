"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VerifiedFactor {
  id: string;
  friendly_name?: string | null;
  created_at: string;
}

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function MfaSetup() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState<VerifiedFactor | null>(null);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      setLoading(false);
      return;
    }
    const factor = data.totp.find((f) => f.status === "verified") ?? null;
    setVerified(factor);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, []);

  async function startEnroll() {
    setBusy(true);
    try {
      const supabase = createClient();

      // Clear out any stale unverified factor from an abandoned attempt so
      // enrolling always yields a fresh QR code.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error || !data) throw error ?? new Error("Enrol gagal.");

      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memulakan pendaftaran 2FA."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollData) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast.success("2FA berjaya diaktifkan.");
      setEnrollData(null);
      setCode("");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kod tidak sah. Cuba lagi."
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enrollData) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    } finally {
      setEnrollData(null);
      setCode("");
      setBusy(false);
    }
  }

  async function disable() {
    if (!verified) return;
    if (!confirm("Nyahaktifkan pengesahan dua langkah untuk akaun ini?")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: verified.id,
      });
      if (error) throw error;
      toast.success("2FA dinyahaktifkan.");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyahaktifkan 2FA."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (verified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            2FA Aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Log masuk anda dilindungi dengan kod dari aplikasi authenticator.
          </p>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={disable}
            disabled={busy}
          >
            <ShieldOff /> Nyahaktifkan 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (enrollData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Imbas Kod QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Imbas kod di bawah menggunakan aplikasi authenticator (contoh:
            Google Authenticator, Authy), atau masukkan kod rahsia secara
            manual.
          </p>
          <div className="flex justify-center rounded-lg border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollData.qrCode}
              alt="Kod QR pendaftaran 2FA"
              className="h-48 w-48"
            />
          </div>
          <div className="space-y-1">
            <Label>Kod rahsia (jika tidak dapat imbas)</Label>
            <Input readOnly value={enrollData.secret} className="font-mono text-xs" />
          </div>
          <form onSubmit={verifyEnroll} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Kod 6-digit dari authenticator</Label>
              <Input
                id="mfa-code"
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
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.length < 6}>
                {busy && <Loader2 className="animate-spin" />}
                Sahkan & Aktifkan
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={cancelEnroll}
                disabled={busy}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengesahan Dua Langkah (2FA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tambah lapisan keselamatan tambahan — selepas kata laluan, anda
          perlu masukkan kod dari aplikasi authenticator untuk log masuk.
        </p>
        <Button onClick={startEnroll} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Aktifkan 2FA
        </Button>
      </CardContent>
    </Card>
  );
}
