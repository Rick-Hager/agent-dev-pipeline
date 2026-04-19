import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, Prisma } from "@prisma/client";
import {
  calculateOrderTotal,
  generateOrderNumber,
} from "@/lib/orderUtils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await request.json() as {
      customerName?: unknown;
      customerPhone?: unknown;
      customerEmail?: unknown;
      items?: unknown;
    };

    const { customerName, customerPhone, customerEmail, items } = body;

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json(
        { error: "customerName is required" },
        { status: 400 }
      );
    }

    if (!customerPhone || typeof customerPhone !== "string") {
      return NextResponse.json(
        { error: "customerPhone is required" },
        { status: 400 }
      );
    }

    if (
      !customerEmail ||
      typeof customerEmail !== "string" ||
      !EMAIL_RE.test(customerEmail)
    ) {
      return NextResponse.json(
        { error: "customerEmail is required and must be a valid email" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    type ItemInput = { menuItemId: string; quantity: number };
    const itemInputs = items as ItemInput[];

    // Validate all menu items exist and are available
    const menuItemIds = itemInputs.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId: restaurant.id,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        { error: "One or more menu items not found" },
        { status: 400 }
      );
    }

    const unavailable = menuItems.find((mi) => !mi.isAvailable);
    if (unavailable) {
      return NextResponse.json(
        { error: `Menu item "${unavailable.name}" is not available` },
        { status: 400 }
      );
    }

    // Calculate total
    const itemsWithPrice = itemInputs.map((input) => {
      const menuItem = menuItems.find((mi) => mi.id === input.menuItemId)!;
      return {
        priceInCents: menuItem.priceInCents,
        quantity: input.quantity,
        menuItemId: input.menuItemId,
        name: menuItem.name,
      };
    });

    const totalInCents = calculateOrderTotal(itemsWithPrice);

    // Generate order number and create order with P2002 retry
    const MAX_RETRIES = 3;
    let order = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const orderNumber = await generateOrderNumber(restaurant.id);

        order = await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            orderNumber,
            customerName,
            customerPhone,
            customerEmail,
            totalInCents,
            status: OrderStatus.CREATED,
            items: {
              create: itemsWithPrice.map((item) => ({
                menuItemId: item.menuItemId,
                name: item.name,
                priceInCents: item.priceInCents,
                quantity: item.quantity,
              })),
            },
          },
          include: { items: true },
        });

        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < MAX_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      throw new Error("Failed to create order after max retries");
    }

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        totalInCents: order.totalInCents,
        status: order.status,
        items: order.items,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/restaurants/[slug]/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const VALID_ORDER_STATUSES = new Set<string>([
  "CREATED",
  "PAYMENT_PENDING",
  "PAYMENT_APPROVED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "CANCELLED",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const statusParam = searchParams.get("status");
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // Validate status
    if (statusParam !== null && !VALID_ORDER_STATUSES.has(statusParam)) {
      return NextResponse.json(
        { error: `Invalid status value: ${statusParam}` },
        { status: 400 }
      );
    }

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 20;
    const skip = (page - 1) * limit;

    const where: {
      restaurantId: string;
      status?: OrderStatus;
      createdAt?: { gte?: Date; lte?: Date };
    } = { restaurantId: restaurant.id };

    if (statusParam !== null) {
      where.status = statusParam as OrderStatus;
    }

    if (dateFromParam !== null || dateToParam !== null) {
      where.createdAt = {};
      if (dateFromParam !== null) {
        where.createdAt.gte = new Date(`${dateFromParam}T00:00:00.000Z`);
      }
      if (dateToParam !== null) {
        where.createdAt.lte = new Date(`${dateToParam}T23:59:59.999Z`);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              name: true,
              priceInCents: true,
              quantity: true,
            },
          },
        },
        orderBy: { orderNumber: "asc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        totalInCents: order.totalInCents,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items,
      })),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error("GET /api/restaurants/[slug]/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
