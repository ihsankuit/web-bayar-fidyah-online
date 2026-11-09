"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  updateAgihanUpdate,
  type AgihanUpdateState,
} from "@/app/admin/(panel)/update-agihan/actions";
import type { AgihanUpdate } from "@/lib/database.types";
import { updateImages, updateStoragePaths } from "@/lib/agihan-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      Simpan Perubahan
    </Button>
  );
}

export function AgihanUpdateEditor({ item }: { item: AgihanUpdate }) {
  const router = useRouter();
  const [state, action] = useActionState<AgihanUpdateState, FormData>(
    updateAgihanUpdate,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Update agihan dikemas kini.");
      router.push("/admin/update-agihan");
      router.refresh();
    } else if (state.error) toast.error(state.error);
  }, [state, router]);

  const urls = updateImages(item);
  const paths = updateStoragePaths(item);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit Update Agihan</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="original_paths" value={paths.join("\n")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Tajuk</Label>
              <Input id="title" name="title" defaultValue={item.title ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="happened_on">Tarikh agihan</Label>
              <Input
                id="happened_on"
                name="happened_on"
                type="date"
                defaultValue={item.happened_on.slice(0, 10)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Tempat</Label>
            <Input
              id="location"
              name="location"
              defaultValue={item.location ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caption">Keterangan</Label>
            <Textarea
              id="caption"
              name="caption"
              rows={5}
              defaultValue={item.caption ?? ""}
            />
          </div>

          {urls.length > 0 && (
            <div className="space-y-2">
              <Label>Gambar sedia ada</Label>
              <p className="text-xs text-muted-foreground">
                Nyahtanda untuk membuang gambar.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {urls.map((url, i) => (
                  <label
                    key={url}
                    className="group relative block cursor-pointer overflow-hidden rounded-lg border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/60 px-2 py-1 text-xs text-white">
                      <input
                        type="checkbox"
                        name="keep_images"
                        value={`${url}\t${paths[i] ?? ""}`}
                        defaultChecked
                        className="h-3.5 w-3.5"
                      />
                      Kekalkan
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="images">Tambah gambar baharu</Label>
            <Input
              id="images"
              type="file"
              name="images"
              accept="image/*"
              multiple
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Jumlah gambar (kekal + baharu) maksimum 4, setiap satu maks 10MB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/admin/update-agihan")}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
