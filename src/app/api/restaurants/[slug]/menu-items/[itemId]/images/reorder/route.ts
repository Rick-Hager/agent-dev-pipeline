import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { validateReorderIds } from "@/lib/imageValidation";

export async function PATCH(
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

    const body = (await request.json()) as { ids?: unknown };
    const existing = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      select: { id: true },
    });
    const existingIds = existing.map((e) => e.id);

    const check = validateReorderIds(body.ids, existingIds);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const ids = body.ids as string[];
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.menuItemImage.update({
          where: { id },
          data: { sortOrder: idx },
        })
      )
    );

    const updated = await prisma.menuItemImage.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "PATCH /api/restaurants/[slug]/menu-items/[itemId]/images/reorder error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
