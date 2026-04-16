"use client";

import { OrderStatus } from "@prisma/client";

interface Step {
  status: OrderStatus;
  label: string;
}

const STEPS: Step[] = [
  { status: "CREATED", label: "Pedido Criado" },
  { status: "PAYMENT_PENDING", label: "Pagamento Pendente" },
  { status: "PAYMENT_APPROVED", label: "Pagamento Aprovado" },
  { status: "PREPARING", label: "Preparando" },
  { status: "READY", label: "Pronto" },
  { status: "PICKED_UP", label: "Retirado" },
];

interface OrderProgressTrackerProps {
  status: OrderStatus;
}

export function OrderProgressTracker({ status }: OrderProgressTrackerProps) {
  if (status === "CANCELLED") {
    return (
      <div
        data-testid="cancelled-state"
        className="rounded-lg bg-red-50 border border-red-300 p-4 text-center text-red-700 font-semibold"
      >
        Pedido Cancelado
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <div data-testid="progress-tracker" className="flex flex-col gap-2">
      {STEPS.map((step, index) => {
        const isActive = index <= currentIndex;
        return (
          <div
            key={step.status}
            data-testid={`step-${step.status}`}
            className={`flex items-center gap-3 ${
              isActive ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                isActive
                  ? "bg-zinc-900 border-zinc-900"
                  : "bg-transparent border-zinc-300"
              }`}
            />
            <span className={isActive ? "font-bold" : "font-normal"}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
