import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const { notFoundMock, prismaMock } = vi.hoisted(() => {
  const notFoundMock = vi.fn();
  const prismaMock = {
    order: {
      findUnique: vi.fn(),
    },
  };
  return { notFoundMock, prismaMock };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import OrderStatusPage from "@/app/[slug]/pedido/[orderId]/page";

const fakeOrder = {
  id: "order-abc",
  orderNumber: 7,
  status: "CREATED" as const,
  totalInCents: 4800,
  customerName: "Maria Silva",
  restaurantId: "rest-1",
  items: [
    { id: "oi-1", name: "X-Burguer", priceInCents: 2000, quantity: 2, orderId: "order-abc", menuItemId: "item-1" },
    { id: "oi-2", name: "Fritas", priceInCents: 800, quantity: 1, orderId: "order-abc", menuItemId: "item-2" },
  ],
};

async function renderPage(slug: string, orderId: string) {
  const jsx = await OrderStatusPage({ params: Promise.resolve({ slug, orderId }) });
  render(jsx as React.ReactElement);
}

describe("OrderStatusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.findUnique.mockResolvedValue(fakeOrder);
  });

  it("renders the order number as heading", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByRole("heading", { name: /pedido #7/i })).toBeInTheDocument();
  });

  it("renders CREATED status as 'Aguardando pagamento'", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
  });

  it("renders PAYMENT_PENDING status as 'Pagamento pendente'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "PAYMENT_PENDING" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Pagamento pendente")).toBeInTheDocument();
  });

  it("renders PAYMENT_APPROVED status as 'Pagamento aprovado'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "PAYMENT_APPROVED" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Pagamento aprovado")).toBeInTheDocument();
  });

  it("renders PREPARING status as 'Em preparo'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "PREPARING" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Em preparo")).toBeInTheDocument();
  });

  it("renders READY status as 'Pronto para retirada'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "READY" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Pronto para retirada")).toBeInTheDocument();
  });

  it("renders PICKED_UP status as 'Retirado'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "PICKED_UP" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Retirado")).toBeInTheDocument();
  });

  it("renders CANCELLED status as 'Cancelado'", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...fakeOrder, status: "CANCELLED" });
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("renders item names", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText(/X-Burguer/)).toBeInTheDocument();
    expect(screen.getByText(/Fritas/)).toBeInTheDocument();
  });

  it("renders item quantities", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    // X-Burguer with quantity 2 should appear as "X-Burguer × 2"
    expect(screen.getByText(/X-Burguer.*2/)).toBeInTheDocument();
  });

  it("renders item unit prices in R$ X,XX format", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
    const eightReal = screen.getAllByText("R$ 8,00");
    expect(eightReal.length).toBeGreaterThanOrEqual(1);
  });

  it("renders total in R$ X,XX format", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(screen.getByText("R$ 48,00")).toBeInTheDocument();
  });

  it("renders 'Voltar ao início' link to restaurant menu", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    const link = screen.getByRole("link", { name: /voltar ao início/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/lanche-do-ze");
  });

  it("calls notFound when order does not exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(renderPage("lanche-do-ze", "nonexistent")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("fetches order by orderId", async () => {
    await renderPage("lanche-do-ze", "order-abc");
    expect(prismaMock.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-abc" },
      })
    );
  });
});
