import { createClient } from "@/lib/supabase/public";
import { RETIRED_BLOG_SLUGS } from "@/lib/blog-redirects";

/**
 * The guides promoted from the homepage.
 *
 * The homepage had no link to a single article — only to /blog. That left
 * every article relying on the blog index alone for internal link equity,
 * which is the mechanical reason so many sat in Search Console as
 * "Discovered – currently not indexed": Google could find them but had no
 * signal that any of them mattered.
 *
 * Anchor text is curated here rather than taken from the post title, because
 * the anchor is a ranking signal in its own right and should read as the
 * query the article is meant to win. Titles get trimmed for SERP width and
 * drift; these do not.
 */
export interface FeaturedGuide {
  slug: string;
  /** The query this article targets — never "baca lagi". */
  anchor: string;
  blurb: string;
}

export const FEATURED_GUIDES: FeaturedGuide[] = [
  {
    slug: "kadar-fidyah-2026",
    anchor: "Kadar Fidyah 2026 Mengikut Negeri",
    blurb: "Kadar terkini setiap negeri dan cara mengira jumlah yang perlu dibayar.",
  },
  {
    slug: "cara-bayar-fidyah-online-malaysia",
    anchor: "Cara Bayar Fidyah Online di Malaysia",
    blurb: "Panduan langkah demi langkah, dari kiraan sehingga resit masuk emel.",
  },
  {
    slug: "siapa-wajib-bayar-fidyah",
    anchor: "Siapa Wajib Bayar Fidyah?",
    blurb: "Lima kumpulan yang diwajibkan membayar fidyah dan syaratnya.",
  },
  {
    slug: "fidyah-untuk-si-mati",
    anchor: "Fidyah untuk Si Mati: Panduan Waris",
    blurb: "Tanggungjawab waris terhadap puasa yang ditinggalkan si mati.",
  },
  {
    slug: "fidyah-ibu-hamil-menyusu",
    anchor: "Fidyah Ibu Hamil & Menyusu",
    blurb: "Bila fidyah diwajibkan, dan bila qada pula yang dituntut.",
  },
  {
    slug: "fidyah-vs-qada",
    anchor: "Beza Fidyah dan Qada Puasa",
    blurb: "Dua perkara yang kerap dikelirukan — kenali mana satu wajib ke atas anda.",
  },
];

/**
 * The curated guides that are actually published right now, in curated
 * order. Unpublishing an article removes it from the homepage instead of
 * leaving a link into a 404, and an unreachable database renders no section
 * at all rather than six dead links.
 */
export async function getFeaturedGuides(): Promise<FeaturedGuide[]> {
  const wanted = FEATURED_GUIDES.filter((g) => !RETIRED_BLOG_SLUGS.has(g.slug));

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .in(
        "slug",
        wanted.map((g) => g.slug)
      );

    if (!data) return [];
    const live = new Set((data as { slug: string }[]).map((p) => p.slug));
    return wanted.filter((g) => live.has(g.slug));
  } catch {
    return [];
  }
}
