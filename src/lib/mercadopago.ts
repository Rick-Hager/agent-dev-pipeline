import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import type { PaymentMethod } from "@prisma/client";

export interface CreatePreferenceParams {
  orderId: string;
  restaurantId: string;
  amountInCents: number;
  paymentMethod: PaymentMethod;
  orderNumber: number;
  itemsSummary: string;
  baseUrl: string;
  slug: string;
}

export interface CreatedPreference {
  id: string;
  initPoint: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: string;
  externalReference: string | null;
}

function buildClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken });
}

export async function createOrderPreference(
  accessToken: string,
  params: CreatePreferenceParams
): Promise<CreatedPreference> {
  const client = buildClient(accessToken);
  const preference = new Preference(client);

  const orderUrl = `${params.baseUrl}/${params.slug}/pedido/${params.orderId}`;
  const notificationUrl = `${params.baseUrl}/api/webhooks/mercadopago`;

  const response = await preference.create({
    body: {
      external_reference: params.orderId,
      items: [
        {
          id: params.orderId,
          title: params.itemsSummary,
          quantity: 1,
          unit_price: params.amountInCents / 100,
          currency_id: "BRL",
        },
      ],
      back_urls: {
        success: orderUrl,
        failure: orderUrl,
        pending: orderUrl,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      },
      metadata: {
        order_id: params.orderId,
        restaurant_id: params.restaurantId,
        order_number: params.orderNumber,
        preferred_method: params.paymentMethod,
      },
    },
  });

  return {
    id: String((response as { id: string }).id),
    initPoint:
      (response as { init_point?: string }).init_point ??
      (response as { sandbox_init_point?: string }).sandbox_init_point ??
      "",
  };
}

export async function fetchPaymentStatus(
  accessToken: string,
  paymentId: string
): Promise<PaymentStatus> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);
  const response = (await payment.get({ id: paymentId })) as {
    id: number | string;
    status: string;
    external_reference?: string | null;
  };

  return {
    paymentId: String(response.id),
    status: response.status,
    externalReference: response.external_reference ?? null,
  };
}
