import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CardPaymentForm } from "@/components/CardPaymentForm";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function CardCheckoutPage({ params }: PageProps) {
  const { slug, orderId } = await params;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
  });
  if (!order) notFound();

  if (!restaurant.mercadopagoPublicKey) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Pagamento com cartão</h1>
        <p className="text-red-600">
          Este restaurante ainda não configurou o pagamento por cartão.
        </p>
        <Link
          href={`/${slug}/pedido/${orderId}`}
          className="inline-block mt-4 text-zinc-600 underline"
        >
          Ver status do pedido
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pedido #{order.orderNumber}</h1>
      <p className="text-zinc-600 mb-4">
        Total: R$ {(order.totalInCents / 100).toFixed(2).replace(".", ",")}
      </p>
      <CardPaymentForm
        publicKey={restaurant.mercadopagoPublicKey}
        slug={slug}
        orderId={orderId}
        amountInCents={order.totalInCents}
      />
    </main>
  );
}
