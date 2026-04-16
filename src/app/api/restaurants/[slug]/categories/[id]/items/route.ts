import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validatePriceInCents } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;

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

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const priceValidation = validatePriceInCents(priceInCents);
    if (!priceValidation.valid) {
      return NextResponse.json(
        { error: priceValidation.error },
        { status: 400 }
      );
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: name.trim(),
        priceInCents: priceInCents as number,
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/restaurants/[slug]/categories/[id]/items error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
