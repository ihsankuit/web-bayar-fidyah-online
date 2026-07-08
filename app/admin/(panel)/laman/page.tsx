import { LandingEditor } from "@/components/admin/landing-editor";
import { getLandingContent } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LamanPage() {
  const content = await getLandingContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laman Utama</h1>
        <p className="text-muted-foreground">
          Edit kandungan yang dipaparkan pada laman utama.
        </p>
      </div>
      <LandingEditor content={content} />
    </div>
  );
}
