import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { OrderStatusPolling } from "@/components/OrderStatusPolling";

describe("OrderStatusPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders OrderProgressTracker with initialStatus after timers fire", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ status: "CREATED" }),
    }));

    render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );

    // Advance past the setTimeout(0) that initializes the status
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId("progress-tracker")).toBeInTheDocument();
    expect(screen.getByTestId("step-CREATED")).toHaveClass("text-zinc-900");
  });

  it("polls fetch every 5 seconds", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ status: "CREATED" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );

    // Advance past the init setTimeout(0)
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // No fetch calls yet
    expect(mockFetch).not.toHaveBeenCalled();

    // After 5 seconds, one call
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After another 5 seconds, two calls
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("calls fetch with correct URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ status: "CREATED" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );

    // Advance past init
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Advance to first poll
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/restaurants/lanche-do-ze/orders/order-abc"
    );
  });

  it("updates status when fetch returns a new status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ status: "PREPARING" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );

    // Advance past init
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Initially CREATED is highlighted
    expect(screen.getByTestId("step-CREATED")).toHaveClass("text-zinc-900");
    expect(screen.getByTestId("step-PREPARING")).toHaveClass("text-zinc-400");

    // After polling, status should update to PREPARING
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("step-PREPARING")).toHaveClass("text-zinc-900");
  });

  it("cleans up timers on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ status: "CREATED" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    let unmountFn: () => void;
    render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );

    unmountFn = () => {
      // Unmount via cleanup
    };

    const { unmount } = render(
      <OrderStatusPolling
        initialStatus="CREATED"
        slug="lanche-do-ze"
        orderId="order-abc"
      />
    );
    unmountFn = unmount;

    unmountFn();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
