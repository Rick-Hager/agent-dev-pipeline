import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsumerSection } from "@/components/landing/ConsumerSection";

describe("ConsumerSection", () => {
  it("renders heading 'Para o consumidor'", () => {
    render(<ConsumerSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Para o consumidor/i })
    ).toBeInTheDocument();
  });

  it("mentions sem filas", () => {
    render(<ConsumerSection />);
    expect(screen.getByText(/sem filas/i)).toBeInTheDocument();
  });

  it("mentions sem cadastro", () => {
    render(<ConsumerSection />);
    expect(screen.getByText(/sem cadastro/i)).toBeInTheDocument();
  });

  it("mentions PIX ou cartão", () => {
    render(<ConsumerSection />);
    expect(screen.getByText(/PIX ou cartão/i)).toBeInTheDocument();
  });
});
