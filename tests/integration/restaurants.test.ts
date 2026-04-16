import { describe, it, expect, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const TEST_SLUGS = ["integration-test-restaurant", "integration-test-duplicate"];

afterAll(async () => {
  await prisma.restaurant.deleteMany({
    where: { slug: { in: TEST_SLUGS } },
  });
});

// ─── POST /api/restaurants ────────────────────────────────────────────────────

describe("POST /api/restaurants", () => {
  afterEach(async () => {
    await prisma.restaurant.deleteMany({
      where: { slug: { in: TEST_SLUGS } },
    });
  });

  it("creates a restaurant and returns 201 with safe fields", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const request = new NextRequest("http://localhost:3000/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Integration Test Restaurant",
        slug: "integration-test-restaurant",
        email: "owner@integration-test.com",
        password: "secret123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Integration Test Restaurant");
    expect(body.slug).toBe("integration-test-restaurant");
    expect(body.email).toBe("owner@integration-test.com");
    expect(body.id).toBeDefined();

    // Sensitive fields must never be returned
    expect(body.passwordHash).toBeUndefined();
    expect(body.stripeSecretKey).toBeUndefined();
    expect(body.whatsappApiConfig).toBeUndefined();
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const request = new NextRequest("http://localhost:3000/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Slug Restaurant" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when body is empty", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const request = new NextRequest("http://localhost:3000/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const payload = {
      name: "Duplicate Slug",
      slug: "integration-test-duplicate",
      email: "first@integration-test.com",
      password: "secret123",
    };

    // Create first restaurant
    const first = await POST(
      new NextRequest("http://localhost:3000/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    expect(first.status).toBe(201);

    // Attempt to create second with same slug but different email
    const second = await POST(
      new NextRequest("http://localhost:3000/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, email: "second@integration-test.com" }),
      })
    );
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(body.error).toBeDefined();
  });

  it("returns 409 when email already exists", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const payload = {
      name: "Duplicate Email",
      slug: "integration-test-duplicate",
      email: "duplicate@integration-test.com",
      password: "secret123",
    };

    // Create first restaurant
    const first = await POST(
      new NextRequest("http://localhost:3000/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    expect(first.status).toBe(201);

    // Attempt to create second with same email but different slug
    const second = await POST(
      new NextRequest("http://localhost:3000/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          slug: "integration-test-restaurant",
        }),
      })
    );
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(body.error).toBeDefined();
  });

  it("does not include passwordHash in the response body", async () => {
    const { POST } = await import("@/app/api/restaurants/route");

    const request = new NextRequest("http://localhost:3000/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Safe Fields Test",
        slug: "integration-test-restaurant",
        email: "safe@integration-test.com",
        password: "secret123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(Object.keys(body)).not.toContain("passwordHash");
    expect(Object.keys(body)).not.toContain("stripeSecretKey");
    expect(Object.keys(body)).not.toContain("whatsappApiConfig");
  });
});

// ─── GET /api/restaurants/[slug] ─────────────────────────────────────────────

describe("GET /api/restaurants/[slug]", () => {
  const TEST_SLUG = "integration-test-restaurant";

  afterEach(async () => {
    await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
  });

  it("returns 200 with restaurant data for a valid slug", async () => {
    // Seed a restaurant directly via Prisma
    await prisma.restaurant.create({
      data: {
        name: "GET Test Restaurant",
        slug: TEST_SLUG,
        email: "get@integration-test.com",
        passwordHash: "hashed-password-placeholder",
      },
    });

    const { GET } = await import("@/app/api/restaurants/[slug]/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slug).toBe(TEST_SLUG);
    expect(body.name).toBe("GET Test Restaurant");
    expect(body.email).toBe("get@integration-test.com");
  });

  it("returns 404 when the slug does not exist", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/route");

    const request = new NextRequest(
      "http://localhost:3000/api/restaurants/does-not-exist"
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("does not include passwordHash in the response body", async () => {
    await prisma.restaurant.create({
      data: {
        name: "Safe GET Test",
        slug: TEST_SLUG,
        email: "safeget@integration-test.com",
        passwordHash: "hashed-password-placeholder",
      },
    });

    const { GET } = await import("@/app/api/restaurants/[slug]/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body)).not.toContain("passwordHash");
    expect(Object.keys(body)).not.toContain("stripeSecretKey");
    expect(Object.keys(body)).not.toContain("whatsappApiConfig");
  });
});
