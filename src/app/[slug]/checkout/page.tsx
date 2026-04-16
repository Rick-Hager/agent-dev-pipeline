"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { items, totalInCents, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <p>Seu carrinho está vazio.</p>
        <Link href={`/${slug}`} className="text-zinc-600 underline">
          Ver cardápio
        </Link>
      </main>
    );
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomerPhone(applyPhoneMask(e.target.value));
    setPhoneError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rawPhone = customerPhone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      setPhoneError("Telefone inválido");
      return;
    }
    setApiError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/restaurants/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: rawPhone,
          items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
        }),
      });
      if (!response.ok) {
        setApiError("Erro ao realizar pedido. Tente novamente.");
        return;
      }
      const order = await response.json() as { id: string; orderNumber: number };
      clearCart();
      router.push(`/${slug}/pedido/${order.id}`);
    } catch {
      setApiError("Erro ao realizar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <Link href={`/${slug}/cart`} className="text-zinc-600 underline block mb-4">
        ← Voltar ao carrinho
      </Link>

      <h1 className="text-2xl font-bold mb-6">Resumo do pedido</h1>

      <ul className="space-y-3 mb-4">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="flex gap-4">
              <span className="text-zinc-500">{formatPrice(item.priceInCents)}</span>
              <span className="font-medium">{formatPrice(item.priceInCents * item.quantity)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-bold text-lg border-t pt-3 mb-6">
        <span>Total</span>
        <span>{formatPrice(totalInCents)}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="customerName" className="font-medium">
            Nome
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border rounded-md px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="customerPhone" className="font-medium">
            Telefone
          </label>
          <input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            required
            value={customerPhone}
            onChange={handlePhoneChange}
            placeholder="(11) 99999-9999"
            className="border rounded-md px-3 py-2"
          />
          {phoneError && (
            <p className="text-red-600 text-sm">{phoneError}</p>
          )}
        </div>

        {apiError && (
          <p className="text-red-600 text-sm">{apiError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-zinc-900 text-white rounded-md font-medium disabled:opacity-50"
        >
          Confirmar Pedido
        </button>
      </form>
    </main>
  );
}
