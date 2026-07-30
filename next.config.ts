import type { NextConfig } from "next";

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
    remotePatterns: [
      host
        ? { protocol: "https", hostname: host }
        : { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
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
