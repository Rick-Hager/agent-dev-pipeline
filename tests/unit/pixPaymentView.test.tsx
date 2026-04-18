// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PixPaymentView } from "@/components/PixPaymentView";

describe("PixPaymentView", () => {
  it("renders QR base64 image", () => {
    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    const img = screen.getByRole("img", { name: /qr code pix/i });
    expect(img.getAttribute("src")).toContain("iVBOR64");
  });

  it("copies payload to clipboard on button click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /copiar código pix/i })
    );
    expect(writeText).toHaveBeenCalledWith("PAYLOAD");
  });

  it("renders a fallback ticket link", () => {
    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    const link = screen.getByRole("link", { name: /abrir no mercado pago/i });
    expect(link.getAttribute("href")).toBe("https://mp/t/1");
  });
});
