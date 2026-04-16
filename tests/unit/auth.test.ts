// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";
});

describe("signJwt", () => {
  it("creates a JWT string", async () => {
    const { signJwt } = await import("@/lib/auth");
    const token = await signJwt({
      restaurantId: "abc123",
      slug: "my-restaurant",
      email: "owner@test.com",
    });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT has 3 parts
  });
});

describe("verifyJwt", () => {
  it("returns payload for a valid token", async () => {
    const { signJwt, verifyJwt } = await import("@/lib/auth");
    const payload = {
      restaurantId: "abc123",
      slug: "my-restaurant",
      email: "owner@test.com",
    };
    const token = await signJwt(payload);
    const result = await verifyJwt(token);
    expect(result).not.toBeNull();
    expect(result?.restaurantId).toBe(payload.restaurantId);
    expect(result?.slug).toBe(payload.slug);
    expect(result?.email).toBe(payload.email);
  });

  it("returns null for invalid token", async () => {
    const { verifyJwt } = await import("@/lib/auth");
    const result = await verifyJwt("this.is.notvalid");
    expect(result).toBeNull();
  });

  it("returns null for expired token", async () => {
    const { SignJWT } = await import("jose");
    const { verifyJwt } = await import("@/lib/auth");

    const secret = new TextEncoder().encode(
      "test-secret-that-is-at-least-32-chars-long"
    );
    const expiredToken = await new SignJWT({
      restaurantId: "abc123",
      slug: "my-restaurant",
      email: "owner@test.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);

    const result = await verifyJwt(expiredToken);
    expect(result).toBeNull();
  });
});

describe("getAuthFromRequest", () => {
  it("returns payload when valid cookie is present", async () => {
    const { signJwt, getAuthFromRequest, COOKIE_NAME } = await import(
      "@/lib/auth"
    );
    const payload = {
      restaurantId: "abc123",
      slug: "my-restaurant",
      email: "owner@test.com",
    };
    const token = await signJwt(payload);

    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    });

    const result = await getAuthFromRequest(request);
    expect(result).not.toBeNull();
    expect(result?.restaurantId).toBe(payload.restaurantId);
    expect(result?.slug).toBe(payload.slug);
    expect(result?.email).toBe(payload.email);
  });

  it("returns null when no cookie is present", async () => {
    const { getAuthFromRequest } = await import("@/lib/auth");
    const request = new NextRequest("http://localhost:3000/api/auth/me");
    const result = await getAuthFromRequest(request);
    expect(result).toBeNull();
  });
});
