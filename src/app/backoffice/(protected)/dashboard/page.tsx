import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/admin/StatCard";
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

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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

  const activeWhere = {
    restaurantId: auth.restaurantId,
    status: { in: ACTIVE_STATUSES },
  };

  const [todayAggregate, activeOrders] = await Promise.all([
    prisma.order.aggregate({
      where: todayWhere,
      _count: { id: true },
      _sum: { totalInCents: true },
    }),
    prisma.order.count({ where: activeWhere }),
  ]);

  const ordersToday = todayAggregate._count.id;
  const revenueToday = todayAggregate._sum.totalInCents ?? 0;

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Pedidos Hoje"
          value={String(ordersToday)}
          description="pedidos confirmados hoje"
        />
        <StatCard
          title="Receita Hoje"
          value={formatBRL(revenueToday)}
          description="receita do dia"
        />
        <StatCard
          title="Pedidos Ativos"
          value={String(activeOrders)}
          description="em preparo ou prontos"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Link
            href="/backoffice/menu"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 text-center"
          >
            Gerenciar Cardápio
          </Link>
          <Link
            href="/backoffice/orders"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 text-center"
          >
            Ver Pedidos
          </Link>
          <Link
            href={`/${auth.slug}/kds`}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 text-center"
          >
            Abrir KDS
          </Link>
          <Link
            href="/backoffice/settings"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 text-center"
          >
            Configurações
          </Link>
          <Link
            href="/backoffice/settings"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 text-center"
          >
            Configurações
          </Link>
        </div>
      </section>
    </div>
  );
}
