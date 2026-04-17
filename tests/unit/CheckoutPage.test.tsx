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

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    global.fetch = vi.fn();
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

  it('renders submit button labeled "Ir para pagamento"', () => {
    render(<CheckoutPage />);
    expect(
      screen.getByRole("button", { name: "Ir para pagamento" })
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
      screen.queryByRole("button", { name: "Ir para pagamento" })
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
    const nameInput = screen.getByLabelText("Nome");
    const phoneInput = screen.getByLabelText("Telefone");
    fireEvent.change(nameInput, { target: { value: "João" } });
    fireEvent.change(phoneInput, { target: { value: "123" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
    expect(screen.getByText("Telefone inválido")).toBeInTheDocument();
  });

  it("submits form: creates order then payment preference with PIX by default", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirectUrl: "https://mercadopago.test/pay/pref_1",
          preferenceId: "pref_1",
          paymentMethod: "PIX",
        }),
      });
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
    // First call: create order
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/restaurants/lanche-do-ze/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          customerName: "Maria Silva",
          customerPhone: "11987654321",
          items: [
            { menuItemId: "item-1", quantity: 2 },
            { menuItemId: "item-2", quantity: 1 },
          ],
        }),
      })
    );
    // Second call: create preference with PIX
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/restaurants/lanche-do-ze/orders/order-abc/pay",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ paymentMethod: "PIX" }),
      })
    );
  });

  it("sends paymentMethod CARD when user selects Cartão", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirectUrl: "https://mercadopago.test/pay/pref_1",
          preferenceId: "pref_1",
          paymentMethod: "CARD",
        }),
      });
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    fireEvent.click(screen.getByLabelText(/Cart[ãa]o/i));
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/restaurants/lanche-do-ze/orders/order-abc/pay",
      expect.objectContaining({
        body: JSON.stringify({ paymentMethod: "CARD" }),
      })
    );
  });

  it("redirects to MercadoPago redirectUrl after successful pay", async () => {
    const originalLocation = window.location;
    const assignedHrefs: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        set href(v: string) {
          assignedHrefs.push(v);
        },
        get href() {
          return assignedHrefs[assignedHrefs.length - 1] ?? "";
        },
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirectUrl: "https://mercadopago.test/pay/pref_xyz",
          preferenceId: "pref_xyz",
          paymentMethod: "PIX",
        }),
      });

    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(assignedHrefs).toContain("https://mercadopago.test/pay/pref_xyz");
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("clears cart on successful order creation + pay", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "order-abc", orderNumber: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirectUrl: "https://mercadopago.test/pref",
          preferenceId: "pref",
          paymentMethod: "PIX",
        }),
      });
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
    await waitFor(() => {
      expect(clearCartMock).toHaveBeenCalled();
    });
  });

  it("falls back to order status page when payment API fails (no MP token)", async () => {
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
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/lanche-do-ze/pedido/order-abc");
    });
  });

  it("shows error message on order API failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    render(<CheckoutPage />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Ir para pagamento" }).closest("form")!
      );
    });
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
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
    act(() => {
      fireEvent.submit(
        screen.getByRole("button", { name: /ir para pagamento/i }).closest("form")!
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ir para pagamento/i })).toBeDisabled();
    });
    act(() => {
      resolvePromise!({ ok: false, json: async () => ({}) });
    });
  });
});
