import { describe, expect, it } from "vitest";
import { adsConversionTime, buildAdsConversionCsv } from "./google-ads-export";
import type { Donation } from "./database.types";

const base = {
  status: "paid",
  gclid: "Cj0KCQ-abc",
  gbraid: null,
  wbraid: null,
  amount_sen: 12000,
  paid_at: "2026-11-20T02:01:17Z",
  created_at: "2026-11-20T01:55:00Z",
} as unknown as Donation;

describe("adsConversionTime", () => {
  it("writes Malaysia time with its offset", () => {
    expect(adsConversionTime("2026-11-20T02:01:17Z")).toBe("2026-11-20 10:01:17+0800");
  });
  it("rolls the date over after 16:00 UTC", () => {
    expect(adsConversionTime("2026-11-20T17:30:00Z")).toBe("2026-11-21 01:30:00+0800");
  });
});

describe("buildAdsConversionCsv", () => {
  it("writes Google's columns and one row per paid donation with a click id", () => {
    const { csv, count } = buildAdsConversionCsv([base], {
      type: "gclid",
      conversionName: "Fidyah Dibayar",
    });
    expect(count).toBe(1);
    expect(csv.split("\r\n")).toEqual([
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      "Cj0KCQ-abc,Fidyah Dibayar,2026-11-20 10:01:17+0800,120.00,MYR",
      "",
    ]);
  });
  it("skips unpaid donations and ones without that click id", () => {
    const { count } = buildAdsConversionCsv(
      [
        { ...base, status: "pending" } as Donation,
        { ...base, gclid: "" } as Donation,
        { ...base, gclid: null } as Donation,
      ],
      { type: "gclid", conversionName: "X" }
    );
    expect(count).toBe(0);
  });
  it("uses the iOS click id column for gbraid files", () => {
    const { csv, count } = buildAdsConversionCsv(
      [{ ...base, gclid: null, gbraid: "GB123" } as Donation],
      { type: "gbraid", conversionName: "X" }
    );
    expect(count).toBe(1);
    expect(csv.startsWith("Gbraid,Conversion Name")).toBe(true);
  });
  it("quotes a conversion name that contains a comma", () => {
    const { csv } = buildAdsConversionCsv([base], { type: "gclid", conversionName: "Fidyah, dibayar" });
    expect(csv).toContain('"Fidyah, dibayar"');
  });
  it("drops an exact duplicate row", () => {
    const { count } = buildAdsConversionCsv([base, { ...base } as Donation], {
      type: "gclid",
      conversionName: "X",
    });
    expect(count).toBe(1);
  });
});
