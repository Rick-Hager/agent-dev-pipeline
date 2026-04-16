import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

const SAFE_SELECT = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  email: true,
  businessHours: true,
  stripePublishableKey: true,
  whatsappNumber: true,
  whatsappMessageTemplate: true,
  updatedAt: true,
} as const;

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await getAuthFromRequest(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    if (restaurant.id !== auth.restaurantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logo: restaurant.logo,
      email: restaurant.email,
      businessHours: restaurant.businessHours,
      stripePublishableKey: restaurant.stripePublishableKey,
      stripeSecretKeyMasked: maskSecret(restaurant.stripeSecretKey),
      whatsappNumber: restaurant.whatsappNumber,
      whatsappMessageTemplate: restaurant.whatsappMessageTemplate,
      updatedAt: restaurant.updatedAt,
    });
  } catch (error) {
    console.error("GET /api/restaurants/[slug]/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await getAuthFromRequest(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    if (restaurant.id !== auth.restaurantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    // Validate slug uniqueness if slug is being changed
    const newSlug = typeof input.slug === "string" ? input.slug : undefined;
    if (newSlug !== undefined && newSlug !== slug) {
      const existing = await prisma.restaurant.findUnique({
        where: { slug: newSlug },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Slug already taken" },
          { status: 409 }
        );
      }
    }

    // Build update — only allowed fields; passwordHash is never touched
    const updateData: Record<string, unknown> = {};

    if (typeof input.name === "string" && input.name.trim().length > 0) {
      updateData.name = input.name.trim();
    }
    if (newSlug !== undefined) {
      updateData.slug = newSlug;
    }
    if (input.logo !== undefined) {
      updateData.logo = typeof input.logo === "string" && input.logo.length > 0
        ? input.logo
        : null;
    }
    if (input.businessHours !== undefined) {
      updateData.businessHours = input.businessHours ?? null;
    }
    if (input.stripePublishableKey !== undefined) {
      updateData.stripePublishableKey =
        typeof input.stripePublishableKey === "string" &&
        input.stripePublishableKey.length > 0
          ? input.stripePublishableKey
          : null;
    }
    if (
      typeof input.stripeSecretKey === "string" &&
      input.stripeSecretKey.length > 0
    ) {
      updateData.stripeSecretKey = input.stripeSecretKey;
    }
    if (input.whatsappNumber !== undefined) {
      updateData.whatsappNumber =
        typeof input.whatsappNumber === "string" &&
        input.whatsappNumber.length > 0
          ? input.whatsappNumber
          : null;
    }
    if (input.whatsappMessageTemplate !== undefined) {
      updateData.whatsappMessageTemplate =
        typeof input.whatsappMessageTemplate === "string" &&
        input.whatsappMessageTemplate.length > 0
          ? input.whatsappMessageTemplate
          : null;
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: updateData,
      select: SAFE_SELECT,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/restaurants/[slug]/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
