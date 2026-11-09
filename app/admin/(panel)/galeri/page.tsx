import { GalleryManager } from "@/components/admin/gallery-manager";
import { GalleryList } from "@/components/admin/gallery-list";
import { createClient } from "@/lib/supabase/server";
import type { GalleryItem } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gallery_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const items = (data as GalleryItem[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Galeri</h1>
        <p className="text-muted-foreground">
          Urus gambar dan video (YouTube) yang dipaparkan di laman utama. Muat
          naik beberapa gambar sekaligus, dan klik mana-mana item untuk
          pratonton.
        </p>
      </div>

      <GalleryManager />

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Kandungan Galeri ({items.length})
        </h2>
        <GalleryList items={items} />
      </div>
    </div>
  );
}
