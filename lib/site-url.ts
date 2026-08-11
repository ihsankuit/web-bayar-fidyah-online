/**
 * The site's canonical origin, in one place.
 *
 * Every absolute URL the app emits is built as `${SITE_URL}/path`, so a
 * trailing slash on `NEXT_PUBLIC_SITE_URL` would produce `//path` everywhere
 * at once — broken sitemap and canonical entries, but also broken CHIP
 * callback URLs and receipt links. Normalising here means the env var can be
 * set with or without a trailing slash and the output is identical.
 *
 * The default is the `www` host because that is what the sitemap, canonical
 * tags and hreflang all point at; the apex domain 301-redirects to it at the
 * CDN. Keep the two in agreement — serving both without a redirect splits
 * ranking signals across two hostnames Google treats as separate sites.
 */

/** Strips whitespace and any trailing slashes from an origin. */
export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export const SITE_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bayarfidyahonline.com"
);
