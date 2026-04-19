import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { OrderStatusPolling } from "@/components/OrderStatusPolling";
import { PixPaymentView } from "@/components/PixPaymentView";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Aguardando pagamento",
  PAYMENT_PENDING: "Pagamento pendente",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PREPARING: "Em preparo",
  READY: "Pronto para retirada",
  PICKED_UP: "Retirado",
  CANCELLED: "Cancelado",
};

export default async function OrderStatusPage({ params }: PageProps) {
  const { slug, orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) notFound();

  const showPix =
    order.status === OrderStatus.PAYMENT_PENDING &&
    order.paymentMethod === PaymentMethod.PIX &&
    order.pixQrCode &&
    order.pixQrCodeBase64 &&
    order.pixTicketUrl &&
    order.pixExpiresAt;

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Pedido #{order.orderNumber}</h1>

      <p className="text-zinc-800 font-medium mb-1">{order.customerName}</p>
      <time className="text-zinc-500 text-sm mb-4 block">
        {new Date(order.createdAt).toLocaleString("pt-BR")}
      </time>

      <p className="text-zinc-600 mb-4">{STATUS_LABELS[order.status]}</p>

      <div className="mb-6">
        <OrderStatusPolling
          initialStatus={order.status}
          slug={slug}
          orderId={orderId}
        />
      </div>

      {showPix && (
        <div className="mb-6">
          <PixPaymentView
            qrCode={order.pixQrCode!}
            qrCodeBase64={order.pixQrCodeBase64!}
            ticketUrl={order.pixTicketUrl!}
            expiresAt={order.pixExpiresAt!.toISOString()}
          />
        </div>
      )}

      <ul className="space-y-3 mb-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.priceInCents)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-bold text-lg border-t pt-3 mb-6">
        <span>Total</span>
        <span>{formatPrice(order.totalInCents)}</span>
      </div>

      <Link href={`/${slug}`} className="text-zinc-600 underline">
        Voltar ao início
      </Link>
    </main>
  );
}
