"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const BUCKET = "media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 4;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

type SupabaseServer = Awaited<ReturnType<typeof requireUser>>;

export interface AgihanUpdateState {
  error?: string;
  ok?: boolean;
}

/** Upload image files to storage; returns their public URLs + paths, or an error. */
async function uploadImages(
  supabase: SupabaseServer,
  files: File[]
): Promise<{ urls: string[]; paths: string[]; error?: string }> {
  const urls: string[] = [];
  const paths: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/"))
      return { urls, paths, error: `Fail "${file.name}" bukan imej.` };
    if (file.size > MAX_IMAGE_BYTES)
      return { urls, paths, error: `Imej "${file.name}" melebihi had 10MB.` };

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "agihan";
    const path = `agihan/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${base}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) return { urls, paths, error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(publicUrl);
    paths.push(path);
  }
  return { urls, paths };
}

/** Add a distribution-update timeline entry (up to 4 photos + date + place + caption). */
export async function addAgihanUpdate(
  _prev: AgihanUpdateState,
  formData: FormData
): Promise<AgihanUpdateState> {
  const supabase = await requireUser();

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const title = ((formData.get("title") as string) || "").trim() || null;
  const location = ((formData.get("location") as string) || "").trim() || null;
  const caption = ((formData.get("caption") as string) || "").trim() || null;
  const happenedOn = ((formData.get("happened_on") as string) || "").trim();

  if (!happenedOn) return { error: "Sila pilih tarikh agihan." };
  if (!title && !caption) {
    return { error: "Sila isi sekurang-kurangnya tajuk atau keterangan." };
  }
  if (files.length > MAX_IMAGES) {
    return { error: `Maksimum ${MAX_IMAGES} gambar bagi setiap agihan.` };
  }

  const uploaded = await uploadImages(supabase, files);
  if (uploaded.error) return { error: uploaded.error };

  const { error } = await supabase.from("agihan_updates").insert({
    title,
    location,
    caption,
    image_urls: uploaded.urls,
    storage_paths: uploaded.paths,
    happened_on: happenedOn,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/update-agihan");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Edit an existing distribution-update entry. Keeps the images whose
 * `keep_images` entry is still present, deletes the rest from storage, and
 * appends any newly uploaded files (total capped at 4).
 */
export async function updateAgihanUpdate(
  _prev: AgihanUpdateState,
  formData: FormData
): Promise<AgihanUpdateState> {
  const supabase = await requireUser();

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return { error: "Rekod tidak sah." };

  const title = ((formData.get("title") as string) || "").trim() || null;
  const location = ((formData.get("location") as string) || "").trim() || null;
  const caption = ((formData.get("caption") as string) || "").trim() || null;
  const happenedOn = ((formData.get("happened_on") as string) || "").trim();

  if (!happenedOn) return { error: "Sila pilih tarikh agihan." };
  if (!title && !caption) {
    return { error: "Sila isi sekurang-kurangnya tajuk atau keterangan." };
  }

  // Existing images the admin chose to keep (value is "url\tpath").
  const keptUrls: string[] = [];
  const keptPaths: string[] = [];
  for (const raw of formData.getAll("keep_images").map(String)) {
    const [url, path] = raw.split("\t");
    if (!url) continue;
    keptUrls.push(url);
    if (path) keptPaths.push(path);
  }

  const originalPaths = ((formData.get("original_paths") as string) || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const removedPaths = originalPaths.filter((p) => !keptPaths.includes(p));

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (keptUrls.length + files.length > MAX_IMAGES) {
    return {
      error: `Maksimum ${MAX_IMAGES} gambar — buang beberapa gambar sedia ada dahulu.`,
    };
  }

  const uploaded = await uploadImages(supabase, files);
  if (uploaded.error) return { error: uploaded.error };

  const { error } = await supabase
    .from("agihan_updates")
    .update({
      title,
      location,
      caption,
      happened_on: happenedOn,
      image_urls: [...keptUrls, ...uploaded.urls],
      storage_paths: [...keptPaths, ...uploaded.paths],
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Clean up the images that were removed (after the row is safely updated).
  if (removedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(removedPaths);
  }

  revalidatePath("/admin/update-agihan");
  revalidatePath("/");
  return { ok: true };
}

/** Delete a distribution-update entry and all its uploaded images. */
export async function deleteAgihanUpdate(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  // Paths are passed newline-joined (storage keys never contain newlines).
  const paths = ((formData.get("storage_paths") as string) || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);

  await supabase.from("agihan_updates").delete().eq("id", id);
  revalidatePath("/admin/update-agihan");
  revalidatePath("/");
}
