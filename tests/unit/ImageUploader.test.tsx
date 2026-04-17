import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploader } from "@/components/admin/ImageUploader";

function makeFile(name: string, type = "image/jpeg", bytes = 100): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("ImageUploader", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders the count indicator 0/5 when no images", () => {
    render(
      <ImageUploader slug="s" itemId="i1" initialImages={[]} />
    );
    expect(screen.getByText(/0\s*\/\s*5/)).toBeInTheDocument();
  });

  it("renders count indicator 2/5 when two images exist", () => {
    render(
      <ImageUploader
        slug="s"
        itemId="i1"
        initialImages={[
          { id: "a", url: "https://x/1.jpg", sortOrder: 0 },
          { id: "b", url: "https://x/2.jpg", sortOrder: 1 },
        ]}
      />
    );
    expect(screen.getByText(/2\s*\/\s*5/)).toBeInTheDocument();
  });

  it("renders a thumbnail for each image", () => {
    render(
      <ImageUploader
        slug="s"
        itemId="i1"
        initialImages={[
          { id: "a", url: "https://x/1.jpg", sortOrder: 0 },
          { id: "b", url: "https://x/2.jpg", sortOrder: 1 },
        ]}
      />
    );
    const thumbs = screen.getAllByRole("img");
    expect(thumbs).toHaveLength(2);
  });

  it("hides upload input when 5 images already exist", () => {
    const images = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      url: `https://x/${i}.jpg`,
      sortOrder: i,
    }));
    render(
      <ImageUploader slug="s" itemId="i1" initialImages={images} />
    );
    expect(
      screen.queryByLabelText(/adicionar imagem/i)
    ).not.toBeInTheDocument();
  });

  it("uploads a file via POST when input changes", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "new",
        url: "https://x/new.jpg",
        sortOrder: 0,
      }),
    });
    render(
      <ImageUploader slug="s" itemId="i1" initialImages={[]} />
    );
    const input = screen.getByLabelText(/adicionar imagem/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("a.jpg")] } });

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/restaurants/s/menu-items/i1/images",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("shows error when upload fails", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "File size exceeds 5MB limit" }),
    });
    render(
      <ImageUploader slug="s" itemId="i1" initialImages={[]} />
    );
    const input = screen.getByLabelText(/adicionar imagem/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("big.jpg")] } });

    await waitFor(() =>
      expect(screen.getByText(/File size exceeds 5MB limit/)).toBeInTheDocument()
    );
  });

  it("removes an image when delete clicked", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    render(
      <ImageUploader
        slug="s"
        itemId="i1"
        initialImages={[
          { id: "a", url: "https://x/1.jpg", sortOrder: 0 },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remover imagem/i }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/restaurants/s/menu-items/i1/images/a",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });
});
