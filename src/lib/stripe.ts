import Stripe from "stripe";
import type { PaymentMethod } from "@prisma/client";

export interface CreatePaymentIntentParams {
  amountInCents: number;
  paymentMethod: PaymentMethod;
  orderId: string;
  restaurantId: string;
}

export interface CreatedPaymentIntent {
  id: string;
  clientSecret: string;
}

function getStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function createOrderPaymentIntent(
  secretKey: string,
  params: CreatePaymentIntentParams
): Promise<CreatedPaymentIntent> {
  const stripe = getStripeClient(secretKey);
  const method = params.paymentMethod === "PIX" ? "pix" : "card";

  const intent = await stripe.paymentIntents.create({
    amount: params.amountInCents,
    currency: "brl",
    payment_method_types: [method],
    metadata: {
      orderId: params.orderId,
      restaurantId: params.restaurantId,
    },
  });

  return {
    id: intent.id,
    clientSecret: intent.client_secret ?? "",
  };
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripeClient("sk_webhook_verify_only");
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
