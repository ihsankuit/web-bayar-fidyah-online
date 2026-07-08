/** Helpers for handling YouTube links in the gallery. */

/**
 * Extract the 11-character YouTube video id from the common URL formats:
 * watch?v=, youtu.be/, embed/, shorts/, or a bare id.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // Bare id
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts");
      if (idx !== -1 && parts[idx + 1]) {
        const id = parts[idx + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}
