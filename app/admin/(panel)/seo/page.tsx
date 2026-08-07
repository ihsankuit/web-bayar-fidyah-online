import { SeoEditor } from "@/components/admin/seo-editor";
import { getSeoSettings } from "@/lib/seo";
import { getLandingContent } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const [seo, landing] = await Promise.all([
    getSeoSettings(),
    getLandingContent(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SEO</h1>
        <p className="text-muted-foreground">
          Tetapkan tajuk, penerangan, kata kunci &amp; tajuk utama (H1) laman.
        </p>
      </div>

      <SeoEditor
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        h1={landing.hero_title}
      />
    </div>
  );
}
