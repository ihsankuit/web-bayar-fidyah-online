import { describe, expect, it } from "vitest";
import { captionPreview, CAPTION_PARAGRAPH_LIMIT } from "./agihan-updates";

const para = (n: number) => `Perenggan ${n}.`;
const build = (count: number) =>
  Array.from({ length: count }, (_, i) => para(i + 1)).join("\n\n");

describe("captionPreview", () => {
  it("shows a short caption whole", () => {
    const { text, truncated } = captionPreview(build(2));
    expect(truncated).toBe(false);
    expect(text).toBe("Perenggan 1.\n\nPerenggan 2.");
  });

  it("shows exactly the limit without truncating", () => {
    const { text, truncated } = captionPreview(build(CAPTION_PARAGRAPH_LIMIT));
    expect(truncated).toBe(false);
    expect(text.split("\n\n")).toHaveLength(CAPTION_PARAGRAPH_LIMIT);
  });

  it("keeps only the first four paragraphs past the limit", () => {
    const { text, truncated } = captionPreview(build(9));
    expect(truncated).toBe(true);
    expect(text.split("\n\n")).toEqual([
      "Perenggan 1.",
      "Perenggan 2.",
      "Perenggan 3.",
      "Perenggan 4.",
    ]);
  });

  it("treats a lone newline as a line break, not a paragraph break", () => {
    // How these captions are actually written: two lines that read as one
    // paragraph. Splitting on every newline would cut the card off early.
    const caption =
      "Baris satu.\nBaris dua.\n\nKedua.\n\nKetiga.\n\nKeempat.\n\nKelima.";
    const { text, truncated } = captionPreview(caption);
    expect(truncated).toBe(true);
    expect(text).toContain("Baris satu.\nBaris dua.");
    expect(text).not.toContain("Kelima.");
  });

  it("tolerates blank lines padded with spaces", () => {
    const caption = ["Satu.", "Dua.", "Tiga.", "Empat.", "Lima."].join("\n   \n");
    const { truncated, text } = captionPreview(caption);
    expect(truncated).toBe(true);
    expect(text.split("\n\n")).toHaveLength(4);
  });

  it("trims surrounding whitespace", () => {
    expect(captionPreview("\n\n  Satu.  \n\n").text).toBe("Satu.");
  });

  it("still caps one unbroken wall of text", () => {
    // A single paragraph is under the paragraph limit however long it runs,
    // so the word cap is the only thing stopping one card stretching the
    // whole timeline.
    const { text, truncated } = captionPreview("perkataan ".repeat(400));
    expect(truncated).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.split(/\s+/).length).toBeLessThan(220);
  });

  it("caps four very long paragraphs too", () => {
    const long = Array.from({ length: 4 }, () => "perkataan ".repeat(80)).join(
      "\n\n"
    );
    const { truncated } = captionPreview(long);
    expect(truncated).toBe(true);
  });

  it("handles an empty caption without throwing", () => {
    expect(captionPreview("")).toEqual({ text: "", truncated: false });
  });
});
