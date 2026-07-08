"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface BlogFormState {
  error?: string;
}

export async function savePost(
  _prev: BlogFormState,
  formData: FormData
): Promise<BlogFormState> {
  const supabase = await requireUser();

  const id = (formData.get("id") as string) || "";
  const title = (formData.get("title") as string)?.trim();
  const rawSlug = (formData.get("slug") as string)?.trim();
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const content = (formData.get("content") as string) ?? "";
  const cover_image = (formData.get("cover_image") as string)?.trim() || null;
  const author = (formData.get("author") as string)?.trim() || null;
  const status = (formData.get("status") as string) === "published"
    ? "published"
    : "draft";

  if (!title) return { error: "Tajuk diperlukan." };

  const slug = slugify(rawSlug || title);
  if (!slug) return { error: "Slug tidak sah." };

  const payload = {
    title,
    slug,
    excerpt,
    content,
    cover_image,
    author,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  if (id) {
    // Preserve original published_at when already published.
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("published_at, status")
      .eq("id", id)
      .maybeSingle();
    if (existing?.status === "published" && status === "published") {
      payload.published_at = existing.published_at;
    }
    const { error } = await supabase
      .from("blog_posts")
      .update(payload)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("blog_posts").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect("/admin/blog");
}

export async function deletePost(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (id) {
    await supabase.from("blog_posts").delete().eq("id", id);
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
  }
}
