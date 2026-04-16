import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validatePriceInCents } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; itemId: string }> }
) {
  try {
    const { slug, id, itemId } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const category = await prisma.category.findFirst({
      where: { id, restaurantId: restaurant.id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, categoryId: category.id, restaurantId: restaurant.id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      priceInCents,
      description,
      imageUrl,
      isAvailable,
      sortOrder,
    } = body as {
      name?: string;
      priceInCents?: unknown;
      description?: string;
      imageUrl?: string;
      isAvailable?: boolean;
      sortOrder?: number;
    };

    if (priceInCents !== undefined) {
      const priceValidation = validatePriceInCents(priceInCents);
      if (!priceValidation.valid) {
        return NextResponse.json(
          { error: priceValidation.error },
          { status: 400 }
        );
      }
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(priceInCents !== undefined && { priceInCents: priceInCents as number }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error(
      "PUT /api/restaurants/[slug]/categories/[id]/items/[itemId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; itemId: string }> }
) {
  try {
    const { slug, id, itemId } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const category = await prisma.category.findFirst({
      where: { id, restaurantId: restaurant.id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, categoryId: category.id, restaurantId: restaurant.id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "DELETE /api/restaurants/[slug]/categories/[id]/items/[itemId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
