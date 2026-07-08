import { Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { createClient } from "@/lib/supabase/server";
import type { GalleryItem } from "@/lib/database.types";
import { youtubeThumbnail } from "@/lib/youtube";
import { deleteGalleryItem } from "./actions";

export const dynamic = "force-dynamic";

function thumb(item: GalleryItem): string {
  if (item.type === "video" && item.youtube_id) {
    return item.image_url || youtubeThumbnail(item.youtube_id);
  }
  return item.image_url || "";
}

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
          Urus gambar dan video (YouTube) yang dipaparkan di laman utama.
        </p>
      </div>

      <GalleryManager />

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Kandungan Galeri ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada item galeri. Tambah gambar atau video di atas.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb(item)}
                    alt={item.title ?? ""}
                    className="h-full w-full object-cover"
                  />
                  <Badge
                    variant={item.type === "video" ? "default" : "secondary"}
                    className="absolute left-2 top-2"
                  >
                    {item.type === "video" ? (
                      <>
                        <Play className="mr-1 h-3 w-3 fill-current" /> Video
                      </>
                    ) : (
                      "Gambar"
                    )}
                  </Badge>
                </div>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <p className="truncate text-sm font-medium" title={item.title ?? ""}>
                    {item.title || (
                      <span className="text-muted-foreground">Tanpa tajuk</span>
                    )}
                  </p>
                  <form action={deleteGalleryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="storage_path"
                      value={item.storage_path ?? ""}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
