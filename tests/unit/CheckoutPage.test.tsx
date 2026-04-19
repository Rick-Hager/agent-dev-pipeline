import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// Hoisted mocks
const { useCartMock, useRouterMock, useParamsMock } = vi.hoisted(() => {
  const useCartMock = vi.fn();
  const useRouterMock = vi.fn();
  const useParamsMock = vi.fn();
  return { useCartMock, useRouterMock, useParamsMock };
});

vi.mock("@/components/CartProvider", () => ({
  useCart: useCartMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
  useParams: useParamsMock,
}));

import CheckoutPage from "@/app/[slug]/checkout/page";

const pushMock = vi.fn();
const clearCartMock = vi.fn();

const fakeItems = [
  { id: "item-1", name: "X-Burguer", priceInCents: 2000, quantity: 2 },
  { id: "item-2", name: "Fritas", priceInCents: 800, quantity: 1 },
];

function setupMocks(items = fakeItems) {
  useParamsMock.mockReturnValue({ slug: "lanche-do-ze" });
  useRouterMock.mockReturnValue({ push: pushMock });
  useCartMock.mockReturnValue({
    items,
    slug: "lanche-do-ze",
    totalInCents: items.reduce((acc, i) => acc + i.priceInCents * i.quantity, 0),
    clearCart: clearCartMock,
  });
}

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "maria@example.com" } });
}

