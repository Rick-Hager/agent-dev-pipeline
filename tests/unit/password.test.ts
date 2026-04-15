import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("returns a hashed string different from the plain password", async () => {
    const plain = "secret123";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("produces different hashes for the same input (unique salts)", async () => {
    const plain = "secret123";
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true when plain password matches hash", async () => {
    const plain = "mypassword";
    const hash = await hashPassword(plain);
    const result = await verifyPassword(plain, hash);
    expect(result).toBe(true);
  });

  it("returns false when plain password does not match hash", async () => {
    const plain = "mypassword";
    const hash = await hashPassword(plain);
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });
});
