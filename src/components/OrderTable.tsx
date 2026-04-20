"use client";

import React, { useState } from "react";

interface OrderItem {
  id: string;
  name: string;
  priceInCents: number;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  status: string;
  totalInCents: number;
  createdAt: string;
  items: OrderItem[];
}

interface OrderTableProps {
  orders: Order[];
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  PAYMENT_PENDING: "bg-yellow-100 text-yellow-800",
  PAYMENT_APPROVED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY: "bg-green-100 text-green-800",
  PICKED_UP: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function formatItemsSummary(items: OrderItem[]): string {
  return items.map((item) => `${item.name} x${item.quantity}`).join(", ");
}

export function OrderTable({ orders }: OrderTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        Nenhum pedido encontrado
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">#Pedido</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Cliente</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Itens</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Total</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const statusColor = STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800";

            return (
              <React.Fragment key={order.id}>
                <tr
                  onClick={() => toggleRow(order.id)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{order.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{formatItemsSummary(order.items)}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{formatPrice(order.totalInCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(order.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
                {isExpanded && (
                  <tr data-testid="order-detail-row">
                    <td colSpan={6} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                      <div className="space-y-2">
                        <p className="font-medium text-gray-700 mb-2">Detalhes do pedido</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 text-xs uppercase">
                              <th className="text-left pb-1">Item</th>
                              <th className="text-center pb-1">Qtd</th>
                              <th className="text-right pb-1">Preço unit.</th>
                              <th className="text-right pb-1">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id} className="border-t border-gray-100">
                                <td className="py-1 text-gray-800">{item.name}</td>
                                <td className="py-1 text-center text-gray-600">{item.quantity}</td>
                                <td className="py-1 text-right text-gray-600">{formatPrice(item.priceInCents)}</td>
                                <td className="py-1 text-right text-gray-800 font-medium">
                                  {formatPrice(item.priceInCents * item.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
