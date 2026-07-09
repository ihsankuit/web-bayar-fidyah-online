import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/public";
import type { BlogPost } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/utils";

export const metadata = {
  title: "Blog — Panduan Fidyah, Puasa & Ibadah",
  description:
    "Artikel, panduan dan info terkini berkaitan fidyah puasa Ramadan, hukum fidyah, cara kira fidyah, dan ibadah di Malaysia.",
  alternates: {
    canonical: "/blog",
  },
};

export const revalidate = 60;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bayarfidyahonline.com";

export default async function BlogIndexPage() {
  let posts: BlogPost[] = [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    posts = (data as BlogPost[]) ?? [];
  } catch {
    posts = [];
  }

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
                item: siteUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Blog",
                item: `${siteUrl}/blog`,
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

          {posts.length === 0 ? (
            <p className="mt-12 text-muted-foreground">
              Tiada artikel diterbitkan buat masa ini.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                    {post.cover_image && (
                      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                        <Image
                          src={post.cover_image}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      </div>
                    )}
                    <CardContent className="space-y-2 p-6">
                      {post.published_at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDateOnly(post.published_at)}
                        </p>
                      )}
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
