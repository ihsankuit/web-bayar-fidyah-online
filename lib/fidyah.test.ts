import { describe, it, expect } from "vitest";
import { calculateFidyah, DEFAULT_FIDYAH_RATE_SEN } from "./fidyah";

describe("calculateFidyah", () => {
  it("multiplies days x rate x multiplier", () => {
    expect(calculateFidyah({ days: 5, multiplier: 2, rateSen: 200 })).toEqual({
      days: 5,
      multiplier: 2,
      rateSen: 200,
      totalSen: 2000,
    });
  });

  it("defaults multiplier to 1 and rate to the baseline", () => {
    const result = calculateFidyah({ days: 3 });
    expect(result.multiplier).toBe(1);
    expect(result.rateSen).toBe(DEFAULT_FIDYAH_RATE_SEN);
    expect(result.totalSen).toBe(3 * DEFAULT_FIDYAH_RATE_SEN);
  });

  it("floors fractional days and multiplier", () => {
    const result = calculateFidyah({ days: 4.9, multiplier: 2.9, rateSen: 100 });
    expect(result.days).toBe(4);
    expect(result.multiplier).toBe(2);
    expect(result.totalSen).toBe(800);
  });

  it("clamps negative or zero days to zero", () => {
    expect(calculateFidyah({ days: -5, rateSen: 200 }).days).toBe(0);
    expect(calculateFidyah({ days: -5, rateSen: 200 }).totalSen).toBe(0);
    expect(calculateFidyah({ days: 0, rateSen: 200 }).totalSen).toBe(0);
  });

  it("clamps multiplier below 1 up to 1", () => {
    expect(calculateFidyah({ days: 2, multiplier: 0, rateSen: 200 }).multiplier).toBe(1);
    expect(calculateFidyah({ days: 2, multiplier: -3, rateSen: 200 }).multiplier).toBe(1);
  });

  it("treats NaN days/multiplier as their minimums", () => {
    const result = calculateFidyah({ days: NaN, multiplier: NaN, rateSen: 200 });
    expect(result.days).toBe(0);
    expect(result.multiplier).toBe(1);
    expect(result.totalSen).toBe(0);
  });
});
