"use client";

import { useState, useEffect } from "react";
import { OrderStatus } from "@prisma/client";
import { OrderProgressTracker } from "@/components/OrderProgressTracker";

interface OrderStatusPollingProps {
  initialStatus: OrderStatus;
  slug: string;
  orderId: string;
}

export function OrderStatusPolling({
  initialStatus,
  slug,
  orderId,
}: OrderStatusPollingProps) {
  const [currentStatus, setCurrentStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    // Defer the first render of the tracker and start polling
    const init = setTimeout(() => {
      setCurrentStatus(initialStatus);
    }, 0);

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/restaurants/${slug}/orders/${orderId}`
        );
        const data = (await response.json()) as { status: OrderStatus };
        setCurrentStatus((prev) =>
          prev !== data.status ? data.status : prev
        );
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => {
      clearTimeout(init);
      clearInterval(interval);
    };
  }, [slug, orderId, initialStatus]);

  if (currentStatus === null) {
    return null;
  }

  return <OrderProgressTracker status={currentStatus} />;
}
