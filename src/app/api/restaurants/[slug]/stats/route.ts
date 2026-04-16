import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { OrderStatus } from "@prisma/client";

const TODAY_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_APPROVED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
];

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    if (auth.slug !== slug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );

    const todayWhere = {
      restaurantId: restaurant.id,
      status: { in: TODAY_STATUSES },
      createdAt: { gte: startOfToday, lte: endOfToday },
    };

    const activeWhere = {
      restaurantId: restaurant.id,
      status: { in: ACTIVE_STATUSES },
    };

    const [todayAggregate, activeCount] = await Promise.all([
      prisma.order.aggregate({
        where: todayWhere,
        _count: { id: true },
        _sum: { totalInCents: true },
      }),
      prisma.order.count({ where: activeWhere }),
    ]);

    return NextResponse.json({
      slug,
      ordersToday: todayAggregate._count.id,
      revenueToday: todayAggregate._sum.totalInCents ?? 0,
      activeOrders: activeCount,
    });
  } catch (error) {
    console.error("GET /api/restaurants/[slug]/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
