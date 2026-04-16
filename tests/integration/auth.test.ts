// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { COOKIE_NAME } from "@/lib/auth";

const TEST_EMAIL = "auth-integration-test@test.com";
const TEST_PASSWORD = "testpassword123";
const TEST_SLUG = "auth-integration-test-restaurant";

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await prisma.restaurant.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      name: "Auth Integration Test Restaurant",
      slug: TEST_SLUG,
      email: TEST_EMAIL,
      passwordHash,
    },
  });
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { email: TEST_EMAIL } });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns 200 and sets cookie on valid credentials", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe(TEST_EMAIL);
    expect(body.slug).toBe(TEST_SLUG);
    expect(body.id).toBeDefined();
    expect(body.name).toBeDefined();
    expect(body.passwordHash).toBeUndefined();

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(COOKIE_NAME);
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns 401 for invalid email", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@test.com",
        password: TEST_PASSWORD,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 401 for wrong password", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "wrongpassword" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the session cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");

    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(COOKIE_NAME);
    expect(setCookie).toContain("Max-Age=0");
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns 200 with restaurant data when authenticated", async () => {
    const { signJwt } = await import("@/lib/auth");
    const { GET } = await import("@/app/api/auth/me/route");

    const restaurant = await prisma.restaurant.findUnique({
      where: { email: TEST_EMAIL },
    });

    const token = await signJwt({
      restaurantId: restaurant!.id,
      slug: restaurant!.slug,
      email: restaurant!.email,
    });

    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe(TEST_EMAIL);
    expect(body.slug).toBe(TEST_SLUG);
    expect(body.id).toBeDefined();
    expect(body.name).toBeDefined();
    expect(body.passwordHash).toBeUndefined();
  });

  it("returns 401 when no cookie is present", async () => {
    const { GET } = await import("@/app/api/auth/me/route");

    const request = new NextRequest("http://localhost:3000/api/auth/me");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when cookie has invalid JWT", async () => {
    const { GET } = await import("@/app/api/auth/me/route");

    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${COOKIE_NAME}=invalid.jwt.token` },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
