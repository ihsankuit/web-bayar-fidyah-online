import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgihanUpdateManager } from "@/components/admin/agihan-update-manager";
import { createClient } from "@/lib/supabase/server";
import type { AgihanUpdate } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/utils";
import { deleteAgihanUpdate } from "./actions";

export const dynamic = "force-dynamic";

export default async function UpdateAgihanPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agihan_updates")
    .select("*")
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false });
  const items = (data as AgihanUpdate[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Update Agihan</h1>
        <p className="text-muted-foreground">
          Kemas kini aktiviti agihan yang dipaparkan sebagai timeline di laman
          utama.
        </p>
      </div>

      <AgihanUpdateManager />

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Senarai Update ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada update. Tambah update agihan di atas.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                {item.image_url && (
                  <div className="relative aspect-video bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={item.title ?? ""}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs font-medium text-primary">
                    {formatDateOnly(item.happened_on)}
                  </p>
                  <p className="font-medium">
                    {item.title || (
                      <span className="text-muted-foreground">Tanpa tajuk</span>
                    )}
                  </p>
                  {item.location && (
                    <p className="text-xs text-muted-foreground">
                      {item.location}
                    </p>
                  )}
                  {item.caption && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {item.caption}
                    </p>
                  )}
                  <form action={deleteAgihanUpdate} className="pt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="storage_path"
                      value={item.storage_path ?? ""}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Padam
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
