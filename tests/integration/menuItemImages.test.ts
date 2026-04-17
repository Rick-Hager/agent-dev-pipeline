// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

// Mock the blob module so tests don't hit Vercel Blob
vi.mock("@/lib/blob", () => ({
  uploadMenuItemImage: vi.fn(async (filename: string) => ({
    url: `https://blob.test/${filename}-${Math.random().toString(36).slice(2)}`,
    pathname: filename,
  })),
  deleteMenuItemImage: vi.fn(async () => {}),
}));

const TEST_SLUG = "image-test-restaurant";
const OTHER_SLUG = "image-test-other";

let restaurantId: string;
let otherRestaurantId: string;
let categoryId: string;
let otherCategoryId: string;
let authCookie: string;
let otherAuthCookie: string;

async function buildAuthCookie(
  restaurant: { id: string; slug: string; email: string }
): Promise<string> {
  const token = await signJwt({
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    email: restaurant.email,
  });
  return `${COOKIE_NAME}=${token}`;
}

function makeFormDataRequest(
  url: string,
  file: Blob,
  fieldName = "file",
  cookie?: string
): NextRequest {
  const fd = new FormData();
  fd.append(fieldName, file, "test.jpg");
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest(url, {
    method: "POST",
    body: fd,
    headers,
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET ??= "test-jwt-secret";

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Image Test Restaurant",
      slug: TEST_SLUG,
      email: "image-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantId = restaurant.id;

  const other = await prisma.restaurant.create({
    data: {
      name: "Other Image Restaurant",
      slug: OTHER_SLUG,
      email: "image-test-other@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  otherRestaurantId = other.id;

  const category = await prisma.category.create({
    data: { restaurantId, name: "Images Category", sortOrder: 0 },
  });
  categoryId = category.id;

  const otherCategory = await prisma.category.create({
    data: { restaurantId: otherRestaurantId, name: "Other Category", sortOrder: 0 },
  });
  otherCategoryId = otherCategory.id;

  authCookie = await buildAuthCookie({
    id: restaurantId,
    slug: TEST_SLUG,
    email: "image-test@integration-test.com",
  });
  otherAuthCookie = await buildAuthCookie({
    id: otherRestaurantId,
    slug: OTHER_SLUG,
    email: "image-test-other@integration-test.com",
  });
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
  await prisma.restaurant.deleteMany({ where: { slug: OTHER_SLUG } });
});

async function createItem(name: string): Promise<string> {
  const item = await prisma.menuItem.create({
    data: { restaurantId, categoryId, name, priceInCents: 1000, sortOrder: 0 },
  });
  return item.id;
}

async function createOtherItem(): Promise<string> {
  const item = await prisma.menuItem.create({
    data: {
      restaurantId: otherRestaurantId,
      categoryId: otherCategoryId,
      name: "Other Item",
      priceInCents: 1000,
      sortOrder: 0,
    },
  });
  return item.id;
}

// ─── POST /api/restaurants/[slug]/menu-items/[itemId]/images ─────────────────

describe("POST /api/restaurants/[slug]/menu-items/[itemId]/images", () => {
  let itemId: string;

  beforeEach(async () => {
    itemId = await createItem(`item-${Date.now()}-${Math.random()}`);
  });

  it("returns 401 when no auth cookie is provided", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 when JWT tenant doesn't match the slug", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file,
      "file",
      otherAuthCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(403);
  });

  it("uploads an image and creates MenuItemImage record", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file,
      "file",
      authCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.url).toMatch(/blob\.test/);
    expect(body.sortOrder).toBe(0);
    expect(body.menuItemId).toBe(itemId);

    const stored = await prisma.menuItemImage.findMany({ where: { menuItemId: itemId } });
    expect(stored).toHaveLength(1);
  });

  it("assigns sortOrder sequentially for additional uploads", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    for (let i = 0; i < 3; i++) {
      const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
      const request = makeFormDataRequest(
        `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
        file,
        "file",
        authCookie
      );
      await POST(request, {
        params: Promise.resolve({ slug: TEST_SLUG, itemId }),
      });
    }

    const stored = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    expect(stored).toHaveLength(3);
    expect(stored.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it("rejects upload when item already has 5 images", async () => {
    for (let i = 0; i < 5; i++) {
      await prisma.menuItemImage.create({
        data: { menuItemId: itemId, url: `https://blob.test/x${i}`, sortOrder: i },
      });
    }
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file,
      "file",
      authCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/maximum|5/i);
  });

  it("rejects unsupported file type", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["abc"], { type: "image/gif" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file,
      "file",
      authCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects file larger than 5MB", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const bigBuffer = new Uint8Array(5 * 1024 * 1024 + 10);
    const file = new Blob([bigBuffer], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      file,
      "file",
      authCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 when item doesn't belong to restaurant", async () => {
    const foreignItemId = await createOtherItem();
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const file = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const request = makeFormDataRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${foreignItemId}/images`,
      file,
      "file",
      authCookie
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId: foreignItemId }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 when no file is provided", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/route"
    );
    const fd = new FormData();
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images`,
      { method: "POST", body: fd, headers: { cookie: authCookie } }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(400);
  });
});

