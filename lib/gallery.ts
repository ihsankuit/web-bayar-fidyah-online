import { createClient } from "@/lib/supabase/server";
import type { GalleryItem } from "@/lib/database.types";

/** Fetch gallery items ordered for display. Returns [] on any failure. */
export async function getGalleryItems(): Promise<GalleryItem[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("gallery_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    return (data as GalleryItem[]) ?? [];
  } catch {
    return [];
  }
}
