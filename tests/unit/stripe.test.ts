import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
const constructEventMock = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    public paymentIntents = { create: createMock };
    public webhooks = { constructEvent: constructEventMock };
    constructor(public readonly secretKey: string) {}
  }
  return { default: MockStripe };
});

import {
  createOrderPaymentIntent,
  verifyWebhookSignature,
} from "@/lib/stripe";

describe("createOrderPaymentIntent", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("creates a PIX PaymentIntent with correct params", async () => {
    createMock.mockResolvedValue({
      id: "pi_pix_123",
      client_secret: "pi_pix_123_secret_abc",
    });

    const result = await createOrderPaymentIntent("sk_test_abc", {
      amountInCents: 1500,
      paymentMethod: "PIX",
      orderId: "order_1",
      restaurantId: "rest_1",
    });

    expect(createMock).toHaveBeenCalledWith({
      amount: 1500,
      currency: "brl",
      payment_method_types: ["pix"],
      metadata: { orderId: "order_1", restaurantId: "rest_1" },
    });
    expect(result.id).toBe("pi_pix_123");
    expect(result.clientSecret).toBe("pi_pix_123_secret_abc");
  });

  it("creates a CARD PaymentIntent with correct params", async () => {
    createMock.mockResolvedValue({
      id: "pi_card_456",
      client_secret: "pi_card_456_secret_def",
    });

    const result = await createOrderPaymentIntent("sk_test_abc", {
      amountInCents: 3000,
      paymentMethod: "CARD",
      orderId: "order_2",
      restaurantId: "rest_1",
    });

    expect(createMock).toHaveBeenCalledWith({
      amount: 3000,
      currency: "brl",
      payment_method_types: ["card"],
      metadata: { orderId: "order_2", restaurantId: "rest_1" },
    });
    expect(result.id).toBe("pi_card_456");
    expect(result.clientSecret).toBe("pi_card_456_secret_def");
  });
});

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    constructEventMock.mockReset();
  });

  it("returns the event when the signature is valid", () => {
    const payload = '{"id":"evt_1","type":"payment_intent.succeeded"}';
    const event = { id: "evt_1", type: "payment_intent.succeeded" };
    constructEventMock.mockReturnValue(event);

    const result = verifyWebhookSignature(payload, "sig_valid", "whsec_abc");

    expect(constructEventMock).toHaveBeenCalledWith(
      payload,
      "sig_valid",
      "whsec_abc"
    );
    expect(result).toBe(event);
  });

  it("throws when the signature is invalid", () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    expect(() =>
      verifyWebhookSignature("payload", "sig_bad", "whsec_abc")
    ).toThrow("Invalid signature");
  });
});
