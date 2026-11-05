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

export interface AgihanUpdateState {
  error?: string;
  ok?: boolean;
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

  const imageUrls: string[] = [];
  const storagePaths: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/"))
      return { error: `Fail "${file.name}" bukan imej.` };
    if (file.size > MAX_IMAGE_BYTES)
      return { error: `Imej "${file.name}" melebihi had 10MB.` };

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
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    imageUrls.push(publicUrl);
    storagePaths.push(path);
  }

  const { error } = await supabase.from("agihan_updates").insert({
    title,
    location,
    caption,
    image_urls: imageUrls,
    storage_paths: storagePaths,
    happened_on: happenedOn,
  });
  if (error) return { error: error.message };

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
