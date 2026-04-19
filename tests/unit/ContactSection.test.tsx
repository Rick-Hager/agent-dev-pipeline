import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactSection } from "@/components/landing/ContactSection";

describe("ContactSection", () => {
  it("renders a section with id='contato'", () => {
    const { container } = render(<ContactSection />);
    const section = container.querySelector("section#contato");
    expect(section).not.toBeNull();
  });

  it("renders heading 'Contato'", () => {
    render(<ContactSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Contato/i })
    ).toBeInTheDocument();
  });

  it("renders a mailto link as CTA", () => {
    render(<ContactSection />);
    const mailto = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href")?.startsWith("mailto:"));
    expect(mailto).toBeDefined();
  });
});
