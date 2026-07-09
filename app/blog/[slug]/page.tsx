import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Markdown } from "@/components/site/markdown";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/utils";

export const revalidate = 60;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bayarfidyahonline.com";

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return (data as BlogPost) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Artikel tidak dijumpai" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      url: `${siteUrl}/blog/${post.slug}`,
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

  const postUrl = `${siteUrl}/blog/${post.slug}`;

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
      url: siteUrl,
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
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteUrl}/blog`,
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
              <p className="text-sm text-muted-foreground">
                {formatDateOnly(post.published_at)}
                {post.author ? ` · ${post.author}` : ""}
              </p>
            )}
            <h1 className="text-balance text-4xl font-bold tracking-tight">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-lg text-muted-foreground">{post.excerpt}</p>
            )}
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
        </article>
      </main>
      <Footer />
    </div>
  );
}
