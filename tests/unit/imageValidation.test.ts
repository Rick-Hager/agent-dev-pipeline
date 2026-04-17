import { describe, it, expect } from "vitest";
import {
  MAX_IMAGES_PER_ITEM,
  MAX_IMAGE_SIZE_BYTES,
  validateImageUpload,
  canAddImage,
  validateReorderIds,
} from "@/lib/imageValidation";

describe("validateImageUpload", () => {
  it("returns valid for a JPEG within size limit", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: 1024 });
    expect(result.valid).toBe(true);
  });

  it("returns valid for a PNG within size limit", () => {
    const result = validateImageUpload({ type: "image/png", size: 2048 });
    expect(result.valid).toBe(true);
  });

  it("returns valid for a WEBP within size limit", () => {
    const result = validateImageUpload({ type: "image/webp", size: 500 });
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported types like GIF", () => {
    const result = validateImageUpload({ type: "image/gif", size: 1024 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/type/i);
  });

  it("rejects SVG", () => {
    const result = validateImageUpload({ type: "image/svg+xml", size: 1024 });
    expect(result.valid).toBe(false);
  });

  it("rejects non-image types", () => {
    const result = validateImageUpload({ type: "application/pdf", size: 1024 });
    expect(result.valid).toBe(false);
  });

  it("rejects file larger than 5MB", () => {
    const result = validateImageUpload({
      type: "image/jpeg",
      size: MAX_IMAGE_SIZE_BYTES + 1,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/size|5MB/i);
  });

  it("accepts file exactly at 5MB limit", () => {
    const result = validateImageUpload({
      type: "image/jpeg",
      size: MAX_IMAGE_SIZE_BYTES,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects zero-byte file", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: 0 });
    expect(result.valid).toBe(false);
  });
});

describe("canAddImage", () => {
  it("allows adding when current count is 0", () => {
    expect(canAddImage(0).valid).toBe(true);
  });

  it("allows adding when current count is 4", () => {
    expect(canAddImage(4).valid).toBe(true);
  });

  it(`rejects when current count is at limit (${MAX_IMAGES_PER_ITEM})`, () => {
    const result = canAddImage(MAX_IMAGES_PER_ITEM);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/maximum|limit|5/i);
  });

  it("rejects when current count exceeds limit", () => {
    const result = canAddImage(MAX_IMAGES_PER_ITEM + 1);
    expect(result.valid).toBe(false);
  });

  it("exposes MAX_IMAGES_PER_ITEM = 5", () => {
    expect(MAX_IMAGES_PER_ITEM).toBe(5);
  });
});

describe("validateReorderIds", () => {
  it("is valid when reorder list matches existing ids (same set)", () => {
    const existing = ["a", "b", "c"];
    const result = validateReorderIds(["c", "a", "b"], existing);
    expect(result.valid).toBe(true);
  });

  it("is invalid when reorder list is missing an id", () => {
    const existing = ["a", "b", "c"];
    const result = validateReorderIds(["a", "b"], existing);
    expect(result.valid).toBe(false);
  });

  it("is invalid when reorder list has an unknown id", () => {
    const existing = ["a", "b", "c"];
    const result = validateReorderIds(["a", "b", "d"], existing);
    expect(result.valid).toBe(false);
  });

  it("is invalid when reorder list has duplicates", () => {
    const existing = ["a", "b", "c"];
    const result = validateReorderIds(["a", "a", "b"], existing);
    expect(result.valid).toBe(false);
  });

  it("is invalid when reorder list is not an array", () => {
    const existing = ["a"];
    const result = validateReorderIds("not-array" as unknown as string[], existing);
    expect(result.valid).toBe(false);
  });
});
