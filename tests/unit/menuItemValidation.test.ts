import { describe, it, expect } from "vitest";
import { validatePriceInCents } from "@/lib/validation";

describe("validatePriceInCents", () => {
  it("returns valid for a positive integer (100)", () => {
    const result = validatePriceInCents(100);
    expect(result.valid).toBe(true);
  });

  it("returns valid for the minimum positive integer (1)", () => {
    const result = validatePriceInCents(1);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for zero", () => {
    const result = validatePriceInCents(0);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for a negative number", () => {
    const result = validatePriceInCents(-1);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for a float (9.99)", () => {
    const result = validatePriceInCents(9.99);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for a string ('abc')", () => {
    const result = validatePriceInCents("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for null", () => {
    const result = validatePriceInCents(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for undefined", () => {
    const result = validatePriceInCents(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns invalid for a non-integer float (1.5)", () => {
    const result = validatePriceInCents(1.5);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });
});
