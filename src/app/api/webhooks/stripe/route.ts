import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { verifyWebhookSignature } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (!order) {
        return NextResponse.json(
          { received: true, warning: "Order not found for PaymentIntent" },
          { status: 200 }
        );
      }

      const nextStatus =
        event.type === "payment_intent.succeeded"
          ? OrderStatus.PAYMENT_APPROVED
          : OrderStatus.CANCELLED;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/webhooks/stripe handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
