import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized, serializeBlogPost } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import type { BlogPost, PostStatus } from "@/lib/database.types";

/**
 * GET /api/v1/blog
 * List blog posts (any status — this is the authenticated write API, not
 * the public blog reader). Query: status, limit (<=200), offset. Auth: API key.
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-blog-list:${clientIp(request)}`, 120, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    200
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("blog_posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "draft" || status === "published") {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: ((data as BlogPost[]) ?? []).map(serializeBlogPost),
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api/v1/blog GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/blog
 * Create a blog post. Body: title (required), slug, excerpt, content,
 * cover_image, author, status ("draft"|"published"), published_at.
 * Auth: API key.
 */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-blog-write:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: '"title" is required' }, { status: 400 });
  }

  const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugify(rawSlug || title);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not derive a valid slug from title/slug" },
      { status: 400 }
    );
  }

  const status: PostStatus = body.status === "published" ? "published" : "draft";
  const content = typeof body.content === "string" ? body.content : "";
  const excerpt =
    typeof body.excerpt === "string" ? body.excerpt.trim() || null : null;
  const cover_image =
    typeof body.cover_image === "string" ? body.cover_image.trim() || null : null;
  const author =
    typeof body.author === "string" ? body.author.trim() || null : null;

  let published_at: string | null = null;
  if (status === "published") {
    if (typeof body.published_at === "string" && body.published_at.trim()) {
      const parsed = new Date(body.published_at);
      published_at = Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
    } else {
      published_at = new Date().toISOString();
    }
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title,
        slug,
        excerpt,
        content,
        cover_image,
        author,
        status,
        published_at,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Slug "${slug}" already exists` },
          { status: 409 }
        );
      }
      throw error;
    }

    await logActivity("blog.create", { slug, title, status }, "api");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);

    return NextResponse.json(
      { data: serializeBlogPost(data as BlogPost) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/v1/blog POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
