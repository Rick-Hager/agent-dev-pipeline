import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { OrderFilters } from "@/components/OrderFilters";

const defaultProps = {
  status: "",
  dateFrom: "2026-04-16",
  dateTo: "2026-04-16",
  onStatusChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
};

describe("OrderFilters", () => {
  it("renders status dropdown with 'Todos' as first option", () => {
    render(<OrderFilters {...defaultProps} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
  });

  it("renders all OrderStatus options", () => {
    render(<OrderFilters {...defaultProps} />);
    expect(screen.getByRole("option", { name: "CREATED" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PAYMENT_PENDING" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PAYMENT_APPROVED" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PREPARING" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "READY" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PICKED_UP" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CANCELLED" })).toBeInTheDocument();
  });

  it("calls onStatusChange when dropdown value changes", () => {
    const onStatusChange = vi.fn();
    render(<OrderFilters {...defaultProps} onStatusChange={onStatusChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "PREPARING" } });
    expect(onStatusChange).toHaveBeenCalledWith("PREPARING");
  });

  it("renders dateFrom date input", () => {
    render(<OrderFilters {...defaultProps} />);
    const inputs = screen.getAllByDisplayValue("2026-04-16");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onDateFromChange when dateFrom input changes", () => {
    const onDateFromChange = vi.fn();
    render(<OrderFilters {...defaultProps} onDateFromChange={onDateFromChange} />);
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-04-01" } });
    expect(onDateFromChange).toHaveBeenCalledWith("2026-04-01");
  });

  it("calls onDateToChange when dateTo input changes", () => {
    const onDateToChange = vi.fn();
    render(<OrderFilters {...defaultProps} onDateToChange={onDateToChange} />);
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: "2026-04-30" } });
    expect(onDateToChange).toHaveBeenCalledWith("2026-04-30");
  });

  it("reflects current status value in dropdown", () => {
    render(<OrderFilters {...defaultProps} status="READY" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("READY");
  });
});
