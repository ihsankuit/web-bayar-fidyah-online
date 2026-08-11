import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Share2 } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Markdown } from "@/components/site/markdown";
import { createClient } from "@/lib/supabase/public";
import type { BlogPost } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/utils";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 60;

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    return (data as BlogPost) ?? null;
  } catch {
    return null;
  }
}

async function getRelatedPosts(currentSlug: string): Promise<BlogPost[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("slug,title,excerpt,cover_image,published_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .neq("slug", currentSlug)
      .order("published_at", { ascending: false })
      .limit(3);
    return (data as BlogPost[]) ?? [];
  } catch {
    return [];
  }
}

/** Estimate reading time in minutes from markdown content. */
function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Artikel tidak dijumpai" };

  const metaTitle = post.seo_title?.trim() || post.title;
  const metaDescription =
    post.seo_description?.trim() || post.excerpt || undefined;
  const keywords = post.seo_keywords
    ? post.seo_keywords
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean)
    : undefined;

  return {
    // `absolute` overrides the root layout's "%s | Bayar Fidyah Online"
    // template so article titles are not lengthened with the site suffix.
    title: { absolute: metaTitle },
    description: metaDescription,
    ...(keywords && keywords.length ? { keywords } : {}),
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: "article",
      url: `${SITE_URL}/blog/${post.slug}`,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(slug);
  const readingTime = estimateReadingTime(post.content);
  const postUrl = `${SITE_URL}/blog/${post.slug}`;

  // JSON-LD: Article schema
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    url: postUrl,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: "Bayar Fidyah Online" },
    publisher: {
      "@type": "Organization",
      name: "Bayar Fidyah Online",
      url: SITE_URL,
    },
    ...(post.cover_image ? { image: post.cover_image } : {}),
    inLanguage: "ms",
  };

  // JSON-LD: BreadcrumbList schema
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Laman Utama",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SITE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: postUrl,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke blog
          </Link>

          <header className="mt-6 space-y-3">
            {post.published_at && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{formatDateOnly(post.published_at)}</span>
                {post.author && <span>· {post.author}</span>}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {readingTime} minit baca
                </span>
              </div>
            )}
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-lg text-muted-foreground">{post.excerpt}</p>
            )}

            {/* Social Share Buttons */}
            <ShareButtons url={postUrl} title={post.title} />
          </header>

          {post.cover_image && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
              <Image
                src={post.cover_image}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          )}

          <div className="mt-10">
            <Markdown>{post.content}</Markdown>
          </div>

          {/* CTA Box */}
          <div className="mt-12 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            <p className="text-lg font-semibold text-foreground">
              Tunaikan Fidyah Anda Hari Ini
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Mudah, pantas, dan selamat. Bayar fidyah online dalam masa 5 minit.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Bayar Fidyah Sekarang
            </Link>
          </div>

          {/* Related Articles */}
          {relatedPosts.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-bold tracking-tight mb-6">
                Artikel Berkaitan
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((rp) => (
                  <Link
                    key={rp.id}
                    href={`/blog/${rp.slug}`}
                    className="group rounded-lg border border-border p-4 transition-shadow hover:shadow-md"
                  >
                    <h3 className="font-semibold text-sm leading-snug group-hover:text-primary">
                      {rp.title}
                    </h3>
                    {rp.excerpt && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {rp.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}

/** Social share buttons — client-side share API with fallbacks. */
function ShareButtons({ url, title }: { url: string; title: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: "hover:bg-green-500/10 hover:text-green-600",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-blue-500/10 hover:text-blue-600",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: "hover:bg-sky-500/10 hover:text-sky-600",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "hover:bg-gray-500/10 hover:text-gray-700",
    },
  ];

  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Share2 className="h-3.5 w-3.5" /> Kongsi:
      </span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors ${l.color}`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}