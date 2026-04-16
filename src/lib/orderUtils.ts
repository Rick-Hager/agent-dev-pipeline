import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function calculateOrderTotal(
  items: { priceInCents: number; quantity: number }[]
): number {
  return items.reduce((sum, item) => sum + item.priceInCents * item.quantity, 0);
}

export async function generateOrderNumber(
  restaurantId: string
): Promise<number> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const orderNumber = await prisma.$transaction(async (tx) => {
        const aggregate = await tx.order.aggregate({
          where: { restaurantId },
          _max: { orderNumber: true },
        });

        return (aggregate._max.orderNumber ?? 0) + 1;
      });

      return orderNumber;
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

  throw new Error("Failed to generate order number after max retries");
}

const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.CREATED]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.PAYMENT_APPROVED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_APPROVED]: [
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: [],
};

export function validateStatusTransition(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}
