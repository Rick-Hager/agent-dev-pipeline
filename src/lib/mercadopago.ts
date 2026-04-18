import { MercadoPagoConfig, Payment } from "mercadopago";

export interface CreatePixPaymentParams {
  orderId: string;
  amountInCents: number;
  orderNumber: number;
  description: string;
  customerEmail: string;
  customerName: string;
  baseUrl: string;
}

export interface CreatedPixPayment {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: Date;
}

export interface CreateCardPaymentParams {
  orderId: string;
  amountInCents: number;
  orderNumber: number;
  description: string;
  customerEmail: string;
  customerName: string;
  cpf: string;
  token: string;
  paymentMethodId: string;
  issuerId: string;
  baseUrl: string;
}

export interface CreatedCardPayment {
  paymentId: string;
  status: string;
  statusDetail: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: string;
  externalReference: string | null;
}

function buildClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken });
}

export async function createPixPayment(
  accessToken: string,
  params: CreatePixPaymentParams
): Promise<CreatedPixPayment> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);

  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const response = (await payment.create({
    body: {
      transaction_amount: params.amountInCents / 100,
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.orderId,
      notification_url: `${params.baseUrl}/api/webhooks/mercadopago`,
      date_of_expiration: expirationDate.toISOString(),
      payer: {
        email: params.customerEmail,
        first_name: params.customerName,
      },
    },
    requestOptions: { idempotencyKey: `order-${params.orderId}-pix` },
  })) as {
    id: number | string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
    date_of_expiration?: string;
  };

  const td = response.point_of_interaction?.transaction_data ?? {};

  return {
    paymentId: String(response.id),
    qrCode: td.qr_code ?? "",
    qrCodeBase64: td.qr_code_base64 ?? "",
    ticketUrl: td.ticket_url ?? "",
    expiresAt: response.date_of_expiration
      ? new Date(response.date_of_expiration)
      : expirationDate,
  };
}

export async function createCardPayment(
  accessToken: string,
  params: CreateCardPaymentParams
): Promise<CreatedCardPayment> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);

  const response = (await payment.create({
    body: {
      transaction_amount: params.amountInCents / 100,
      description: params.description,
      token: params.token,
      installments: 1,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId,
      external_reference: params.orderId,
      notification_url: `${params.baseUrl}/api/webhooks/mercadopago`,
      payer: {
        email: params.customerEmail,
        first_name: params.customerName,
        identification: { type: "CPF", number: params.cpf },
      },
    },
    requestOptions: { idempotencyKey: `order-${params.orderId}-card` },
  })) as {
    id: number | string;
    status: string;
    status_detail?: string;
  };

  return {
    paymentId: String(response.id),
    status: response.status,
    statusDetail: response.status_detail ?? "",
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
