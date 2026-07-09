import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MediaUploader } from "@/components/admin/media-uploader";
import { CopyUrlButton } from "@/components/admin/copy-url-button";
import { createClient } from "@/lib/supabase/server";
import type { MediaAsset } from "@/lib/database.types";
import { deleteMedia } from "./actions";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim().replace(/[%,()]/g, "");
  const supabase = await createClient();

  let query = supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (term) {
    query = query.ilike("filename", `%${term}%`);
  }

  const { data } = await query;
  const assets = (data as MediaAsset[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pustaka Media</h1>
          <p className="text-muted-foreground">
            Muat naik imej untuk digunakan dalam artikel atau laman utama.
          </p>
        </div>
        <form action="/admin/media" method="get" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama fail..."
            className="w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            Cari
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="p-6">
          <MediaUploader />
        </CardContent>
      </Card>

      {assets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {term ? "Tiada media sepadan dengan carian." : "Tiada media dimuat naik lagi."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="relative aspect-[4/3] bg-muted">
                {asset.content_type?.startsWith("image/") ? (
                  <Image
                    src={asset.url}
                    alt={asset.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {asset.filename}
                  </div>
                )}
              </div>
              <CardContent className="space-y-2 p-4">
                <p className="truncate text-sm font-medium" title={asset.filename}>
                  {asset.filename}
                </p>
                <div className="flex items-center gap-2">
                  <CopyUrlButton url={asset.url} />
                  <form action={deleteMedia}>
                    <input type="hidden" name="id" value={asset.id} />
                    <input type="hidden" name="path" value={asset.path} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
