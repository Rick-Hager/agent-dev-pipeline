"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

export default function CartPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { items, totalInCents, updateQuantity, clearCart } = useCart();

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Carrinho</h1>

      {items.length === 0 ? (
        <p>Seu carrinho está vazio.</p>
      ) : (
        <>
          <ul className="space-y-4 mb-6">
            {items.map((item) => (
              <li key={item.id} className="border-b pb-4">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-zinc-500">
                  {formatPrice(item.priceInCents)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    aria-label="Diminuir quantidade"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="px-2 py-1 bg-zinc-200 rounded"
                  >
                    -
                  </button>
                  <span data-testid="item-quantity">{item.quantity}</span>
                  <button
                    aria-label="Aumentar quantidade"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="px-2 py-1 bg-zinc-200 rounded"
                  >
                    +
                  </button>
                  <span className="ml-auto font-medium">
                    {formatPrice(item.priceInCents * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-between font-bold text-lg mb-6">
            <span>Total</span>
            <span>{formatPrice(totalInCents)}</span>
          </div>

          <button
            onClick={clearCart}
            className="w-full py-2 border border-zinc-900 text-zinc-900 rounded-md mb-4"
          >
            Limpar carrinho
          </button>
        </>
      )}

      <Link
        href={`/${slug}`}
        className="block text-center text-zinc-600 underline"
      >
        Voltar ao cardápio
      </Link>
    </main>
  );
}
