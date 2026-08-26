import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Search } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/public";
import type { BlogPost } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/utils";
import { SITE_URL } from "@/lib/site-url";
import { RETIRED_BLOG_SLUGS } from "@/lib/blog-redirects";

export const metadata = {
  title: "Blog — Panduan Fidyah, Puasa & Ibadah",
  description:
    "Artikel, panduan dan info terkini berkaitan fidyah puasa Ramadan, hukum fidyah, cara kira fidyah, dan ibadah di Malaysia.",
  alternates: {
    canonical: "/blog",
  },
};

export const revalidate = 60;

/** Estimate reading time in minutes from markdown content. */
function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";

  let posts: BlogPost[] = [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    // Retired duplicates only 301 elsewhere — don't spend internal links on
    // them, even if they're still published in the database.
    posts = ((data as BlogPost[]) ?? []).filter(
      (p) => !RETIRED_BLOG_SLUGS.has(p.slug)
    );
  } catch {
    posts = [];
  }

  // Client-side filter if query provided
  const filteredPosts = query
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.excerpt ?? "").toLowerCase().includes(query)
      )
    : posts;

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Artikel, panduan dan info terkini berkaitan fidyah, puasa dan
              ibadah.
            </p>
          </div>

          {/* Search Box */}
          <form className="mt-8 flex gap-2" action="/blog" method="GET">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Cari artikel..."
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Cari
            </button>
          </form>

          {filteredPosts.length === 0 ? (
            <p className="mt-12 text-muted-foreground">
              {query
                ? `Tiada artikel dijumpai untuk "${q}".`
                : "Tiada artikel diterbitkan buat masa ini."}
            </p>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {filteredPosts.map((post, index) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                    {post.cover_image && (
                      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                        <Image
                          src={post.cover_image}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, 500px"
                          priority={index === 0}
                        />
                      </div>
                    )}
                    <CardContent className="space-y-2 p-6">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {post.published_at && (
                          <span>{formatDateOnly(post.published_at)}</span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {estimateReadingTime(post.content)} minit
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold group-hover:text-primary">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                        Baca lagi <ArrowRight className="h-4 w-4" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}