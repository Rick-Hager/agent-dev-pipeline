"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface PaymentFormProps {
  clientSecret: string;
  publishableKey: string;
  paymentMethod: "PIX" | "CARD";
  slug: string;
  orderId: string;
}

function CardPaymentInner({
  clientSecret,
  slug,
  orderId,
}: {
  clientSecret: string;
  slug: string;
  orderId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsProcessing(true);
    setError(null);

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    setIsProcessing(false);

    if (result.error) {
      setError(result.error.message ?? "Erro ao processar pagamento.");
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      router.push(`/${slug}/pedido/${orderId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Pagamento com Cartão</h2>
      <div className="border rounded-md p-3">
        <CardElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 bg-zinc-900 text-white rounded-md font-medium disabled:opacity-50"
      >
        {isProcessing ? "Processando..." : "Pagar"}
      </button>
    </form>
  );
}

function PixPayment({ clientSecret }: { clientSecret: string }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Pagamento PIX</h2>
      <p className="text-sm text-zinc-600">
        Escaneie o QR code abaixo com o aplicativo do seu banco para concluir o pagamento.
      </p>
      <div
        data-testid="pix-qr"
        className="border-2 border-dashed border-zinc-300 rounded-md p-8 flex items-center justify-center text-center text-sm text-zinc-500"
        aria-label="QR Code PIX"
      >
        <span>QR Code PIX</span>
      </div>
      <p className="text-xs text-zinc-500 break-all">
        Código de pagamento: {clientSecret.slice(0, 16)}…
      </p>
    </section>
  );
}

export function PaymentForm({
  clientSecret,
  publishableKey,
  paymentMethod,
  slug,
  orderId,
}: PaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<
    Promise<StripeJS | null> | null
  >(null);

  useEffect(() => {
    setStripePromise(loadStripe(publishableKey));
  }, [publishableKey]);

  const options = useMemo(() => ({ clientSecret }), [clientSecret]);

  if (paymentMethod === "PIX") {
    return <PixPayment clientSecret={clientSecret} />;
  }

  if (!stripePromise) return null;

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardPaymentInner
        clientSecret={clientSecret}
        slug={slug}
        orderId={orderId}
      />
    </Elements>
  );
}
