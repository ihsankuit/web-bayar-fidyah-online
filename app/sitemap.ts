import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Dynamically add blog posts
  try {
    const supabase = createClient();
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug,updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (posts) {
      for (const post of posts) {
        staticUrls.push({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Supabase not configured — return static URLs only
  }

  return staticUrls;
}