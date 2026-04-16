import twilio from "twilio";
import { OrderStatus } from "@prisma/client";

interface OrderForNotification {
  orderNumber: number;
  customerPhone: string;
  status: OrderStatus;
}

interface RestaurantForNotification {
  whatsappNumber: string | null;
  whatsappApiConfig: unknown;
  whatsappMessageTemplate: string | null;
}

interface WhatsappApiConfig {
  accountSid: string;
  authToken: string;
}

const DEFAULT_MESSAGES: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PAYMENT_APPROVED]:
    "Pedido #{orderNumber} confirmado! Estamos preparando seu pedido.",
  [OrderStatus.PREPARING]: "Pedido #{orderNumber} está sendo preparado!",
  [OrderStatus.READY]: "Pedido #{orderNumber} está pronto para retirada!",
};

function formatPhone(phone: string): string {
  if (phone.startsWith("+")) {
    return phone;
  }
  return "+55" + phone;
}

export async function sendOrderNotification(
  order: OrderForNotification,
  restaurant: RestaurantForNotification
): Promise<void> {
  if (!restaurant.whatsappApiConfig || !restaurant.whatsappNumber) {
    return;
  }

  const config = restaurant.whatsappApiConfig as WhatsappApiConfig;

  let message: string;

  if (restaurant.whatsappMessageTemplate) {
    message = restaurant.whatsappMessageTemplate
      .replace("{orderNumber}", String(order.orderNumber))
      .replace("{status}", order.status);
  } else {
    const template = DEFAULT_MESSAGES[order.status];
    if (!template) {
      return;
    }
    message = template.replace("{orderNumber}", String(order.orderNumber));
  }

  const formattedPhone = formatPhone(order.customerPhone);

  try {
    const client = twilio(config.accountSid, config.authToken);
    await client.messages.create({
      from: "whatsapp:" + restaurant.whatsappNumber,
      to: "whatsapp:" + formattedPhone,
      body: message,
    });
  } catch (err) {
    console.error("WhatsApp notification failed:", err);
  }
}
