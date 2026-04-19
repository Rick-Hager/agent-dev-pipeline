import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import {
  DashboardView,
  computeConversionRate,
} from "@/components/admin/DashboardView";

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

const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_APPROVED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  if (!auth) {
    redirect("/backoffice/login");
  }

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const endOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );

  const todayWhere = {
    restaurantId: auth.restaurantId,
    status: { in: TODAY_STATUSES },
    createdAt: { gte: startOfToday, lte: endOfToday },
  };

  const [todayAggregate, activeOrders, pendingPayments, createdTodayTotal, paidTodayCount, restaurant] =
    await Promise.all([
      prisma.order.aggregate({
        where: todayWhere,
        _count: { id: true },
        _sum: { totalInCents: true },
      }),
      prisma.order.count({
        where: {
          restaurantId: auth.restaurantId,
          status: { in: ACTIVE_STATUSES },
        },
      }),
      prisma.order.count({
        where: {
          restaurantId: auth.restaurantId,
          status: OrderStatus.PAYMENT_PENDING,
        },
      }),
      prisma.order.count({
        where: {
          restaurantId: auth.restaurantId,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.order.count({
        where: {
          restaurantId: auth.restaurantId,
          status: { in: PAID_STATUSES },
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.restaurant.findUnique({
        where: { id: auth.restaurantId },
        select: { mercadopagoAccessToken: true },
      }),
    ]);

  const stats = {
    ordersToday: todayAggregate._count.id,
    revenueTodayInCents: todayAggregate._sum.totalInCents ?? 0,
    activeOrders,
    pendingPayments,
    conversionRatePercent: computeConversionRate(
      paidTodayCount,
      createdTodayTotal
    ),
  };

  const mercadopagoConfigured = Boolean(
    restaurant?.mercadopagoAccessToken && restaurant.mercadopagoAccessToken.length > 0
  );

  return (
    <DashboardView
      slug={auth.slug}
      stats={stats}
      mercadopagoConfigured={mercadopagoConfigured}
    />
  );
}
