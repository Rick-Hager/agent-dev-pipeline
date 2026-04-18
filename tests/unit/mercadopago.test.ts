import { describe, it, expect, vi, beforeEach } from "vitest";

const preferenceCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(public readonly options: { accessToken: string }) {}
  }
  class Preference {
    constructor(public readonly client: MercadoPagoConfig) {}
    create(args: unknown) {
      return preferenceCreateMock(args);
    }
  }
  class Payment {
    constructor(public readonly client: MercadoPagoConfig) {}
    get(args: unknown) {
      return paymentGetMock(args);
    }
  }
  return { MercadoPagoConfig, Preference, Payment };
});

import {
  createOrderPreference,
  fetchPaymentStatus,
} from "@/lib/mercadopago";

describe("createOrderPreference", () => {
  beforeEach(() => {
    preferenceCreateMock.mockReset();
  });

  it("creates a Preference with PIX + Cartão payment methods and returns id + init_point", async () => {
    preferenceCreateMock.mockResolvedValue({
      id: "pref_123",
      init_point: "https://mercadopago.com/checkout/pref_123",
    });

    const result = await createOrderPreference("APP_USR_abc", {
      orderId: "order_1",
      restaurantId: "rest_1",
      amountInCents: 2500,
      paymentMethod: "PIX",
      orderNumber: 42,
      itemsSummary: "Pedido #42",
      baseUrl: "https://menuapp.test",
      slug: "lanche-do-ze",
    });

    expect(preferenceCreateMock).toHaveBeenCalledTimes(1);
    const callArg = preferenceCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
    };
    const body = callArg.body;

    expect(body.external_reference).toBe("order_1");
    expect(body.notification_url).toBe(
      "https://menuapp.test/api/webhooks/mercadopago"
    );
    const backUrls = body.back_urls as Record<string, string>;
    expect(backUrls.success).toBe(
      "https://menuapp.test/lanche-do-ze/pedido/order_1"
    );
    expect(backUrls.failure).toBe(
      "https://menuapp.test/lanche-do-ze/pedido/order_1"
    );
    expect(backUrls.pending).toBe(
      "https://menuapp.test/lanche-do-ze/pedido/order_1"
    );
    const items = body.items as Array<{ unit_price: number; quantity: number }>;
    expect(items[0].unit_price).toBe(25);
    expect(items[0].quantity).toBe(1);

    // payment_methods must allow PIX + Cartão. In MercadoPago Brasil, PIX has
    // payment_type "bank_transfer", so bank_transfer MUST NOT be excluded.
    const paymentMethods = body.payment_methods as {
      excluded_payment_types: Array<{ id: string }>;
    };
    expect(paymentMethods.excluded_payment_types).toEqual(
      expect.arrayContaining([{ id: "ticket" }, { id: "atm" }])
    );
    expect(paymentMethods.excluded_payment_types).not.toEqual(
      expect.arrayContaining([{ id: "bank_transfer" }])
    );

    expect(result.id).toBe("pref_123");
    expect(result.initPoint).toBe("https://mercadopago.com/checkout/pref_123");
  });

  it("uses the restaurant's access token to construct the client", async () => {
    preferenceCreateMock.mockResolvedValue({
      id: "pref_abc",
      init_point: "https://mercadopago.com/pref_abc",
    });

    await createOrderPreference("APP_USR_different_token", {
      orderId: "order_2",
      restaurantId: "rest_2",
      amountInCents: 1000,
      paymentMethod: "CARD",
      orderNumber: 7,
      itemsSummary: "Pedido",
      baseUrl: "https://menuapp.test",
      slug: "another-slug",
    });

    expect(preferenceCreateMock).toHaveBeenCalled();
  });
});

describe("fetchPaymentStatus", () => {
  beforeEach(() => {
    paymentGetMock.mockReset();
  });

  it("returns mapped status and external_reference for an approved payment", async () => {
    paymentGetMock.mockResolvedValue({
      id: 123456,
      status: "approved",
      external_reference: "order_abc",
    });

    const result = await fetchPaymentStatus("APP_USR_abc", "123456");

    expect(paymentGetMock).toHaveBeenCalledWith({ id: "123456" });
    expect(result.status).toBe("approved");
    expect(result.externalReference).toBe("order_abc");
    expect(result.paymentId).toBe("123456");
  });

  it("passes rejected status through", async () => {
    paymentGetMock.mockResolvedValue({
      id: 999,
      status: "rejected",
      external_reference: "order_xyz",
    });

    const result = await fetchPaymentStatus("APP_USR_abc", "999");
    expect(result.status).toBe("rejected");
  });
});
