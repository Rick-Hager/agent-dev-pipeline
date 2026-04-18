// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { PATCH as patchSettings, GET as getSettings } from "@/app/api/restaurants/[slug]/settings/route";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";
});

async function seed(opts: {
  accessToken?: string | null;
  publicKey?: string | null;
} = {}) {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurant.deleteMany();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
      mercadopagoAccessToken: opts.accessToken ?? null,
      mercadopagoPublicKey: opts.publicKey ?? null,
    },
  });
  const token = await signJwt({
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    email: restaurant.email,
  });
  return { restaurant, token };
}

function authed(url: string, init: RequestInit, token: string): NextRequest {
  const req = new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
  req.cookies.set(COOKIE_NAME, token);
  return req;
}

describe("PATCH /api/restaurants/[slug]/settings — MP Public Key", () => {
  it("accepts accessToken and publicKey together", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoAccessToken: "APP_USR_abc",
          mercadopagoPublicKey: "APP_USR_pk_xyz",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects setting only accessToken without publicKey (400)", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoAccessToken: "APP_USR_abc",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects setting only publicKey without accessToken (400)", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoPublicKey: "APP_USR_pk_xyz",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("allows patching other fields when both MP fields already exist", async () => {
    const { token } = await seed({
      accessToken: "APP_USR_existing",
      publicKey: "APP_USR_pk_existing",
    });
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET returns masked publicKey alongside masked accessToken", async () => {
    const { token } = await seed({
      accessToken: "APP_USR_abcdefgh1234",
      publicKey: "APP_USR_pk_ijklmnop5678",
    });
    const req = authed(
      "http://test/api/restaurants/test/settings",
      { method: "GET" },
      token
    );
    const res = await getSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.mercadopagoAccessTokenMasked).toBe("****1234");
    expect(data.mercadopagoPublicKeyMasked).toBe("****5678");
  });
});
