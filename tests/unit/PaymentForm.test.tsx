import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

const { loadStripeMock, confirmPixPaymentMock, confirmCardPaymentMock, pushMock } =
  vi.hoisted(() => ({
    loadStripeMock: vi.fn(),
    confirmPixPaymentMock: vi.fn(),
    confirmCardPaymentMock: vi.fn(),
    pushMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: loadStripeMock,
}));

// Minimal Stripe Elements mock. CardElement renders a stable placeholder,
// Elements passes children through, and useStripe/useElements return fakes.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "elements" }, children),
  CardElement: () =>
    React.createElement("div", { "data-testid": "card-element" }, "Card Element"),
  useStripe: () => ({
    confirmPixPayment: confirmPixPaymentMock,
    confirmCardPayment: confirmCardPaymentMock,
  }),
  useElements: () => ({
    getElement: () => ({}),
  }),
}));

import { PaymentForm } from "@/components/PaymentForm";

describe("PaymentForm (PIX)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStripeMock.mockResolvedValue({});
  });

  it("renders PIX header and QR placeholder when paymentMethod is PIX", () => {
    render(
      <PaymentForm
        clientSecret="pi_pix_secret"
        publishableKey="pk_test_123"
        paymentMethod="PIX"
        slug="my-rest"
        orderId="order-1"
      />
    );
    expect(screen.getByText(/Pagamento PIX/i)).toBeInTheDocument();
    expect(screen.getByTestId("pix-qr")).toBeInTheDocument();
  });

  it("does NOT render a card form when paymentMethod is PIX", () => {
    render(
      <PaymentForm
        clientSecret="pi_pix_secret"
        publishableKey="pk_test_123"
        paymentMethod="PIX"
        slug="my-rest"
        orderId="order-1"
      />
    );
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
  });
});

describe("PaymentForm (CARD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStripeMock.mockResolvedValue({});
  });

  it("renders Stripe Elements with a card element and a Pay button", async () => {
    render(
      <PaymentForm
        clientSecret="pi_card_secret"
        publishableKey="pk_test_123"
        paymentMethod="CARD"
        slug="my-rest"
        orderId="order-2"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("elements")).toBeInTheDocument();
      expect(screen.getByTestId("card-element")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /pagar/i })).toBeInTheDocument();
  });

  it("calls stripe.confirmCardPayment when the Pay button is clicked", async () => {
    confirmCardPaymentMock.mockResolvedValueOnce({
      paymentIntent: { status: "succeeded" },
    });

    render(
      <PaymentForm
        clientSecret="pi_card_secret"
        publishableKey="pk_test_123"
        paymentMethod="CARD"
        slug="my-rest"
        orderId="order-2"
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /pagar/i })).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /pagar/i }));
    });

    expect(confirmCardPaymentMock).toHaveBeenCalledWith(
      "pi_card_secret",
      expect.objectContaining({
        payment_method: expect.objectContaining({
          card: expect.anything(),
        }),
      })
    );
  });
});
