"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrickController, CardFormData } from "@/types/mercadopago-brick";

interface CardPaymentFormProps {
  publicKey: string;
  slug: string;
  orderId: string;
  amountInCents: number;
}

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";

function loadMpSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.MercadoPago) return Promise.resolve();
  const existing = document.querySelector(
    `script[src="${MP_SDK_SRC}"]`
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("MP SDK failed to load"))
      );
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = MP_SDK_SRC;
    s.async = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () =>
      reject(new Error("MP SDK failed to load"))
    );
    document.body.appendChild(s);
  });
}

export function CardPaymentForm({
  publicKey,
  slug,
  orderId,
  amountInCents,
}: CardPaymentFormProps) {
  const router = useRouter();
  const [setupError, setSetupError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`order-${orderId}-cpf`)
      ? null
      : "CPF não encontrado. Volte ao checkout e informe o CPF novamente.";
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const brickRef = useRef<BrickController | null>(null);

  useEffect(() => {
    if (setupError) return;

    let cancelled = false;

    loadMpSdk()
      .then(() => {
        if (cancelled) return;
        if (!window.MercadoPago) {
          setSetupError("Falha ao carregar MercadoPago.");
          return;
        }
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        return mp.bricks().create("cardPayment", "cardPaymentBrick_container", {
          initialization: { amount: amountInCents / 100 },
          customization: {
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async (formData: CardFormData) => {
              const storedCpf = sessionStorage.getItem(
                `order-${orderId}-cpf`
              );
              if (!storedCpf) {
                setApiError("CPF ausente.");
                return;
              }
              const res = await fetch(
                `/api/restaurants/${slug}/orders/${orderId}/pay/card`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token: formData.token,
                    paymentMethodId: formData.payment_method_id,
                    issuerId: formData.issuer_id,
                    installments: 1,
                    cpf: storedCpf,
                  }),
                }
              );
              if (!res.ok) {
                setApiError(
                  "Pagamento recusado. Tente outro cartão ou PIX."
                );
                return;
              }
              sessionStorage.removeItem(`order-${orderId}-cpf`);
              router.push(`/${slug}/pedido/${orderId}`);
            },
            onError: (err: { message?: string }) => {
              setApiError(err.message ?? "Erro no pagamento.");
            },
          },
        });
      })
      .then((controller) => {
        if (!cancelled && controller) brickRef.current = controller;
      })
      .catch((err: Error) => {
        if (!cancelled) setSetupError(err.message);
      });

    return () => {
      cancelled = true;
      brickRef.current?.unmount();
      brickRef.current = null;
    };
  }, [publicKey, slug, orderId, amountInCents, router, setupError]);

  if (setupError) {
    return (
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <p className="text-red-600 font-medium">{setupError}</p>
        <a
          href={`/${slug}/checkout`}
          className="inline-block text-sm text-zinc-700 underline"
        >
          Voltar ao checkout
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div id="cardPaymentBrick_container" />
      {apiError && <p className="text-red-600 text-sm">{apiError}</p>}
    </div>
  );
}
