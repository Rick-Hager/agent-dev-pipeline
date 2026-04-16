import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { OrderPagination } from "@/components/OrderPagination";

describe("OrderPagination", () => {
  it("renders page info 'Página 1 de 3'", () => {
    render(<OrderPagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
  });

  it("renders Previous and Next buttons", () => {
    render(<OrderPagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /anterior|previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximo|next/i })).toBeInTheDocument();
  });

  it("disables Previous button on page 1", () => {
    render(<OrderPagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    const prevButton = screen.getByRole("button", { name: /anterior|previous/i });
    expect(prevButton).toBeDisabled();
  });

  it("does not disable Previous button when not on page 1", () => {
    render(<OrderPagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    const prevButton = screen.getByRole("button", { name: /anterior|previous/i });
    expect(prevButton).not.toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(<OrderPagination page={3} totalPages={3} onPageChange={vi.fn()} />);
    const nextButton = screen.getByRole("button", { name: /próximo|next/i });
    expect(nextButton).toBeDisabled();
  });

  it("does not disable Next button when not on last page", () => {
    render(<OrderPagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    const nextButton = screen.getByRole("button", { name: /próximo|next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("calls onPageChange with page - 1 when Previous is clicked", () => {
    const onPageChange = vi.fn();
    render(<OrderPagination page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /anterior|previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with page + 1 when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(<OrderPagination page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /próximo|next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("is hidden when totalPages <= 1", () => {
    const { container } = render(
      <OrderPagination page={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("is visible when totalPages > 1", () => {
    render(<OrderPagination page={1} totalPages={2} onPageChange={vi.fn()} />);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });
});
