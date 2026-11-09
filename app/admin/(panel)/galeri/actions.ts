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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per fail

export interface GalleryState {
  error?: string;
  ok?: boolean;
  /** How many files were stored successfully in a bulk upload. */
  uploaded?: number;
  /** How many files were skipped/failed, with a short reason each. */
  failures?: string[];
}

type SupabaseServer = Awaited<ReturnType<typeof requireUser>>;

/**
 * Upload one image file to storage and insert its gallery row. Returns an
 * error string on failure, or null on success. Shared by the bulk handler so
 * one bad file never aborts the whole batch.
 */
async function uploadOneImage(
  supabase: SupabaseServer,
  file: File,
  title: string | null
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return "bukan fail imej";
  if (file.size > MAX_IMAGE_BYTES) return "melebihi 10MB";

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "galeri";
  // A random suffix keeps two files uploaded in the same millisecond apart.
  const path = `galeri/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${base}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) return uploadError.message;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("gallery_items").insert({
    type: "image",
    title,
    image_url: publicUrl,
    storage_path: path,
  });
  if (error) return error.message;
  return null;
}

/**
 * Bulk image upload — accepts one or many files from a single <input multiple>.
 * Each file is uploaded independently; a failure on one is reported but does
 * not stop the rest. The optional title applies to every file in the batch.
 */
export async function addGalleryImages(
  _prev: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  const supabase = await requireUser();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const title = ((formData.get("title") as string) || "").trim() || null;

  if (files.length === 0) return { error: "Sila pilih sekurang-kurangnya satu fail gambar." };

  let uploaded = 0;
  const failures: string[] = [];
  for (const file of files) {
    const err = await uploadOneImage(supabase, file, title);
    if (err) failures.push(`${file.name}: ${err}`);
    else uploaded += 1;
  }

  if (uploaded > 0) {
    revalidatePath("/admin/galeri");
    revalidatePath("/");
  }

  if (uploaded === 0) {
    return { error: `Tiada gambar dimuat naik. ${failures.join("; ")}` };
  }
  return { ok: true, uploaded, failures: failures.length ? failures : undefined };
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
