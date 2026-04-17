import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageGallery } from "@/components/ImageGallery";

const IMAGES = [
  { id: "1", url: "https://img.test/a.jpg", sortOrder: 0 },
  { id: "2", url: "https://img.test/b.jpg", sortOrder: 1 },
  { id: "3", url: "https://img.test/c.jpg", sortOrder: 2 },
];

describe("ImageGallery", () => {
  it("renders nothing when images array is empty", () => {
    const { container } = render(
      <ImageGallery images={[]} isOpen={true} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ImageGallery images={IMAGES} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the current image when open", () => {
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={vi.fn()} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0]).toHaveAttribute("src", IMAGES[0].url);
  });

  it("renders a dot indicator per image", () => {
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={vi.fn()} />);
    const dots = screen.getAllByRole("button", { name: /ir para imagem/i });
    expect(dots).toHaveLength(IMAGES.length);
  });

  it("clicking a dot navigates to that image", () => {
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={vi.fn()} />);
    const dots = screen.getAllByRole("button", { name: /ir para imagem/i });
    fireEvent.click(dots[2]);
    const activeImg = screen.getByAltText(/imagem 3/i);
    expect(activeImg).toBeInTheDocument();
  });

  it("close button triggers onClose", () => {
    const onClose = vi.fn();
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key triggers onClose", () => {
    const onClose = vi.fn();
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("swipe left (touch) advances to next image", () => {
    render(<ImageGallery images={IMAGES} isOpen={true} onClose={vi.fn()} />);
    const slider = screen.getByTestId("gallery-slider");

    fireEvent.touchStart(slider, {
      touches: [{ clientX: 300, clientY: 200 }],
    });
    fireEvent.touchMove(slider, {
      touches: [{ clientX: 100, clientY: 200 }],
    });
    fireEvent.touchEnd(slider, {
      changedTouches: [{ clientX: 100, clientY: 200 }],
    });

    expect(screen.getByAltText(/imagem 2/i)).toBeInTheDocument();
  });

  it("swipe right (touch) goes to previous image", () => {
    render(
      <ImageGallery
        images={IMAGES}
        isOpen={true}
        onClose={vi.fn()}
        initialIndex={1}
      />
    );
    const slider = screen.getByTestId("gallery-slider");

    fireEvent.touchStart(slider, {
      touches: [{ clientX: 100, clientY: 200 }],
    });
    fireEvent.touchMove(slider, {
      touches: [{ clientX: 300, clientY: 200 }],
    });
    fireEvent.touchEnd(slider, {
      changedTouches: [{ clientX: 300, clientY: 200 }],
    });

    expect(screen.getByAltText(/imagem 1/i)).toBeInTheDocument();
  });

  it("does not wrap past the last image on swipe left", () => {
    render(
      <ImageGallery
        images={IMAGES}
        isOpen={true}
        onClose={vi.fn()}
        initialIndex={IMAGES.length - 1}
      />
    );
    const slider = screen.getByTestId("gallery-slider");
    fireEvent.touchStart(slider, { touches: [{ clientX: 300, clientY: 0 }] });
    fireEvent.touchEnd(slider, {
      changedTouches: [{ clientX: 50, clientY: 0 }],
    });
    expect(screen.getByAltText(new RegExp(`imagem ${IMAGES.length}`, "i"))).toBeInTheDocument();
  });
});
