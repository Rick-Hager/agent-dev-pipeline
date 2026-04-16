// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

const TEST_SLUG = "settings-int-test-restaurant";
const TEST_SLUG_2 = "settings-int-test-restaurant-2";
const TEST_EMAIL = "settings-int-test@test.com";
const TEST_EMAIL_2 = "settings-int-test-2@test.com";
const NEW_SLUG = "settings-int-test-new-slug";

let restaurantId: string;
let restaurantId2: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";
  const passwordHash = await hashPassword("testpassword123");

  const r1 = await prisma.restaurant.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, slug: TEST_SLUG },
    create: {
      name: "Settings Int Test Restaurant",
      slug: TEST_SLUG,
      email: TEST_EMAIL,
      passwordHash,
      stripeSecretKey: "sk_test_abcdef1234",
      stripePublishableKey: "pk_test_abcdef1234",
    },
  });
  restaurantId = r1.id;

  const r2 = await prisma.restaurant.upsert({
    where: { email: TEST_EMAIL_2 },
    update: { passwordHash, slug: TEST_SLUG_2 },
    create: {
      name: "Settings Int Test Restaurant 2",
      slug: TEST_SLUG_2,
      email: TEST_EMAIL_2,
      passwordHash,
    },
  });
  restaurantId2 = r2.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({
    where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } },
  });
  await prisma.restaurant.deleteMany({ where: { slug: NEW_SLUG } });
});

async function makeToken(id: string, slug: string, email: string): Promise<string> {
  return signJwt({ restaurantId: id, slug, email });
}

// ─── GET /api/restaurants/[slug]/settings ─────────────────────────────────────

describe("GET /api/restaurants/[slug]/settings", () => {
  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/settings/route");
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`
    );
    const res = await GET(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as different restaurant", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId2, TEST_SLUG_2, TEST_EMAIL_2);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      { headers: { cookie: `${COOKIE_NAME}=${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 with restaurant settings for authenticated owner", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      { headers: { cookie: `${COOKIE_NAME}=${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Settings Int Test Restaurant");
    expect(body.slug).toBe(TEST_SLUG);
    expect(body.email).toBe(TEST_EMAIL);
    expect(body.stripePublishableKey).toBe("pk_test_abcdef1234");
  });

  it("returns masked stripeSecretKey, never the full key", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      { headers: { cookie: `${COOKIE_NAME}=${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    // stripeSecretKeyMasked should be present and partially masked
    expect(body.stripeSecretKeyMasked).toBeDefined();
    expect(body.stripeSecretKeyMasked).not.toBe("sk_test_abcdef1234");
    expect(body.stripeSecretKeyMasked).toContain("1234");
    // Full secret key must never appear
    expect(body.stripeSecretKey).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
  });
});

// ─── PATCH /api/restaurants/[slug]/settings ───────────────────────────────────

describe("PATCH /api/restaurants/[slug]/settings", () => {
  afterEach(async () => {
    // Reset restaurant to known state after each test
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name: "Settings Int Test Restaurant",
        slug: TEST_SLUG,
        logo: null,
        businessHours: null,
        stripePublishableKey: "pk_test_abcdef1234",
        stripeSecretKey: "sk_test_abcdef1234",
        whatsappNumber: null,
        whatsappMessageTemplate: null,
      },
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hacked Name" }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as different restaurant", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId2, TEST_SLUG_2, TEST_EMAIL_2);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ name: "Hacked Name" }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    expect(res.status).toBe(403);
  });

  it("updates name and logo successfully", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          name: "Updated Name",
          logo: "https://example.com/logo.png",
        }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated Name");
    expect(body.logo).toBe("https://example.com/logo.png");
    // Sensitive fields must never be in response
    expect(body.passwordHash).toBeUndefined();
    expect(body.stripeSecretKey).toBeUndefined();
  });

  it("allows keeping the same slug", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ slug: TEST_SLUG }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    expect(res.status).toBe(200);
  });

  it("returns 409 when slug is already taken by another restaurant", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ slug: TEST_SLUG_2 }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBeDefined();
  });

  it("updates slug to a new unique slug", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ slug: NEW_SLUG }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.slug).toBe(NEW_SLUG);

    // The afterEach will restore the slug via restaurantId
  });

  it("never updates passwordHash even if sent in body", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const originalPasswordHash = (
      await prisma.restaurant.findUnique({ where: { id: restaurantId } })
    )!.passwordHash;

    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ passwordHash: "evil-hash", name: "Updated" }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });

    // Request should succeed (passwordHash just ignored)
    expect([200, 400]).toContain(res.status);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    expect(restaurant!.passwordHash).toBe(originalPasswordHash);
    expect(restaurant!.passwordHash).not.toBe("evil-hash");
  });

  it("updates stripePublishableKey and stripeSecretKey", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          stripePublishableKey: "pk_live_newkey123",
          stripeSecretKey: "sk_live_newkey456",
        }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stripePublishableKey).toBe("pk_live_newkey123");
    // stripeSecretKey must NOT appear in response
    expect(body.stripeSecretKey).toBeUndefined();

    // Verify it was actually saved
    const stored = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(stored!.stripeSecretKey).toBe("sk_live_newkey456");
  });

  it("updates whatsappNumber and whatsappMessageTemplate", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          whatsappNumber: "+5511999990000",
          whatsappMessageTemplate: "Pedido {orderNumber} pronto!",
        }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.whatsappNumber).toBe("+5511999990000");
    expect(body.whatsappMessageTemplate).toBe("Pedido {orderNumber} pronto!");
  });

  it("updates businessHours as JSON", async () => {
    const { PATCH } = await import("@/app/api/restaurants/[slug]/settings/route");
    const token = await makeToken(restaurantId, TEST_SLUG, TEST_EMAIL);
    const businessHours = { mon: "9:00-22:00", tue: "9:00-22:00" };
    const req = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ businessHours }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.businessHours).toEqual(businessHours);
  });
});
