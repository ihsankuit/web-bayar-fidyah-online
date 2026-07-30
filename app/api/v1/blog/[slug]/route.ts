import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized, serializeBlogPost } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import type { BlogPost, PostStatus } from "@/lib/database.types";

/**
 * GET /api/v1/blog/[slug]
 * Fetch a single post (any status). Auth: API key.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-blog-single:${clientIp(request)}`, 120, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { slug } = await params;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle<BlogPost>();

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: serializeBlogPost(data) });
  } catch (err) {
    console.error("[api/v1/blog/:slug GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/blog/[slug]
 * Partial update — only fields present in the body are changed. Body may
 * include: title, slug (rename), excerpt, content, cover_image, author,
 * status ("draft"|"published"), published_at. Auth: API key.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-blog-write:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { slug: currentSlug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", currentSlug)
      .maybeSingle<BlogPost>();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      payload.title = body.title.trim();
    }
    if (typeof body.excerpt === "string") {
      payload.excerpt = body.excerpt.trim() || null;
    }
    if (typeof body.content === "string") {
      payload.content = body.content;
    }
    if (typeof body.cover_image === "string") {
      payload.cover_image = body.cover_image.trim() || null;
    }
    if (typeof body.author === "string") {
      payload.author = body.author.trim() || null;
    }
    if (typeof body.slug === "string" && body.slug.trim()) {
      const newSlug = slugify(body.slug.trim());
      if (!newSlug) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      payload.slug = newSlug;
    }

    let nextStatus: PostStatus = existing.status;
    if (body.status === "published" || body.status === "draft") {
      nextStatus = body.status;
      payload.status = nextStatus;
    }

    if (nextStatus === "published") {
      if (typeof body.published_at === "string" && body.published_at.trim()) {
        const parsed = new Date(body.published_at);
        payload.published_at = Number.isNaN(parsed.getTime())
          ? (existing.published_at ?? new Date().toISOString())
          : parsed.toISOString();
      } else if (!existing.published_at) {
        // Newly published with no explicit date — publish now, same as create.
        payload.published_at = new Date().toISOString();
      }
    } else if (body.status === "draft") {
      payload.published_at = null;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .update(payload)
      .eq("slug", currentSlug)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Slug "${payload.slug}" already exists` },
          { status: 409 }
        );
      }
      throw error;
    }

    const newSlug = (payload.slug as string | undefined) ?? currentSlug;
    await logActivity("blog.update", { slug: currentSlug, new_slug: newSlug }, "api");
    revalidatePath("/blog");
    revalidatePath(`/blog/${currentSlug}`);
    if (newSlug !== currentSlug) revalidatePath(`/blog/${newSlug}`);

    return NextResponse.json({ data: serializeBlogPost(data as BlogPost) });
  } catch (err) {
    console.error("[api/v1/blog/:slug PATCH]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/blog/[slug]
 * Auth: API key.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-blog-write:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { slug } = await params;

  try {
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await supabase.from("blog_posts").delete().eq("slug", slug);
    await logActivity("blog.delete", { slug }, "api");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);

    return NextResponse.json({ data: { slug, deleted: true } });
  } catch (err) {
    console.error("[api/v1/blog/:slug DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
