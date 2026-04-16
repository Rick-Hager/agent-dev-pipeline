import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import SettingsForm from "@/components/SettingsForm";

const defaultSettings = {
  id: "rest-1",
  name: "Test Restaurant",
  slug: "test-restaurant",
  logo: "",
  email: "test@test.com",
  businessHours: "",
  stripePublishableKey: "pk_test_abc123",
  stripeSecretKeyMasked: "****3456" as string | null,
  whatsappNumber: "",
  whatsappMessageTemplate: "",
};

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the restaurant name input with current value", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    const nameInput = screen.getByLabelText(/nome do restaurante/i);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue("Test Restaurant");
  });

  it("renders the slug input with current value", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    const slugInput = screen.getByLabelText(/slug/i);
    expect(slugInput).toBeInTheDocument();
    expect(slugInput).toHaveValue("test-restaurant");
  });

  it("renders the logo URL input", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByLabelText(/logo url/i)).toBeInTheDocument();
  });

  it("renders the business hours textarea", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByLabelText(/horários de funcionamento/i)).toBeInTheDocument();
  });

  it("renders the stripe publishable key input", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    const pkInput = screen.getByLabelText(/publishable key/i);
    expect(pkInput).toBeInTheDocument();
    expect(pkInput).toHaveValue("pk_test_abc123");
  });

  it("renders the stripe secret key input (masked)", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    const skInput = screen.getByLabelText(/secret key/i);
    expect(skInput).toBeInTheDocument();
    expect(skInput).toHaveAttribute("type", "password");
  });

  it("shows the masked secret key hint when a key is already set", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByText(/\*\*\*\*3456/)).toBeInTheDocument();
  });

  it("renders the whatsapp number input", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByLabelText(/número do whatsapp/i)).toBeInTheDocument();
  });

  it("renders the whatsapp message template textarea", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByLabelText(/template de mensagem/i)).toBeInTheDocument();
  });

  it("renders a save button", () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("shows success message after successful save", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...defaultSettings }),
    });

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/configurações salvas/i)).toBeInTheDocument();
    });
  });

  it("shows error message when save fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Slug already taken" }),
    });

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/slug already taken/i)).toBeInTheDocument();
    });
  });

  it("does not include stripeSecretKey in PATCH body when field is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...defaultSettings }),
    });

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.stripeSecretKey).toBeUndefined();
  });

  it("includes stripeSecretKey in PATCH body when user types a new value", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...defaultSettings }),
    });

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    fireEvent.change(screen.getByLabelText(/secret key/i), {
      target: { value: "sk_live_newvalue123" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.stripeSecretKey).toBe("sk_live_newvalue123");
  });

  it("calls PATCH on the correct settings endpoint", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...defaultSettings }),
    });

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/restaurants/test-restaurant/settings");
    expect(options.method).toBe("PATCH");
  });

  it("disables save button while submitting", async () => {
    let resolve: (v: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);

    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    act(() => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /salvando/i })).toBeDisabled();
    });

    act(() => {
      resolve!({ ok: false, json: async () => ({}) });
    });
  });

  it("shows error for invalid JSON in businessHours field", async () => {
    render(<SettingsForm initialSettings={defaultSettings} slug="test-restaurant" />);

    fireEvent.change(screen.getByLabelText(/horários de funcionamento/i), {
      target: { value: "{ invalid json" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /salvar/i }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/business hours must be valid json/i)
      ).toBeInTheDocument();
    });

    // fetch should NOT have been called (validation failed before network)
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
