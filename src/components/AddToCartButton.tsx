"use client";

import { useCart } from "@/components/CartProvider";

interface AddToCartButtonProps {
  item: {
    id: string;
    name: string;
    priceInCents: number;
  };
}

export default function AddToCartButton({ item }: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => addItem(item)}
      className="mt-2 px-3 py-1 text-sm bg-zinc-900 text-white rounded-md"
    >
      Adicionar
    </button>
  );
}
