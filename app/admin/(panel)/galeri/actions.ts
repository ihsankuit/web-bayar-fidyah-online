"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseYouTubeId } from "@/lib/youtube";
import { slugify } from "@/lib/utils";

const BUCKET = "media";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface GalleryState {
  error?: string;
  ok?: boolean;
}

export async function addGalleryImage(
  _prev: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  const supabase = await requireUser();
  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim() || null;

  if (!file || file.size === 0) return { error: "Sila pilih fail gambar." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "Saiz fail melebihi had 10MB." };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "galeri";
  const path = `galeri/${Date.now()}-${base}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("gallery_items").insert({
    type: "image",
    title,
    image_url: publicUrl,
    storage_path: path,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/galeri");
  revalidatePath("/");
  return { ok: true };
}

export async function addGalleryVideo(
  _prev: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  const supabase = await requireUser();
  const url = ((formData.get("youtube_url") as string) || "").trim();
  const title = ((formData.get("title") as string) || "").trim() || null;

  const youtubeId = parseYouTubeId(url);
  if (!youtubeId)
    return { error: "Pautan YouTube tidak sah. Sila semak semula." };

  const { error } = await supabase.from("gallery_items").insert({
    type: "video",
    title,
    youtube_id: youtubeId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/galeri");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGalleryItem(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  const path = formData.get("storage_path") as string;
  if (!id) return;

  if (path) await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from("gallery_items").delete().eq("id", id);
  revalidatePath("/admin/galeri");
  revalidatePath("/");
}
