import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

// ─── Mock Twilio at module level ──────────────────────────────────────────────

const mockMessagesCreate = vi.fn();
const mockTwilioClient = {
  messages: {
    create: mockMessagesCreate,
  },
};

vi.mock("twilio", () => ({
  default: vi.fn(() => mockTwilioClient),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRestaurant(overrides: Record<string, unknown> = {}) {
  return {
    whatsappNumber: "+15550000001",
    whatsappApiConfig: { accountSid: "ACtest", authToken: "token123" } as unknown,
    whatsappMessageTemplate: null as string | null,
    ...overrides,
  };
}

function makeOrder(
  status: OrderStatus,
  overrides: Record<string, unknown> = {}
) {
  return {
    orderNumber: 42,
    customerPhone: "+5511999999999",
    status,
    ...overrides,
  };
}

// ─── sendOrderNotification ────────────────────────────────────────────────────

describe("sendOrderNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    mockMessagesCreate.mockReset();
    mockMessagesCreate.mockResolvedValue({ sid: "SM123" });
  });

  // ── Default message templates ─────────────────────────────────────────────

  it("sends correct message for PAYMENT_APPROVED status", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED),
      makeRestaurant()
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.body).toBe(
      "Pedido #42 confirmado! Estamos preparando seu pedido."
    );
  });

  it("sends correct message for PREPARING status", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PREPARING),
      makeRestaurant()
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.body).toBe("Pedido #42 está sendo preparado!");
  });

  it("sends correct message for READY status", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.READY),
      makeRestaurant()
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.body).toBe("Pedido #42 está pronto para retirada!");
  });

  // ── Phone number formatting ───────────────────────────────────────────────

  it("leaves phone unchanged when it already starts with +", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED, {
        customerPhone: "+5511999999999",
      }),
      makeRestaurant()
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.to).toBe("whatsapp:+5511999999999");
  });

  it("prepends +55 when phone starts with a digit", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED, {
        customerPhone: "11999999999",
      }),
      makeRestaurant()
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.to).toBe("whatsapp:+5511999999999");
  });

  // ── from field ────────────────────────────────────────────────────────────

  it("sends from the restaurant whatsappNumber with whatsapp: prefix", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED),
      makeRestaurant({ whatsappNumber: "+15550000001" })
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.from).toBe("whatsapp:+15550000001");
  });

  // ── Early returns ─────────────────────────────────────────────────────────

  it("returns early without sending when whatsappApiConfig is null", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED),
      makeRestaurant({ whatsappApiConfig: null })
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns early without sending when whatsappNumber is null", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED),
      makeRestaurant({ whatsappNumber: null })
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns early for CREATED status (non-notifiable)", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.CREATED),
      makeRestaurant()
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns early for PICKED_UP status (non-notifiable)", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PICKED_UP),
      makeRestaurant()
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns early for CANCELLED status (non-notifiable)", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.CANCELLED),
      makeRestaurant()
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns early for PAYMENT_PENDING status (non-notifiable)", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_PENDING),
      makeRestaurant()
    );

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  // ── Custom message template ───────────────────────────────────────────────

  it("uses custom whatsappMessageTemplate with {orderNumber} and {status} substitution", async () => {
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await sendOrderNotification(
      makeOrder(OrderStatus.PAYMENT_APPROVED, { orderNumber: 7 }),
      makeRestaurant({
        whatsappMessageTemplate:
          "Seu pedido {orderNumber} mudou para {status}!",
      })
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.body).toBe(
      "Seu pedido 7 mudou para PAYMENT_APPROVED!"
    );
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("does not throw when Twilio client throws", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("Twilio error"));
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    await expect(
      sendOrderNotification(
        makeOrder(OrderStatus.PAYMENT_APPROVED),
        makeRestaurant()
      )
    ).resolves.toBeUndefined();
  });
});
