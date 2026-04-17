import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { uploadMenuItemImage } from "@/lib/blob";
import {
  canAddImage,
  validateImageUpload,
} from "@/lib/imageValidation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await params;

    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.slug !== slug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId: auth.restaurantId },
    });
    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    const limitCheck = canAddImage(existing.length);
    if (!limitCheck.valid) {
      return NextResponse.json({ error: limitCheck.error }, { status: 400 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    const file = fileEntry as File;

    const fileCheck = validateImageUpload({
      type: file.type,
      size: file.size,
    });
    if (!fileCheck.valid) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 });
    }

    const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
    const pathname = `menu-items/${itemId}/${safeName}`;

    const uploaded = await uploadMenuItemImage(pathname, file, {
      contentType: file.type,
    });

    const nextSortOrder = existing.length;
    const image = await prisma.menuItemImage.create({
      data: {
        menuItemId: itemId,
        url: uploaded.url,
        sortOrder: nextSortOrder,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/restaurants/[slug]/menu-items/[itemId]/images error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await params;

    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.slug !== slug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId: auth.restaurantId },
    });
    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const images = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(images);
  } catch (error) {
    console.error(
      "GET /api/restaurants/[slug]/menu-items/[itemId]/images error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
