import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { deleteMenuItemImage } from "@/lib/blob";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string; itemId: string; imageId: string }>;
  }
) {
  try {
    const { slug, itemId, imageId } = await params;

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

    const image = await prisma.menuItemImage.findFirst({
      where: { id: imageId, menuItemId: itemId },
    });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    try {
      await deleteMenuItemImage(image.url);
    } catch (error) {
      console.error("Blob delete failed (continuing):", error);
    }

    await prisma.menuItemImage.delete({ where: { id: imageId } });

    const remaining = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    await Promise.all(
      remaining.map((img, idx) =>
        img.sortOrder === idx
          ? Promise.resolve()
          : prisma.menuItemImage.update({
              where: { id: img.id },
              data: { sortOrder: idx },
            })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "DELETE /api/restaurants/[slug]/menu-items/[itemId]/images/[imageId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
