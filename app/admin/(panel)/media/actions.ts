"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export interface MediaState {
  error?: string;
  ok?: boolean;
}

export async function uploadMedia(
  _prev: MediaState,
  formData: FormData
): Promise<MediaState> {
  const supabase = await requireUser();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { error: "Sila pilih fail." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "Saiz fail melebihi had 10MB." };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "fail";
  const path = `${Date.now()}-${base}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase.from("media_assets").insert({
    path,
    url: publicUrl,
    filename: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/media");
  return { ok: true };
}

export async function deleteMedia(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  const path = formData.get("path") as string;
  if (!id) return;

  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from("media_assets").delete().eq("id", id);
  revalidatePath("/admin/media");
}
