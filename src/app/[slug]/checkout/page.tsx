"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { PaymentForm } from "@/components/PaymentForm";

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type PaymentMethod = "PIX" | "CARD";

interface PaymentSession {
  orderId: string;
  clientSecret: string;
  publishableKey: string;
  paymentMethod: PaymentMethod;
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { items, totalInCents, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [phoneError, setPhoneError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payment, setPayment] = useState<PaymentSession | null>(null);

  if (payment) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Finalize o pagamento</h1>
        <PaymentForm
          clientSecret={payment.clientSecret}
          publishableKey={payment.publishableKey}
          paymentMethod={payment.paymentMethod}
          slug={slug}
          orderId={payment.orderId}
        />
      </main>
    );
  }

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
      const orderRes = await fetch(`/api/restaurants/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: rawPhone,
          items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
        }),
      });
      if (!orderRes.ok) {
        setApiError("Erro ao realizar pedido. Tente novamente.");
        return;
      }
      const order = (await orderRes.json()) as { id: string; orderNumber: number };

      const payRes = await fetch(
        `/api/restaurants/${slug}/orders/${order.id}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethod }),
        }
      );
      if (!payRes.ok) {
        setApiError("Erro ao iniciar pagamento. Tente novamente.");
        return;
      }
      const pay = (await payRes.json()) as {
        clientSecret: string;
        publishableKey: string;
        paymentMethod: PaymentMethod;
      };

      clearCart();
      setPayment({
        orderId: order.id,
        clientSecret: pay.clientSecret,
        publishableKey: pay.publishableKey,
        paymentMethod: pay.paymentMethod,
      });
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

        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium mb-1">Forma de pagamento</legend>
          <label htmlFor="pm-pix" className="flex items-center gap-2 cursor-pointer">
            <input
              id="pm-pix"
              type="radio"
              name="paymentMethod"
              value="PIX"
              checked={paymentMethod === "PIX"}
              onChange={() => setPaymentMethod("PIX")}
            />
            <span>PIX</span>
          </label>
          <label htmlFor="pm-card" className="flex items-center gap-2 cursor-pointer">
            <input
              id="pm-card"
              type="radio"
              name="paymentMethod"
              value="CARD"
              checked={paymentMethod === "CARD"}
              onChange={() => setPaymentMethod("CARD")}
            />
            <span>Cartão</span>
          </label>
        </fieldset>

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
