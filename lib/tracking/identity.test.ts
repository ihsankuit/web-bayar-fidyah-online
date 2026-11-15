import { describe, expect, it } from "vitest";
import {
  externalIdFor,
  normalizePhoneForMatching,
  normalizeRegionForMatching,
  splitNameForMatching,
} from "./identity";

describe("normalizePhoneForMatching", () => {
  it("replaces the local trunk zero with the country code", () => {
    // The bug this fixes: "0123456789" was hashed as-is and never matched
    // what Meta holds, which is the E.164 form.
    expect(normalizePhoneForMatching("0123456789")).toBe("60123456789");
  });

  it("strips the punctuation payers actually type", () => {
    expect(normalizePhoneForMatching("012-345 6789")).toBe("60123456789");
    expect(normalizePhoneForMatching("+60 12 345 6789")).toBe("60123456789");
    expect(normalizePhoneForMatching("(012) 3456789")).toBe("60123456789");
  });

  it("leaves a number that already has the Malaysian code alone", () => {
    expect(normalizePhoneForMatching("60123456789")).toBe("60123456789");
  });

  it("keeps an overseas number rather than forcing 60 onto it", () => {
    expect(normalizePhoneForMatching("+65 9123 4567")).toBe("6591234567");
    expect(normalizePhoneForMatching("+44 7700 900123")).toBe("447700900123");
  });

  it("returns null rather than guessing at junk", () => {
    expect(normalizePhoneForMatching("")).toBeNull();
    expect(normalizePhoneForMatching(null)).toBeNull();
    expect(normalizePhoneForMatching(undefined)).toBeNull();
    expect(normalizePhoneForMatching("abc")).toBeNull();
    expect(normalizePhoneForMatching("123")).toBeNull();
    expect(normalizePhoneForMatching("1".repeat(20))).toBeNull();
  });
});

describe("splitNameForMatching", () => {
  it("takes the given name and the last token", () => {
    expect(splitNameForMatching("Ahmad bin Abdullah")).toEqual({
      first: "ahmad",
      last: "abdullah",
    });
    expect(splitNameForMatching("Siti Nurhaliza binti Tarudin")).toEqual({
      first: "siti",
      last: "tarudin",
    });
  });

  it("handles a single-word name", () => {
    expect(splitNameForMatching("Rahman")).toEqual({
      first: "rahman",
      last: null,
    });
  });

  it("drops punctuation, digits and extra whitespace", () => {
    expect(splitNameForMatching("  Nur'ain   Abd. Rahman 2  ")).toEqual({
      first: "nurain",
      last: "rahman",
    });
  });

  it("returns nulls for nothing usable", () => {
    expect(splitNameForMatching(null)).toEqual({ first: null, last: null });
    expect(splitNameForMatching("   ")).toEqual({ first: null, last: null });
    expect(splitNameForMatching("123 456")).toEqual({
      first: null,
      last: null,
    });
  });
});

describe("normalizeRegionForMatching", () => {
  it("lowercases and strips punctuation and spaces", () => {
    expect(normalizeRegionForMatching("Selangor")).toBe("selangor");
    expect(normalizeRegionForMatching("W.P. Kuala Lumpur")).toBe(
      "wpkualalumpur"
    );
    expect(normalizeRegionForMatching("Negeri Sembilan")).toBe(
      "negerisembilan"
    );
  });

  it("returns null for nothing usable", () => {
    expect(normalizeRegionForMatching(null)).toBeNull();
    expect(normalizeRegionForMatching("")).toBeNull();
    expect(normalizeRegionForMatching("--")).toBeNull();
  });
});

describe("externalIdFor", () => {
  it("prefers the phone, matching how payer profiles group people", () => {
    expect(externalIdFor("012-345 6789", "a@b.com")).toBe("60123456789");
  });

  it("falls back to the email when there is no usable phone", () => {
    expect(externalIdFor(null, "  A@B.com ")).toBe("a@b.com");
    expect(externalIdFor("junk", "a@b.com")).toBe("a@b.com");
  });

  it("returns null when neither is usable", () => {
    expect(externalIdFor(null, null)).toBeNull();
    expect(externalIdFor("", "  ")).toBeNull();
  });

  it("is stable across two donations by the same payer", () => {
    expect(externalIdFor("0123456789", "x@y.com")).toBe(
      externalIdFor("+60 12-345 6789", "different@email.com")
    );
  });
});