function submitForm(buttonName: RegExp) {
  return act(async () => {
    fireEvent.submit(
      screen.getByRole("button", { name: buttonName }).closest("form")!
    );
  });
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    global.fetch = vi.fn();
    sessionStorage.clear();
  });

  it("renders back link to cart", () => {
    render(<CheckoutPage />);
    const link = screen.getByRole("link", { name: /voltar ao carrinho/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/lanche-do-ze/cart");
  });

  it("renders order summary with item names and quantities", () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/X-Burguer/)).toBeInTheDocument();
    expect(screen.getByText(/Fritas/)).toBeInTheDocument();
  });

  it("renders unit prices in R$ X,XX format", () => {
    render(<CheckoutPage />);
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
    const eightReal = screen.getAllByText("R$ 8,00");
    expect(eightReal.length).toBeGreaterThanOrEqual(1);
  });

  it("renders line totals for each item", () => {
    render(<CheckoutPage />);
    expect(screen.getByText("R$ 40,00")).toBeInTheDocument();
  });

  it("renders grand total", () => {
    render(<CheckoutPage />);
    expect(screen.getByText("R$ 48,00")).toBeInTheDocument();
  });

  it("renders customerName input with label Nome", () => {
    render(<CheckoutPage />);
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("renders customerPhone input with label Telefone", () => {
    render(<CheckoutPage />);
    expect(screen.getByLabelText("Telefone")).toBeInTheDocument();
  });

  it("renders customerEmail input with label E-mail", () => {
    render(<CheckoutPage />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it('renders submit button labeled "Pagar com PIX" by default', () => {
    render(<CheckoutPage />);
    expect(
      screen.getByRole("button", { name: /pagar com pix/i })
    ).toBeInTheDocument();
  });

  it('button label changes to "Ir para o pagamento" when Cartão selected', () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByLabelText(/Cart[ãa]o/i));
    expect(
      screen.getByRole("button", { name: /ir para o pagamento/i })
    ).toBeInTheDocument();
  });

  it("renders payment method radios PIX and Cartão", () => {
    render(<CheckoutPage />);
    expect(screen.getByLabelText(/PIX/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cart[ãa]o/i)).toBeInTheDocument();
  });

  it("defaults payment method to PIX", () => {
    render(<CheckoutPage />);
    expect((screen.getByLabelText(/PIX/i) as HTMLInputElement).checked).toBe(true);
  });

  it("shows CPF input only when Cartão is selected", () => {
    render(<CheckoutPage />);
    expect(screen.queryByLabelText(/CPF/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Cart[ãa]o/i));
    expect(screen.getByLabelText(/CPF/i)).toBeInTheDocument();
  });

  it("shows empty cart message and menu link when cart is empty", () => {
    setupMocks([]);
    render(<CheckoutPage />);
    expect(screen.getByText(/carrinho está vazio/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ver cardápio/i });
    expect(link).toHaveAttribute("href", "/lanche-do-ze");
  });

  it("does not render form when cart is empty", () => {
    setupMocks([]);
    render(<CheckoutPage />);
    expect(
      screen.queryByRole("button", { name: /pagar com pix/i })
    ).not.toBeInTheDocument();
  });

  it("applies Brazilian phone mask as user types", async () => {
    render(<CheckoutPage />);
    const phoneInput = screen.getByLabelText("Telefone");
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: "11987654321" } });
    });
    expect((phoneInput as HTMLInputElement).value).toBe("(11) 98765-4321");
  });

  it("applies partial phone mask while typing", async () => {
    render(<CheckoutPage />);
    const phoneInput = screen.getByLabelText("Telefone");
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: "119" } });
    });
    expect((phoneInput as HTMLInputElement).value).toBe("(11) 9");
  });

  it("shows inline error if phone has fewer than 10 digits on submit", async () => {
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "João" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "j@ex.com" } });
    await submitForm(/pagar com pix/i);
    expect(screen.getByText("Telefone inválido")).toBeInTheDocument();
  });

  it("shows inline error if email is invalid on submit", async () => {
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "João" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "not-an-email" } });
    await submitForm(/pagar com pix/i);
    expect(screen.getByText("E-mail inválido")).toBeInTheDocument();
  });

  it("PIX submit: creates order then calls /pay/pix (no body) and routes to order page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentId: "PAY_1" }),
      });
    render(<CheckoutPage />);
    fillCommonFields();
    await submitForm(/pagar com pix/i);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/restaurants/lanche-do-ze/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          customerName: "Maria Silva",
          customerPhone: "11987654321",
          customerEmail: "maria@example.com",
          items: [
            { menuItemId: "item-1", quantity: 2 },
            { menuItemId: "item-2", quantity: 1 },
          ],
        }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/restaurants/lanche-do-ze/orders/order-abc/pay/pix",
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/lanche-do-ze/pedido/order-abc");
    });
  });

  it("CARD submit: creates order, stores CPF in sessionStorage, routes to /checkout/cartao/[orderId]", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "order-abc", orderNumber: 5 }),
    });
    render(<CheckoutPage />);
    fillCommonFields();
    fireEvent.click(screen.getByLabelText(/Cart[ãa]o/i));
    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "191.191.191-00" },
    });
    await submitForm(/ir para o pagamento/i);

    // Only one fetch (order creation); no /pay/pix call
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("order-order-abc-cpf")).toBe("19119119100");
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/lanche-do-ze/checkout/cartao/order-abc"
      );
    });
  });

  it("CARD submit: rejects if CPF is invalid", async () => {
    render(<CheckoutPage />);
    fillCommonFields();
    fireEvent.click(screen.getByLabelText(/Cart[ãa]o/i));
    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "123" },
    });
    await submitForm(/ir para o pagamento/i);
    expect(screen.getByText("CPF inválido")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clears cart on successful PIX flow", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentId: "PAY_1" }),
      });
    render(<CheckoutPage />);
    fillCommonFields();
    await submitForm(/pagar com pix/i);
    await waitFor(() => {
      expect(clearCartMock).toHaveBeenCalled();
    });
  });

  it("shows PIX error message when /pay/pix fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "no token" }),
      });
    render(<CheckoutPage />);
    fillCommonFields();
    await submitForm(/pagar com pix/i);
    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível gerar o PIX. Tente novamente.")
      ).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows error message on order API failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    render(<CheckoutPage />);
    fillCommonFields();
    await submitForm(/pagar com pix/i);
    await waitFor(() => {
      expect(
        screen.getByText("Erro ao realizar pedido. Tente novamente.")
      ).toBeInTheDocument();
    });
  });

  it("disables submit button while submitting", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pendingPromise);
    render(<CheckoutPage />);
    fillCommonFields();
    act(() => {
      fireEvent.submit(
        screen.getByRole("button", { name: /pagar com pix/i }).closest("form")!
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar com pix/i })).toBeDisabled();
    });
    act(() => {
      resolvePromise!({ ok: false, json: async () => ({}) });
    });
  });
});
