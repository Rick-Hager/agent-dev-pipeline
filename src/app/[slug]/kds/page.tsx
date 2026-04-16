"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { OrderCard } from "@/components/OrderCard";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  priceInCents: number;
}

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  status: "PAYMENT_APPROVED" | "PREPARING" | "READY";
  createdAt: string;
  items: OrderItem[];
}

export default function KdsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/restaurants/${slug}/kds`);
    if (res.ok) {
      const data = await res.json() as { orders: Order[] };
      setOrders(data.orders);
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/restaurants/${slug}/kds`);
      if (res.ok && !cancelled) {
        const data = await res.json() as { orders: Order[] };
        setOrders(data.orders);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  const novos = orders.filter((o) => o.status === "PAYMENT_APPROVED");
  const preparando = orders.filter((o) => o.status === "PREPARING");
  const prontos = orders.filter((o) => o.status === "READY");

  return (
    <main className="w-full min-h-screen bg-zinc-100 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        Kitchen Display System
      </h1>
      <div className="grid grid-cols-3 gap-6">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-zinc-700">Novos</h2>
            <span
              data-testid="badge-novos"
              className="bg-zinc-900 text-white text-xs font-bold px-2 py-0.5 rounded-full"
            >
              {novos.length}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {novos.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum pedido</p>
            ) : (
              novos.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  slug={slug}
                  onStatusChange={fetchOrders}
                />
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-zinc-700">Preparando</h2>
            <span
              data-testid="badge-preparando"
              className="bg-zinc-900 text-white text-xs font-bold px-2 py-0.5 rounded-full"
            >
              {preparando.length}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {preparando.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum pedido</p>
            ) : (
              preparando.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  slug={slug}
                  onStatusChange={fetchOrders}
                />
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-zinc-700">Prontos</h2>
            <span
              data-testid="badge-prontos"
              className="bg-zinc-900 text-white text-xs font-bold px-2 py-0.5 rounded-full"
            >
              {prontos.length}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {prontos.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum pedido</p>
            ) : (
              prontos.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  slug={slug}
                  onStatusChange={fetchOrders}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
