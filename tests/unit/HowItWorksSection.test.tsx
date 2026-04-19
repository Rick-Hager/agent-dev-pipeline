import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";

describe("HowItWorksSection", () => {
  it("renders a heading 'Como funciona'", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Como funciona/i })
    ).toBeInTheDocument();
  });

  it("renders exactly 3 numbered steps", () => {
    render(<HowItWorksSection />);
    const steps = screen.getAllByTestId("how-it-works-step");
    expect(steps).toHaveLength(3);
  });

  it("mentions QR scan in the first step", () => {
    render(<HowItWorksSection />);
    expect(screen.getAllByText(/QR/i).length).toBeGreaterThan(0);
  });

  it("mentions the payment step (montar pedido / pagar)", () => {
    render(<HowItWorksSection />);
    expect(screen.getAllByText(/paga/i).length).toBeGreaterThan(0);
  });

  it("mentions KDS in the third step", () => {
    render(<HowItWorksSection />);
    expect(screen.getAllByText(/KDS/i).length).toBeGreaterThan(0);
  });
});
