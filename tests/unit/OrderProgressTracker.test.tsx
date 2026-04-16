import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { OrderProgressTracker } from "@/components/OrderProgressTracker";

const STEP_LABELS = [
  "Pedido Criado",
  "Pagamento Pendente",
  "Pagamento Aprovado",
  "Preparando",
  "Pronto",
  "Retirado",
];

describe("OrderProgressTracker", () => {
  it("shows progress-tracker for CREATED status", () => {
    render(<OrderProgressTracker status="CREATED" />);
    expect(screen.getByTestId("progress-tracker")).toBeInTheDocument();
  });

  it("does NOT show progress-tracker for CANCELLED status", () => {
    render(<OrderProgressTracker status="CANCELLED" />);
    expect(screen.queryByTestId("progress-tracker")).not.toBeInTheDocument();
  });

  it("shows cancelled-state for CANCELLED status", () => {
    render(<OrderProgressTracker status="CANCELLED" />);
    expect(screen.getByTestId("cancelled-state")).toBeInTheDocument();
  });

  it("does NOT show cancelled-state for non-cancelled status", () => {
    render(<OrderProgressTracker status="CREATED" />);
    expect(screen.queryByTestId("cancelled-state")).not.toBeInTheDocument();
  });

  it("renders all 6 step labels for CREATED status", () => {
    render(<OrderProgressTracker status="CREATED" />);
    for (const label of STEP_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders all 6 step labels for READY status", () => {
    render(<OrderProgressTracker status="READY" />);
    for (const label of STEP_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("CREATED status — step-CREATED is highlighted, future steps are dimmed", () => {
    render(<OrderProgressTracker status="CREATED" />);
    const createdStep = screen.getByTestId("step-CREATED");
    const pendingStep = screen.getByTestId("step-PAYMENT_PENDING");
    const approvedStep = screen.getByTestId("step-PAYMENT_APPROVED");
    const preparingStep = screen.getByTestId("step-PREPARING");
    const readyStep = screen.getByTestId("step-READY");
    const pickedUpStep = screen.getByTestId("step-PICKED_UP");

    expect(createdStep).toHaveClass("text-zinc-900");
    expect(pendingStep).toHaveClass("text-zinc-400");
    expect(approvedStep).toHaveClass("text-zinc-400");
    expect(preparingStep).toHaveClass("text-zinc-400");
    expect(readyStep).toHaveClass("text-zinc-400");
    expect(pickedUpStep).toHaveClass("text-zinc-400");
  });

  it("READY status — CREATED through READY are highlighted, PICKED_UP is dimmed", () => {
    render(<OrderProgressTracker status="READY" />);
    const createdStep = screen.getByTestId("step-CREATED");
    const pendingStep = screen.getByTestId("step-PAYMENT_PENDING");
    const approvedStep = screen.getByTestId("step-PAYMENT_APPROVED");
    const preparingStep = screen.getByTestId("step-PREPARING");
    const readyStep = screen.getByTestId("step-READY");
    const pickedUpStep = screen.getByTestId("step-PICKED_UP");

    expect(createdStep).toHaveClass("text-zinc-900");
    expect(pendingStep).toHaveClass("text-zinc-900");
    expect(approvedStep).toHaveClass("text-zinc-900");
    expect(preparingStep).toHaveClass("text-zinc-900");
    expect(readyStep).toHaveClass("text-zinc-900");
    expect(pickedUpStep).toHaveClass("text-zinc-400");
  });

  it("renders all 6 step data-testid attributes", () => {
    render(<OrderProgressTracker status="PREPARING" />);
    expect(screen.getByTestId("step-CREATED")).toBeInTheDocument();
    expect(screen.getByTestId("step-PAYMENT_PENDING")).toBeInTheDocument();
    expect(screen.getByTestId("step-PAYMENT_APPROVED")).toBeInTheDocument();
    expect(screen.getByTestId("step-PREPARING")).toBeInTheDocument();
    expect(screen.getByTestId("step-READY")).toBeInTheDocument();
    expect(screen.getByTestId("step-PICKED_UP")).toBeInTheDocument();
  });

  it("CANCELLED — shows a message indicating cancellation", () => {
    render(<OrderProgressTracker status="CANCELLED" />);
    const cancelledEl = screen.getByTestId("cancelled-state");
    expect(cancelledEl.textContent).toMatch(/cancelado/i);
  });
});
