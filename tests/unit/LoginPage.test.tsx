import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// Hoisted mocks
const { useRouterMock } = vi.hoisted(() => {
  const useRouterMock = vi.fn();
  return { useRouterMock };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import LoginPage from "@/app/backoffice/login/page";

const pushMock = vi.fn();

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    global.fetch = vi.fn();
  });

  it("renders email input with label Email", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders password input with label Password", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders submit button labeled Sign in", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("email input has type email", () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("password input has type password", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows error message on invalid credentials (401)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials" }),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Sign in" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("redirects to /backoffice/dashboard on successful login", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "rest-1",
        name: "My Restaurant",
        slug: "my-restaurant",
        email: "owner@example.com",
      }),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correctpassword" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Sign in" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/backoffice/dashboard");
    });
  });

  it("calls POST /api/auth/login with email and password", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "rest-1",
        name: "My Restaurant",
        slug: "my-restaurant",
        email: "owner@example.com",
      }),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "mypassword" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Sign in" }).closest("form")!
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "owner@example.com",
          password: "mypassword",
        }),
      })
    );
  });

  it("disables submit button while submitting", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      pendingPromise
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "mypassword" },
    });

    act(() => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Sign in" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    });

    // Clean up
    act(() => {
      resolvePromise!({ ok: false, json: async () => ({}) });
    });
  });
});
