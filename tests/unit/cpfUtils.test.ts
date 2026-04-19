import { describe, it, expect } from "vitest";
import { maskCpf, isValidCpf, stripCpf } from "@/lib/cpfUtils";

describe("maskCpf", () => {
  it("formats as 999.999.999-99", () => {
    expect(maskCpf("19119119100")).toBe("191.191.191-00");
  });
  it("keeps partial mask for incomplete input", () => {
    expect(maskCpf("1911911")).toBe("191.191.1");
  });
  it("strips non-digits before masking", () => {
    expect(maskCpf("191-191 191/00")).toBe("191.191.191-00");
  });
});

describe("stripCpf", () => {
  it("returns only digits", () => {
    expect(stripCpf("191.191.191-00")).toBe("19119119100");
  });
});

describe("isValidCpf", () => {
  it("accepts 11-digit strings", () => {
    expect(isValidCpf("19119119100")).toBe(true);
    expect(isValidCpf("191.191.191-00")).toBe(true);
  });
  it("rejects shorter input", () => {
    expect(isValidCpf("1911911910")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isValidCpf("")).toBe(false);
  });
});
