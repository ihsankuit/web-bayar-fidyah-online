/**
 * Database types mirroring the Supabase schema in `supabase/schema.sql`.
 * Kept hand-written (rather than generated) so the app builds without a live
 * database connection. Regenerate with `supabase gen types typescript` if you
 * prefer the generated version.
 */

export type DonationStatus = "pending" | "paid" | "failed";
export type PostStatus = "draft" | "published";

export interface Donation {
  id: string;
  reference: string;
  billplz_bill_id: string | null;
  payer_name: string;
  payer_email: string;
  payer_phone: string | null;
  negeri: string | null;
  category: string;
  days: number;
  multiplier: number;
  rate_sen: number;
  amount_sen: number;
  message: string | null;
  status: DonationStatus;
  paid_at: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: PostStatus;
  author: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  path: string;
  url: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export type GalleryType = "image" | "video";

export interface GalleryItem {
  id: string;
  type: GalleryType;
  title: string | null;
  image_url: string | null;
  youtube_id: string | null;
  storage_path: string | null;
  sort_order: number;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

/** Editable landing page content stored under the `landing` settings key. */
export interface LandingContent {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  about_title: string;
  about_body: string;
  hukum_title: string;
  hukum_body: string;
  hadith_arabic: string;
  hadith_meaning: string;
  hadith_source: string;
  fidyah_rate_sen: number;
  stats: { label: string; value: string }[];
  faqs: { question: string; answer: string }[];
  footer_note: string;
}
