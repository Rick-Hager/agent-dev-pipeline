import { test, expect } from "@playwright/test";

const SENSITIVE_FIELDS = ["passwordHash", "stripeSecretKey", "whatsappApiConfig"];

test.describe("Restaurant API", () => {
  const ts = Date.now();
  const slug = `e2e-rest-${ts}`;
  const email = `e2e-${ts}@test.com`;

  // Track created restaurant id for cleanup via a second POST (not possible with GET only)
  // Cleanup is handled by using unique slugs per run; no DELETE endpoint exists yet.

  test("POST /api/restaurants creates a new restaurant and returns 201", async ({ request }) => {
    const res = await request.post("/api/restaurants", {
      data: {
        name: "E2E Test Restaurant",
        slug,
        email,
        password: "secret123",
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("E2E Test Restaurant");
    expect(body.slug).toBe(slug);
    expect(body.email).toBe(email);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  test("POST /api/restaurants response never contains sensitive fields", async ({ request }) => {
    const uniqueSlug = `e2e-sensitive-${ts}`;
    const uniqueEmail = `e2e-sensitive-${ts}@test.com`;

    const res = await request.post("/api/restaurants", {
      data: {
        name: "Sensitive Fields Test",
        slug: uniqueSlug,
        email: uniqueEmail,
        password: "secret123",
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    for (const field of SENSITIVE_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
  });

  test("GET /api/restaurants/[slug] returns the restaurant by slug with 200", async ({ request }) => {
    // First create the restaurant
    const createRes = await request.post("/api/restaurants", {
      data: {
        name: "E2E Get Test",
        slug: `e2e-get-${ts}`,
        email: `e2e-get-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(createRes.status()).toBe(201);

    // Then retrieve it by slug
    const getRes = await request.get(`/api/restaurants/e2e-get-${ts}`);
    expect(getRes.status()).toBe(200);

    const body = await getRes.json();
    expect(body.slug).toBe(`e2e-get-${ts}`);
    expect(body.name).toBe("E2E Get Test");
    expect(body.email).toBe(`e2e-get-${ts}@test.com`);
  });

  test("GET /api/restaurants/[slug] response never contains sensitive fields", async ({ request }) => {
    const uniqueSlug = `e2e-get-sens-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "Get Sensitive Test",
        slug: uniqueSlug,
        email: `e2e-get-sens-${ts}@test.com`,
        password: "secret123",
      },
    });

    const getRes = await request.get(`/api/restaurants/${uniqueSlug}`);
    expect(getRes.status()).toBe(200);

    const body = await getRes.json();
    for (const field of SENSITIVE_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
  });

  test("GET /api/restaurants/[slug] returns 404 for a non-existent slug", async ({ request }) => {
    const res = await request.get("/api/restaurants/this-slug-does-not-exist-e2e");
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants returns 400 when required fields are missing", async ({ request }) => {
    const res = await request.post("/api/restaurants", {
      data: {
        name: "Missing Fields",
        // slug, email, password are missing
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants returns 400 when name is missing", async ({ request }) => {
    const res = await request.post("/api/restaurants", {
      data: {
        slug: `e2e-no-name-${ts}`,
        email: `e2e-no-name-${ts}@test.com`,
        password: "secret123",
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("name");
  });

  test("POST /api/restaurants returns 400 when email is missing", async ({ request }) => {
    const res = await request.post("/api/restaurants", {
      data: {
        name: "No Email",
        slug: `e2e-no-email-${ts}`,
        password: "secret123",
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("email");
  });

  test("POST /api/restaurants returns 409 for duplicate slug", async ({ request }) => {
    const duplicateSlug = `e2e-dup-slug-${ts}`;

    // First create
    const first = await request.post("/api/restaurants", {
      data: {
        name: "First Restaurant",
        slug: duplicateSlug,
        email: `e2e-dup-slug-first-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(first.status()).toBe(201);

    // Duplicate slug with different email
    const second = await request.post("/api/restaurants", {
      data: {
        name: "Second Restaurant",
        slug: duplicateSlug,
        email: `e2e-dup-slug-second-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(second.status()).toBe(409);

    const body = await second.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants returns 409 for duplicate email", async ({ request }) => {
    const duplicateEmail = `e2e-dup-email-${ts}@test.com`;

    // First create
    const first = await request.post("/api/restaurants", {
      data: {
        name: "First Restaurant Email",
        slug: `e2e-dup-email-first-${ts}`,
        email: duplicateEmail,
        password: "secret123",
      },
    });
    expect(first.status()).toBe(201);

    // Duplicate email with different slug
    const second = await request.post("/api/restaurants", {
      data: {
        name: "Second Restaurant Email",
        slug: `e2e-dup-email-second-${ts}`,
        email: duplicateEmail,
        password: "secret123",
      },
    });
    expect(second.status()).toBe(409);

    const body = await second.json();
    expect(body.error).toBeDefined();
  });

  test("full E2E flow: create a restaurant via API and retrieve it by slug", async ({ request }) => {
    const flowSlug = `e2e-flow-${ts}`;
    const flowEmail = `e2e-flow-${ts}@test.com`;

    // Step 1: Create
    const createRes = await request.post("/api/restaurants", {
      data: {
        name: "Flow Restaurant",
        slug: flowSlug,
        email: flowEmail,
        password: "supersecret99",
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.slug).toBe(flowSlug);
    expect(created.email).toBe(flowEmail);
    for (const field of SENSITIVE_FIELDS) {
      expect(created).not.toHaveProperty(field);
    }

    // Step 2: Retrieve by slug
    const getRes = await request.get(`/api/restaurants/${flowSlug}`);
    expect(getRes.status()).toBe(200);

    const retrieved = await getRes.json();
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.slug).toBe(flowSlug);
    expect(retrieved.name).toBe("Flow Restaurant");
    expect(retrieved.email).toBe(flowEmail);
    for (const field of SENSITIVE_FIELDS) {
      expect(retrieved).not.toHaveProperty(field);
    }
  });
});
