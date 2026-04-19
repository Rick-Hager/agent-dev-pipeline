import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ContactForm from "@/components/ContactForm";

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders all required fields", () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/^nome$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do restaurante/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^endereço$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pedidos por dia/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar/i })).toBeInTheDocument();
  });

  it("calls API on valid submit and shows success message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: "formulário enviado" }),
    });

    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: "João Silva" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "joao@email.com" },
    });
    fireEvent.change(screen.getByLabelText(/nome do restaurante/i), {
      target: { value: "Pizzaria do João" },
    });
    fireEvent.change(screen.getByLabelText(/endereço/i), {
      target: { value: "Rua A, 123" },
    });
    fireEvent.change(screen.getByLabelText(/pedidos por dia/i), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "João Silva",
          email: "joao@email.com",
          nomeRestaurante: "Pizzaria do João",
          endereco: "Rua A, 123",
          pedidosPorDia: "50",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/formulário enviado/i)).toBeInTheDocument();
    });
  });

  it("shows error on invalid email format", async () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: "João Silva" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "invalid-email" },
    });
    fireEvent.change(screen.getByLabelText(/nome do restaurante/i), {
      target: { value: "Pizzaria do João" },
    });
    fireEvent.change(screen.getByLabelText(/endereço/i), {
      target: { value: "Rua A, 123" },
    });
    fireEvent.change(screen.getByLabelText(/pedidos por dia/i), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    });

    // Should not call API with invalid email
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows error when API returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ success: false, message: "Erro no servidor" }),
    });

    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: "João Silva" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "joao@email.com" },
    });
    fireEvent.change(screen.getByLabelText(/nome do restaurante/i), {
      target: { value: "Pizzaria do João" },
    });
    fireEvent.change(screen.getByLabelText(/endereço/i), {
      target: { value: "Rua A, 123" },
    });
    fireEvent.change(screen.getByLabelText(/pedidos por dia/i), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/erro/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(promise);

    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: "João Silva" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "joao@email.com" },
    });
    fireEvent.change(screen.getByLabelText(/nome do restaurante/i), {
      target: { value: "Pizzaria do João" },
    });
    fireEvent.change(screen.getByLabelText(/endereço/i), {
      target: { value: "Rua A, 123" },
    });
    fireEvent.change(screen.getByLabelText(/pedidos por dia/i), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });

    // Cleanup: resolve the promise
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ success: true, message: "formulário enviado" }),
    });
  });
});
