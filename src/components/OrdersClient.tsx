"use client";

import { useEffect, useState } from "react";
import { OrderFilters } from "@/components/OrderFilters";
import { OrderTable } from "@/components/OrderTable";
import { OrderPagination } from "@/components/OrderPagination";

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
  customerPhone: string;
  status: string;
  totalInCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

interface OrdersClientProps {
  slug: string;
}

export function OrdersClient({ slug }: OrdersClientProps) {
  const today = getTodayDate();

  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  const [page, setPage] = useState<number>(1);

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));

    fetch(`/api/restaurants/${slug}/orders?${params.toString()}`)
      .then((res) => res.json())
      .then((json: OrdersResponse) => {
        setData(json);
      })
      .catch(() => {
        // keep previous data on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, status, dateFrom, dateTo, page]);

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    setPage(1);
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <OrderFilters
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onStatusChange={handleStatusChange}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          Carregando pedidos...
        </div>
      ) : (
        <>
          <OrderTable orders={data?.orders ?? []} />
          <OrderPagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
