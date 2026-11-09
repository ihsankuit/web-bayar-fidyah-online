import { createClient } from "@/lib/supabase/public";
import type { AgihanUpdate } from "@/lib/database.types";

/**
 * Public distribution-update timeline shown on the landing page. Newest first
 * (by the date the distribution happened). Returns [] on any failure so the
 * landing page never breaks when the table is missing or Supabase is down.
 */
export async function getAgihanUpdates(limit = 12): Promise<AgihanUpdate[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("agihan_updates")
      .select("*")
      .order("happened_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as AgihanUpdate[]) ?? [];
  } catch {
    return [];
  }
}

/** The update's photos, preferring the array and falling back to legacy single. */
export function updateImages(u: AgihanUpdate): string[] {
  if (u.image_urls?.length) return u.image_urls;
  return u.image_url ? [u.image_url] : [];
}

/** The update's storage paths (for deletion), array with legacy fallback. */
export function updateStoragePaths(u: AgihanUpdate): string[] {
  if (u.storage_paths?.length) return u.storage_paths;
  return u.storage_path ? [u.storage_path] : [];
}

/** Paragraphs shown on a timeline card before "Baca lagi" takes over. */
export const CAPTION_PARAGRAPH_LIMIT = 4;

/**
 * Safety net for a caption written as one unbroken block. The paragraph
 * limit can't catch that case — one paragraph is under the limit however
 * long it runs — and a single card shouldn't be able to stretch the whole
 * timeline.
 */
const CAPTION_WORD_LIMIT = 200;

/**
 * The part of a caption a timeline card shows, and whether anything was
 * held back.
 *
 * Paragraphs are separated by a BLANK line. A lone newline is a line break
 * inside one paragraph, which is how these captions are actually written —
 * splitting on every newline would cut a card off mid-thought.
 */
export function captionPreview(caption: string): {
  text: string;
  truncated: boolean;
} {
  const trimmed = caption.trim();
  const paragraphs = trimmed.split(/\n\s*\n/);

  let text = paragraphs.slice(0, CAPTION_PARAGRAPH_LIMIT).join("\n\n");
  let truncated = paragraphs.length > CAPTION_PARAGRAPH_LIMIT;

  const words = text.split(/\s+/);
  if (words.length > CAPTION_WORD_LIMIT) {
    text = words.slice(0, CAPTION_WORD_LIMIT).join(" ") + "…";
    truncated = true;
  }

  return { text, truncated };
}
