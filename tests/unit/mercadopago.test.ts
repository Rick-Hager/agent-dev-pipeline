import { describe, it, expect, vi, beforeEach } from "vitest";

const paymentCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(public readonly options: { accessToken: string }) {}
  }
  class Payment {
    constructor(public readonly client: MercadoPagoConfig) {}
    create(args: unknown) {
      return paymentCreateMock(args);
    }
    get(args: unknown) {
      return paymentGetMock(args);
    }
  }
  return { MercadoPagoConfig, Payment };
});

import {
  createPixPayment,
  createCardPayment,
  fetchPaymentStatus,
} from "@/lib/mercadopago";

describe("createPixPayment", () => {
  beforeEach(() => {
    paymentCreateMock.mockReset();
  });

  it("builds PIX payment body and returns QR + expiration", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 9001,
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code: "00020126PIX_COPIA",
          qr_code_base64: "iVBORw0KBASE64",
          ticket_url: "https://mercadopago.com/ticket/9001",
        },
      },
      date_of_expiration: "2026-04-19T12:00:00.000Z",
    });

    const result = await createPixPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 2500,
      orderNumber: 42,
      description: "Pedido #42 — Lanche do Zé",
      customerEmail: "maria@example.com",
      customerName: "Maria",
      baseUrl: "https://menuapp.test",
    });

    expect(paymentCreateMock).toHaveBeenCalledTimes(1);
    const call = paymentCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
      requestOptions: { idempotencyKey: string };
    };

    expect(call.body.transaction_amount).toBe(25);
    expect(call.body.payment_method_id).toBe("pix");
    expect(call.body.external_reference).toBe("order_1");
    expect(call.body.description).toBe("Pedido #42 — Lanche do Zé");
    expect(call.body.notification_url).toBe(
      "https://menuapp.test/api/webhooks/mercadopago"
    );
    const payer = call.body.payer as Record<string, unknown>;
    expect(payer.email).toBe("maria@example.com");
    expect(payer.first_name).toBe("Maria");
    expect(typeof call.body.date_of_expiration).toBe("string");

    expect(call.requestOptions.idempotencyKey).toBe("order-order_1-pix");

    expect(result.paymentId).toBe("9001");
    expect(result.qrCode).toBe("00020126PIX_COPIA");
    expect(result.qrCodeBase64).toBe("iVBORw0KBASE64");
    expect(result.ticketUrl).toBe("https://mercadopago.com/ticket/9001");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.toISOString()).toBe("2026-04-19T12:00:00.000Z");
  });

  it("sets date_of_expiration ~24h in future when MP response has none", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 1,
      status: "pending",
      point_of_interaction: {
        transaction_data: { qr_code: "x", qr_code_base64: "y", ticket_url: "z" },
      },
    });

    const before = Date.now();
    const result = await createPixPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 1000,
      orderNumber: 1,
      description: "Pedido",
      customerEmail: "a@b.test",
      customerName: "A",
      baseUrl: "https://menuapp.test",
    });
    const diff = result.expiresAt.getTime() - before;

    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5000);
  });
});

describe("createCardPayment", () => {
  beforeEach(() => {
    paymentCreateMock.mockReset();
  });

  it("builds card payment body with token, installments=1, CPF", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 1234,
      status: "approved",
      status_detail: "accredited",
    });

    const result = await createCardPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 5000,
      orderNumber: 10,
      description: "Pedido #10 — Lanche",
      customerEmail: "maria@example.com",
      customerName: "Maria",
      cpf: "19119119100",
      token: "card_tok_abc",
      paymentMethodId: "visa",
      issuerId: "25",
      baseUrl: "https://menuapp.test",
    });

    expect(paymentCreateMock).toHaveBeenCalledTimes(1);
    const call = paymentCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
      requestOptions: { idempotencyKey: string };
    };

    expect(call.body.transaction_amount).toBe(50);
    expect(call.body.installments).toBe(1);
    expect(call.body.token).toBe("card_tok_abc");
    expect(call.body.payment_method_id).toBe("visa");
    expect(call.body.issuer_id).toBe("25");
    expect(call.body.external_reference).toBe("order_1");
    expect(call.body.notification_url).toBe(
      "https://menuapp.test/api/webhooks/mercadopago"
    );

    const payer = call.body.payer as Record<string, unknown>;
    expect(payer.email).toBe("maria@example.com");
    expect(payer.first_name).toBe("Maria");
    expect(payer.identification).toEqual({
      type: "CPF",
      number: "19119119100",
    });

    expect(call.requestOptions.idempotencyKey).toBe("order-order_1-card");

    expect(result.paymentId).toBe("1234");
    expect(result.status).toBe("approved");
    expect(result.statusDetail).toBe("accredited");
  });

  it("forces installments to 1 even if input says otherwise (not possible by type — sanity check default)", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 2,
      status: "in_process",
      status_detail: "pending_review_manual",
    });

    const result = await createCardPayment("APP_USR_abc", {
      orderId: "order_x",
      amountInCents: 500,
      orderNumber: 1,
      description: "Pedido",
      customerEmail: "a@b.test",
      customerName: "A",
      cpf: "12345678901",
      token: "tok",
      paymentMethodId: "master",
      issuerId: "1",
      baseUrl: "https://menuapp.test",
    });

    const call = paymentCreateMock.mock.calls[0][0] as {
      body: { installments: number };
    };
    expect(call.body.installments).toBe(1);
    expect(result.status).toBe("in_process");
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
