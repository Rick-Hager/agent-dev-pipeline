import { describe, it, expect } from "vitest";
import { validateRestaurantInput } from "@/lib/validation";

describe("validateRestaurantInput", () => {
  const validInput = {
    name: "Test Restaurant",
    slug: "test-restaurant",
    email: "owner@test.com",
    password: "secret123",
  };

  it("returns valid: true with data when all required fields are present", () => {
    const result = validateRestaurantInput(validInput);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.name).toBe("Test Restaurant");
      expect(result.data.slug).toBe("test-restaurant");
      expect(result.data.email).toBe("owner@test.com");
      expect(result.data.password).toBe("secret123");
    }
  });

  it("returns valid: false when name is missing", () => {
    const { name: _name, ...input } = validInput;
    const result = validateRestaurantInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("name");
    }
  });

  it("returns valid: false when slug is missing", () => {
    const { slug: _slug, ...input } = validInput;
    const result = validateRestaurantInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("slug");
    }
  });

  it("returns valid: false when email is missing", () => {
    const { email: _email, ...input } = validInput;
    const result = validateRestaurantInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("email");
    }
  });

  it("returns valid: false when password is missing", () => {
    const { password: _password, ...input } = validInput;
    const result = validateRestaurantInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("password");
    }
  });

  it("returns valid: false when name is an empty string", () => {
    const result = validateRestaurantInput({ ...validInput, name: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("name");
    }
  });

  it("returns valid: false when a field is not a string", () => {
    const result = validateRestaurantInput({ ...validInput, slug: 123 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("slug");
    }
  });

  it("returns valid: false when input is not an object", () => {
    const result = validateRestaurantInput(null);
    expect(result.valid).toBe(false);
  });

  it("returns valid: false when input is a non-object primitive", () => {
    const result = validateRestaurantInput("invalid");
    expect(result.valid).toBe(false);
  });
});
