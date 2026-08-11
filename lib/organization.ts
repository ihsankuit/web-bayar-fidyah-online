/**
 * The real-world organisation behind this site, in one place.
 *
 * Local SEO hinges on NAP consistency — the Name, Address and Phone here must
 * match the Google Business Profile character for character. Google matches
 * these as strings across the web; "Jln" in one place and "Jalan" in another
 * reads as two different businesses and dilutes the signal. Keeping a single
 * constant means the footer and the JSON-LD can never drift apart.
 *
 * Source of truth: the Google Business Profile for Pertubuhan Ihsanku
 * Malaysia. Update there first, then mirror it here.
 */
export const ORG = {
  name: "Pertubuhan Ihsanku Malaysia",
  /** Registered non-profit — schema.org NGO is the precise Organization subtype. */
  schemaType: "NGO",
  streetAddress: "1-1, Jln Puteri 2A/1, Bandar Bukit Mahkota",
  locality: "Kajang",
  region: "Selangor",
  postalCode: "43000",
  country: "MY",
  /** Local (display) form — matches how the GBP listing shows it. */
  phoneDisplay: "011-2700 2003",
  /** E.164, for tel: links and structured data. */
  phoneE164: "+60112700203",
  website: "https://ihsanku.org",
  /** Google Maps plus code, a precise location identifier. */
  plusCode: "VQMW+22 Kajang, Selangor",
  logoPath: "/logo-ihsanku.png",
} as const;

/** Single-line address, as shown in the footer. */
export const ORG_ADDRESS_LINE = `${ORG.streetAddress}, ${ORG.postalCode} ${ORG.locality}, ${ORG.region}`;
