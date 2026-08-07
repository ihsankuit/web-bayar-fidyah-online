"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";

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
  const seo_title = (formData.get("seo_title") as string)?.trim() || null;
  const seo_description =
    (formData.get("seo_description") as string)?.trim() || null;
  const seo_keywords =
    (formData.get("seo_keywords") as string)?.trim() || null;
  const status = (formData.get("status") as string) === "published"
    ? "published"
    : "draft";
  const publishedAtInput = (formData.get("published_at") as string)?.trim();

  if (!title) return { error: "Tajuk diperlukan." };

  const slug = slugify(rawSlug || title);
  if (!slug) return { error: "Slug tidak sah." };

  // A datetime-local value in the future schedules the post — it only
  // becomes publicly visible once its published_at passes (see the public
  // blog queries, which filter on published_at <= now()).
  let publishedAt: string | null = null;
  if (status === "published") {
    if (publishedAtInput) {
      const parsed = new Date(publishedAtInput);
      publishedAt = Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }
  }

  const payload = {
    title,
    slug,
    excerpt,
    content,
    cover_image,
    author,
    seo_title,
    seo_description,
    seo_keywords,
    status,
    published_at: publishedAt,
  };

  if (id) {
    // Keep the original published_at when re-saving an already-published
    // post without explicitly changing the date.
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("published_at, status")
      .eq("id", id)
      .maybeSingle();
    if (
      status === "published" &&
      !publishedAtInput &&
      existing?.status === "published" &&
      existing.published_at
    ) {
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

  await logActivity(status === "published" ? "blog.publish" : "blog.save_draft", {
    slug,
    title,
    published_at: payload.published_at,
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect("/admin/blog");
}

export async function deletePost(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (id) {
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("slug, title")
      .eq("id", id)
      .maybeSingle();
    await supabase.from("blog_posts").delete().eq("id", id);
    await logActivity("blog.delete", existing ?? { id });
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
  }
}
