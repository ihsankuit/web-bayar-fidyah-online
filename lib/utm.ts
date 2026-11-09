/**
 * UTM (utm_source / utm_medium / utm_campaign / utm_term / utm_content)
 * capture for donation attribution. Last-touch: whenever a visitor lands
 * with utm params in the URL, they replace whatever was stored before.
 * Visits with no utm params leave the existing attribution untouched, so
 * navigating internal pages before donating doesn't wipe it.
 */

export interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
}

const STORAGE_KEY = "fidyah_utm";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

function parseUtmFromSearch(search: string): UtmParams | null {
  const params = new URLSearchParams(search);
  const hasAny = UTM_KEYS.some((key) => params.get(key));
  if (!hasAny) return null;

  return {
    utm_source: params.get("utm_source") ?? "",
    utm_medium: params.get("utm_medium") ?? "",
    utm_campaign: params.get("utm_campaign") ?? "",
    utm_term: params.get("utm_term") ?? "",
    utm_content: params.get("utm_content") ?? "",
  };
}

/** Capture utm_* params from the current URL into localStorage, if present. */
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  const parsed = parseUtmFromSearch(window.location.search);
  if (!parsed) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage unavailable (private mode, disabled storage, etc).
  }
}

/** Read the currently stored attribution for this browser, if any. */
export function getStoredUtm(): UtmParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UtmParams;
  } catch {
    return null;
  }
}

/**
 * Google Ads click identifiers, kept separately from UTM because they arrive
 * independently: auto-tagging appends `gclid` (or `gbraid`/`wbraid` for iOS
 * app/web traffic) whether or not utm_* are present. Storing them enables
 * offline conversion import back to Google Ads — matching a conversion that is
 * only confirmed later (e.g. a manual bank transfer) to the original ad click.
 */
export interface ClickIds {
  gclid: string;
  gbraid: string;
  wbraid: string;
}

const CLICK_STORAGE_KEY = "fidyah_click_ids";
const CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;

function parseClickIdsFromSearch(search: string): ClickIds | null {
  const params = new URLSearchParams(search);
  const hasAny = CLICK_KEYS.some((key) => params.get(key));
  if (!hasAny) return null;

  return {
    gclid: params.get("gclid") ?? "",
    gbraid: params.get("gbraid") ?? "",
    wbraid: params.get("wbraid") ?? "",
  };
}

/** Capture Google Ads click ids from the current URL into localStorage. */
export function captureClickIds(): void {
  if (typeof window === "undefined") return;
  const parsed = parseClickIdsFromSearch(window.location.search);
  if (!parsed) return;

  try {
    window.localStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage unavailable (private mode, disabled storage, etc).
  }
}

/** Read the stored Google Ads click ids for this browser, if any. */
export function getStoredClickIds(): ClickIds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CLICK_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClickIds;
  } catch {
    return null;
  }
}
