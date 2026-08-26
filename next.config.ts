import type { NextConfig } from "next";

import { BLOG_REDIRECTS } from "./lib/blog-redirects";

/**
 * Allow next/image to load from the Supabase Storage public bucket. The
 * hostname is derived from NEXT_PUBLIC_SUPABASE_URL when available; otherwise
 * any *.supabase.co host is permitted.
 */
function supabaseHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
}

const host = supabaseHostname();

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Serve AVIF/WebP (smaller than PNG/JPEG) where the browser supports it.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      host
        ? { protocol: "https", hostname: host }
        : { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  /**
   * Permanent redirects from the retired duplicate articles into the one
   * that survived. Handled here rather than in the page so they still work
   * when the database is unreachable, and so the old URL never renders.
   */
  async redirects() {
    return Object.entries(BLOG_REDIRECTS).map(([from, to]) => ({
      source: `/blog/${from}`,
      destination: `/blog/${to}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        // Advertise the REST API docs to crawlers/agents per RFC 8288.
        source: "/",
        headers: [
          {
            key: "Link",
            value: '</docs/api-reference.md>; rel="service-doc"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
