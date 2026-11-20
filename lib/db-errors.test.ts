import { describe, expect, it } from "vitest";
import { isMissingColumnError } from "./db-errors";

describe("isMissingColumnError", () => {
  it("recognises PostgREST's schema-cache miss", () => {
    expect(
      isMissingColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'qada_breakdown' column of 'donations' in the schema cache",
        },
        "qada_breakdown"
      )
    ).toBe(true);
  });

  it("recognises Postgres's undefined-column error", () => {
    expect(
      isMissingColumnError(
        { code: "42703", message: 'column "qada_breakdown" of relation "donations" does not exist' },
        "qada_breakdown"
      )
    ).toBe(true);
  });

  it("recognises the message when the code is absent", () => {
    expect(
      isMissingColumnError(
        { message: "column donations.qada_breakdown does not exist" },
        "qada_breakdown"
      )
    ).toBe(true);
  });

  it("does not mistake an unrelated failure for a missing column", () => {
    // A missing column on some other field must not trigger a retry that
    // would then silently drop data we were never asked to drop.
    expect(
      isMissingColumnError(
        { code: "PGRST204", message: "Could not find the 'other_col' column of 'donations'" },
        "qada_breakdown"
      )
    ).toBe(false);
    expect(
      isMissingColumnError(
        { code: "23505", message: 'duplicate key value violates unique constraint "donations_reference_key"' },
        "qada_breakdown"
      )
    ).toBe(false);
  });

  it("is false for no error at all", () => {
    expect(isMissingColumnError(null, "qada_breakdown")).toBe(false);
    expect(isMissingColumnError(undefined, "qada_breakdown")).toBe(false);
  });

  it("does not trigger on an error that names the column for another reason", () => {
    expect(
      isMissingColumnError(
        { code: "22P02", message: 'invalid input syntax for type json in column "qada_breakdown"' },
        "qada_breakdown"
      )
    ).toBe(false);
  });
});
