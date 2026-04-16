"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

interface CartBadgeProps {
  slug: string;
}

export default function CartBadge({ slug }: CartBadgeProps) {
  const { totalItems } = useCart();

  return (
    <Link
      href={`/${slug}/cart`}
      aria-label="Ver carrinho"
      className="relative inline-flex items-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m13-9l2 9m-5-9v9m-4-9v9"
        />
      </svg>
      {totalItems > 0 && (
        <span
          data-testid="cart-badge-count"
          className="absolute -top-2 -right-2 bg-zinc-900 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
        >
          {totalItems}
        </span>
      )}
    </Link>
  );
}
