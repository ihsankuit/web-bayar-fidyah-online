import { MfaSetup } from "@/components/admin/mfa-setup";

export default function KeselamatanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Keselamatan</h1>
        <p className="text-muted-foreground">
          Urus pengesahan dua langkah (2FA) untuk akaun pentadbir ini.
        </p>
      </div>

      <MfaSetup />
    </div>
  );
}
