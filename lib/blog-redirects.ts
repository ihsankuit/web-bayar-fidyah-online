/**
 * Retired blog URLs and the article that now owns each topic.
 *
 * Three separate URLs were covering "fidyah untuk si mati" and two were
 * covering the yearly rate. Near-duplicates split whatever authority the
 * topic earns across several URLs and burn crawl budget on a young domain —
 * which is why Search Console parks them under "Discovered – currently not
 * indexed" instead of indexing any of them. One URL per topic, with the
 * retired ones redirecting into it, consolidates those signals.
 *
 * Keys and values are slugs, not paths. To retire a different article
 * instead, swap the pair — everything downstream (redirects, sitemap, blog
 * listing) reads from this one map.
 */
export const BLOG_REDIRECTS: Record<string, string> = {
  // Topic: fidyah on behalf of someone who has died.
  "orang-meninggal": "fidyah-untuk-si-mati",
  "fidyah-untuk-orang-meninggal": "fidyah-untuk-si-mati",
  // Topic: the current fidyah rate. The year-stamped 2025 page is superseded
  // rather than duplicated, so it points forward to the 2026 article.
  "kadar-fidyah-2025": "kadar-fidyah-2026",
};

/** Slugs that must no longer be advertised in the sitemap or blog listing. */
export const RETIRED_BLOG_SLUGS = new Set(Object.keys(BLOG_REDIRECTS));

/** The surviving slug for a retired one, or null if the slug is still live. */
export function blogRedirectTarget(slug: string): string | null {
  return BLOG_REDIRECTS[slug] ?? null;
}
