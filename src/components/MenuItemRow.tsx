"use client";

import { useState, type ReactNode } from "react";
import { ImageGallery, type GalleryImage } from "@/components/ImageGallery";

interface MenuItemRowProps {
  name: string;
  description: string | null;
  priceInCents: number;
  images: GalleryImage[];
  addToCart: ReactNode;
}

export function MenuItemRow({
  name,
  description,
  priceInCents,
  images,
  addToCart,
}: MenuItemRowProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const thumbnail = images[0];

  return (
    <div className="flex items-start gap-3">
      {thumbnail ? (
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          aria-label={`Abrir galeria de ${name}`}
          className="shrink-0 w-16 h-16 rounded overflow-hidden border border-zinc-200"
        >
          <img
            src={thumbnail.url}
            alt={name}
            className="w-full h-full object-cover"
            data-testid="menu-item-thumbnail"
          />
        </button>
      ) : (
        <div
          aria-hidden="true"
          data-testid="menu-item-placeholder"
          className="shrink-0 w-16 h-16 rounded border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 text-xl"
        >
          🍽
        </div>
      )}

      <div className="flex-1 mr-4">
        <p className="font-medium">{name}</p>
        {description ? (
          <p
            data-testid="item-description"
            className="text-sm text-zinc-500 mt-0.5"
          >
            {description}
          </p>
        ) : null}
        {addToCart}
      </div>
      <p className="font-medium whitespace-nowrap">
        R$ {(priceInCents / 100).toFixed(2).replace(".", ",")}
      </p>

      {images.length > 0 && (
        <ImageGallery
          images={images}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          itemName={name}
        />
      )}
    </div>
  );
}
