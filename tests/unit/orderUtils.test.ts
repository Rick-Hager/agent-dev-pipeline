import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

// ─── calculateOrderTotal ──────────────────────────────────────────────────────

describe("calculateOrderTotal", () => {
  it("sums priceInCents * quantity for multiple items", async () => {
    const { calculateOrderTotal } = await import("@/lib/orderUtils");
    const items = [
      { priceInCents: 1000, quantity: 2 },
      { priceInCents: 500, quantity: 3 },
    ];
    expect(calculateOrderTotal(items)).toBe(3500);
  });

  it("handles a single item", async () => {
    const { calculateOrderTotal } = await import("@/lib/orderUtils");
    const items = [{ priceInCents: 1200, quantity: 1 }];
    expect(calculateOrderTotal(items)).toBe(1200);
  });

  it("handles zero quantity item", async () => {
    const { calculateOrderTotal } = await import("@/lib/orderUtils");
    const items = [
      { priceInCents: 1000, quantity: 0 },
      { priceInCents: 500, quantity: 2 },
    ];
    expect(calculateOrderTotal(items)).toBe(1000);
  });

  it("returns 0 for empty array", async () => {
    const { calculateOrderTotal } = await import("@/lib/orderUtils");
    expect(calculateOrderTotal([])).toBe(0);
  });
});

// ─── generateOrderNumber ──────────────────────────────────────────────────────

describe("generateOrderNumber", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 1 as the first order number when no orders exist", async () => {
    vi.doMock("@/lib/db", () => ({
      prisma: {
        $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            order: {
              aggregate: vi
                .fn()
                .mockResolvedValue({ _max: { orderNumber: null } }),
            },
          };
          return fn(tx);
        }),
      },
    }));

    const { generateOrderNumber } = await import("@/lib/orderUtils");
    const result = await generateOrderNumber("restaurant-1");
    expect(result).toBe(1);
  });

  it("increments from the current max order number", async () => {
    vi.doMock("@/lib/db", () => ({
      prisma: {
        $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            order: {
              aggregate: vi
                .fn()
                .mockResolvedValue({ _max: { orderNumber: 5 } }),
            },
          };
          return fn(tx);
        }),
      },
    }));

    const { generateOrderNumber } = await import("@/lib/orderUtils");
    const result = await generateOrderNumber("restaurant-1");
    expect(result).toBe(6);
  });

  it("retries on P2002 unique constraint violation and succeeds on second attempt", async () => {
    const { Prisma } = await import("@prisma/client");

    let callCount = 0;
    vi.doMock("@/lib/db", () => ({
      prisma: {
        $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          callCount++;
          if (callCount === 1) {
            const error = new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed",
              { code: "P2002", clientVersion: "5.0.0" }
            );
            throw error;
          }
          const tx = {
            order: {
              aggregate: vi
                .fn()
                .mockResolvedValue({ _max: { orderNumber: 3 } }),
            },
          };
          return fn(tx);
        }),
      },
    }));

    const { generateOrderNumber } = await import("@/lib/orderUtils");
    const result = await generateOrderNumber("restaurant-1");
    expect(result).toBe(4);
    expect(callCount).toBe(2);
  });
});

// ─── validateStatusTransition ────────────────────────────────────────────────

describe("validateStatusTransition", () => {
  it("allows CREATED → PAYMENT_PENDING", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.CREATED, OrderStatus.PAYMENT_PENDING)
    ).toBe(true);
  });

  it("allows PAYMENT_PENDING → PAYMENT_APPROVED", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(
        OrderStatus.PAYMENT_PENDING,
        OrderStatus.PAYMENT_APPROVED
      )
    ).toBe(true);
  });

  it("allows PAYMENT_APPROVED → PREPARING", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(
        OrderStatus.PAYMENT_APPROVED,
        OrderStatus.PREPARING
      )
    ).toBe(true);
  });

  it("allows PREPARING → READY", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.PREPARING, OrderStatus.READY)
    ).toBe(true);
  });

  it("allows READY → PICKED_UP", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.READY, OrderStatus.PICKED_UP)
    ).toBe(true);
  });

  it("allows any status → CANCELLED", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    const statuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.PAYMENT_PENDING,
      OrderStatus.PAYMENT_APPROVED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.PICKED_UP,
    ];
    for (const status of statuses) {
      expect(validateStatusTransition(status, OrderStatus.CANCELLED)).toBe(
        true
      );
    }
  });

  it("rejects CREATED → PREPARING (skipping steps)", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.CREATED, OrderStatus.PREPARING)
    ).toBe(false);
  });

  it("rejects PICKED_UP → CREATED (backward transition)", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.PICKED_UP, OrderStatus.CREATED)
    ).toBe(false);
  });

  it("rejects CANCELLED → CREATED (from terminal state)", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.CANCELLED, OrderStatus.CREATED)
    ).toBe(false);
  });

  it("rejects READY → PAYMENT_PENDING (backward)", async () => {
    const { validateStatusTransition } = await import("@/lib/orderUtils");
    expect(
      validateStatusTransition(OrderStatus.READY, OrderStatus.PAYMENT_PENDING)
    ).toBe(false);
  });
});
