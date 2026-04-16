"use client";

import { useState } from "react";

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

interface OrderCardProps {
  order: Order;
  slug: string;
  onStatusChange: () => void;
}

function getElapsedText(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  return `${diffMin} min atrás`;
}

const STATUS_BUTTON: Record<
  Order["status"],
  { label: string; next: string; colorClass: string }
> = {
  PAYMENT_APPROVED: {
    label: "Iniciar",
    next: "PREPARING",
    colorClass: "bg-green-600 hover:bg-green-700 text-white",
  },
  PREPARING: {
    label: "Pronto",
    next: "READY",
    colorClass: "bg-orange-500 hover:bg-orange-600 text-white",
  },
  READY: {
    label: "Entregar",
    next: "PICKED_UP",
    colorClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

export function OrderCard({ order, slug, onStatusChange }: OrderCardProps) {
  const [loading, setLoading] = useState(false);
  const { label, next, colorClass } = STATUS_BUTTON[order.status];

  async function handleAction() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/restaurants/${slug}/orders/${order.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      if (res.ok) {
        onStatusChange();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="bg-white rounded-lg border border-zinc-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <span className="text-3xl font-bold text-zinc-900">
          #{order.orderNumber}
        </span>
        <span className="text-xs text-zinc-500">{getElapsedText(order.createdAt)}</span>
      </div>
      <p className="font-semibold text-zinc-700">{order.customerName}</p>
      <ul className="space-y-1">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm text-zinc-600">
            {item.quantity}x {item.name}
          </li>
        ))}
      </ul>
      <button
        onClick={handleAction}
        disabled={loading}
        className={`mt-auto w-full py-2 rounded-md font-semibold transition-colors disabled:opacity-50 ${colorClass}`}
      >
        {label}
      </button>
    </article>
  );
}