// ─── DELETE /api/restaurants/[slug]/menu-items/[itemId]/images/[imageId] ─────

describe("DELETE /api/restaurants/[slug]/menu-items/[itemId]/images/[imageId]", () => {
  let itemId: string;
  let imageId: string;

  beforeEach(async () => {
    itemId = await createItem(`del-${Date.now()}-${Math.random()}`);
    const image = await prisma.menuItemImage.create({
      data: { menuItemId: itemId, url: "https://blob.test/del.jpg", sortOrder: 0 },
    });
    imageId = image.id;
  });

  it("returns 401 without auth", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/[imageId]/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/${imageId}`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId, imageId }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 when JWT tenant doesn't match slug", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/[imageId]/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/${imageId}`,
      { method: "DELETE", headers: { cookie: otherAuthCookie } }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId, imageId }),
    });
    expect(response.status).toBe(403);
  });

  it("deletes the image record", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/[imageId]/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/${imageId}`,
      { method: "DELETE", headers: { cookie: authCookie } }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId, imageId }),
    });
    expect(response.status).toBe(200);
    const remaining = await prisma.menuItemImage.findUnique({ where: { id: imageId } });
    expect(remaining).toBeNull();
  });

  it("returns 404 if image doesn't exist", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/[imageId]/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/nonexistent`,
      { method: "DELETE", headers: { cookie: authCookie } }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({
        slug: TEST_SLUG,
        itemId,
        imageId: "nonexistent",
      }),
    });
    expect(response.status).toBe(404);
  });
});

// ─── PATCH /api/restaurants/[slug]/menu-items/[itemId]/images/reorder ────────

describe("PATCH /api/restaurants/[slug]/menu-items/[itemId]/images/reorder", () => {
  let itemId: string;
  let ids: string[];

  beforeEach(async () => {
    itemId = await createItem(`reorder-${Date.now()}-${Math.random()}`);
    ids = [];
    for (let i = 0; i < 3; i++) {
      const img = await prisma.menuItemImage.create({
        data: {
          menuItemId: itemId,
          url: `https://blob.test/r${i}.jpg`,
          sortOrder: i,
        },
      });
      ids.push(img.id);
    }
  });

  it("returns 401 without auth", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/reorder/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/reorder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(401);
  });

  it("reorders images correctly", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/reorder/route"
    );
    const newOrder = [ids[2], ids[0], ids[1]];
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/reorder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ ids: newOrder }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(200);

    const stored = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    expect(stored.map((s) => s.id)).toEqual(newOrder);
    expect(stored.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it("returns 400 if ids don't match existing images", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/menu-items/[itemId]/images/reorder/route"
    );
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu-items/${itemId}/images/reorder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ ids: ["fake-1", "fake-2", "fake-3"] }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, itemId }),
    });
    expect(response.status).toBe(400);
  });
});
