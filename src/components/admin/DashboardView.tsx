import Link from "next/link";
import { StatCard } from "@/components/admin/StatCard";

export interface DashboardStats {
  ordersToday: number;
  revenueTodayInCents: number;
  activeOrders: number;
  pendingPayments: number;
  conversionRatePercent: number;
}

export interface DashboardViewProps {
  slug: string;
  stats: DashboardStats;
  mercadopagoConfigured: boolean;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function DashboardView({
  slug,
  stats,
  mercadopagoConfigured,
}: DashboardViewProps) {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {!mercadopagoConfigured && (
        <div
          data-testid="mercadopago-alert"
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <p className="font-semibold">MercadoPago não configurado</p>
          <p className="text-sm">
            Para receber pagamentos online, configure seu Access Token nas{" "}
            <Link
              href="/backoffice/settings"
              className="underline hover:text-amber-950"
            >
              Configurações
            </Link>
            .
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Pedidos Hoje"
          value={String(stats.ordersToday)}
          description="pedidos confirmados hoje"
        />
        <StatCard
          title="Receita Hoje"
          value={formatBRL(stats.revenueTodayInCents)}
          description="receita do dia"
        />
        <StatCard
          title="Pedidos Ativos"
          value={String(stats.activeOrders)}
          description="em preparo ou prontos"
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <StatCard
          title="Pagamentos Pendentes"
          value={String(stats.pendingPayments)}
          description="aguardando confirmação do MercadoPago"
        />
        <StatCard
          title="Taxa de Conversão"
          value={formatPercent(stats.conversionRatePercent)}
          description="% de pedidos pagos hoje"
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
            href={`/${slug}/kds`}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 text-center"
          >
            Abrir KDS
          </Link>
          <Link
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 text-center"
          >
            Ver Cardápio
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

export function computeConversionRate(
  paidCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return (paidCount / totalCount) * 100;
}
