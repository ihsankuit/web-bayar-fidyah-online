import { describe, it, expect } from "vitest";
import { formatMYR, slugify, formatRelativeTime } from "./utils";

describe("formatMYR", () => {
  it("formats whole ringgit amounts", () => {
    expect(formatMYR(20000)).toMatch(/200\.00/);
  });

  it("formats sen correctly", () => {
    expect(formatMYR(150)).toMatch(/1\.50/);
  });

  it("formats zero", () => {
    expect(formatMYR(0)).toMatch(/0\.00/);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Apa Itu Fidyah?")).toBe("apa-itu-fidyah");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Iḥsan")).toBe("cafe-ihsan");
  });

  it("collapses repeated whitespace and separators", () => {
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });

  it("removes symbols that aren't letters, digits, or hyphens", () => {
    expect(slugify("Fidyah: RM2.00/hari!")).toBe("fidyah-rm200hari");
  });
});

describe("formatRelativeTime", () => {
  it("floors sub-minute differences to 'Baru sahaja'", () => {
    expect(formatRelativeTime(new Date(Date.now() - 10_000))).toBe("Baru sahaja");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5 minit lalu");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe("3 jam lalu");
  });

  it("formats days", () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 86_400_000))).toBe("2 hari lalu");
  });
});
