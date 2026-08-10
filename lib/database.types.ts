/**
 * Database types mirroring the Supabase schema in `supabase/schema.sql`.
 * Kept hand-written (rather than generated) so the app builds without a live
 * database connection. Regenerate with `supabase gen types typescript` if you
 * prefer the generated version.
 */

export type DonationStatus = "pending" | "paid" | "failed";
export type PaymentMethod = "chip" | "manual";
export type PostStatus = "draft" | "published";

export interface Donation {
  id: string;
  reference: string;
  chip_purchase_id: string | null;
  payment_method: PaymentMethod;
  proof_of_payment_path: string | null;
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
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  /** Conversion attribution captured from the payer's browser at submission time. */
  ga_client_id: string | null;
  fbp: string | null;
  fbc: string | null;
  client_ip: string | null;
  user_agent: string | null;
  landing_url: string | null;
  /** Upsell campaign accepted at checkout (combined into the same payment). */
  upsell_accepted: boolean;
  upsell_title: string | null;
  upsell_amount_sen: number;
  /** Manual follow-up reminders sent for an unpaid/failed payment. */
  followup_count: number;
  last_followup_at: string | null;
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
  /** Per-article SEO overrides; fall back to title/excerpt when empty. */
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
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

export interface ActivityLogEntry {
  id: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

/** A fidyah distribution update sent to paid donors via WhatsApp (Murpati). */
export interface FidyahDistribution {
  id: string;
  message: string;
  image_url: string | null;
  date_from: string;
  date_to: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
}

/**
 * A saved agihan message template. `message` may contain variable tags —
 * {{nama}}, {{jumlah}}, {{hari}}, {{kategori}}, {{negeri}} — substituted
 * per-recipient at send time.
 */
export interface AgihanTemplate {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

export type FidyahDistributionRecipientStatus = "sent" | "failed";

/**
 * Per-recipient WhatsApp send result for a fidyah distribution update. The
 * amount_sen/days/category/negeri fields are a snapshot of the variable-tag
 * values resolved at send time, reused as-is on retry.
 */
export interface FidyahDistributionRecipient {
  id: string;
  distribution_id: string;
  name: string;
  phone: string;
  status: FidyahDistributionRecipientStatus;
  error: string | null;
  amount_sen: number;
  days: number;
  category: string | null;
  negeri: string | null;
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
  /** Optional soft background image behind the hero section. */
  hero_image_url: string;
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
  /** Bank account details shown for the manual bank transfer payment method. */
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  /**
   * WhatsApp number (with country code, e.g. 60123456789) for the floating
   * "chat with admin" button. Empty hides the button.
   */
  whatsapp_number: string;
  /** Greeting shown in the WhatsApp bubble. Empty uses a default. */
  whatsapp_greeting: string;
  /**
   * Per-category overrides for the "Siapa Yang Wajib Membayar Fidyah?"
   * cards, keyed by FidyahCategoryId (see lib/fidyah.ts). Any field left
   * unset falls back to the hardcoded default (title/description) or the
   * shipped illustration (image_url).
   */
  category_content: Record<
    string,
    { title?: string; description?: string; image_url?: string }
  >;
}

/** Upsell campaign offered at checkout, stored under the `upsell` settings key. */
export interface UpsellSettings {
  enabled: boolean;
  title: string;
  description: string;
  /** Default/suggested amount — the payer can adjust it in the popup. */
  amount_sen: number;
  /** Poster image shown in the popup (uploaded via Admin > Media, URL pasted here). */
  poster_image_url: string;
  accept_label: string;
  skip_label: string;
}

/**
 * Default follow-up message templates, stored under the `followup` settings
 * key. Each may contain variable tags — {{nama}}, {{rujukan}}, {{jumlah}},
 * {{hari}}, {{kategori}}, {{pautan}} — substituted per payer at send time.
 * Admins can still edit the text per-send before it goes out.
 */
export interface FollowUpSettings {
  whatsapp_message: string;
  email_subject: string;
  email_body: string;
}

/**
 * Notification sent the moment a payment settles, stored under the
 * `payment_success` settings key. The email always carries the itemised
 * breakdown (that part is data, not copy) — only the subject and the intro
 * paragraph above it are editable. Text may contain variable tags:
 * {{nama}}, {{rujukan}}, {{jumlah}}, {{hari}}, {{kategori}}, {{tarikh}},
 * {{resit}}.
 */
export interface PaymentSuccessSettings {
  email_subject: string;
  email_intro: string;
  email_attach_pdf: boolean;
  whatsapp_enabled: boolean;
  whatsapp_message: string;
  whatsapp_attach_pdf: boolean;
}
