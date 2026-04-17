"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryImage {
  id: string;
  url: string;
  sortOrder?: number;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  itemName?: string;
}

const SWIPE_THRESHOLD = 50;

export function ImageGallery({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
  itemName,
}: ImageGalleryProps) {
  const [state, setState] = useState({
    lastIsOpen: isOpen,
    currentIndex: initialIndex,
  });
  if (isOpen && !state.lastIsOpen) {
    setState({ lastIsOpen: true, currentIndex: initialIndex });
  } else if (!isOpen && state.lastIsOpen) {
    setState((prev) => ({ ...prev, lastIsOpen: false }));
  }
  const currentIndex = state.currentIndex;
  const setCurrentIndex = (updater: number | ((prev: number) => number)) => {
    setState((prev) => ({
      ...prev,
      currentIndex:
        typeof updater === "function" ? updater(prev.currentIndex) : updater,
    }));
  };
  const touchStartX = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((idx) => Math.min(idx + 1, images.length - 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((idx) => Math.max(idx - 1, 0));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose, images.length]);

  if (!isOpen || images.length === 0) return null;

  const go = (delta: number) => {
    setCurrentIndex((idx) => {
      const next = idx + delta;
      if (next < 0) return 0;
      if (next >= images.length) return images.length - 1;
      return next;
    });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      go(dx < 0 ? 1 : -1);
    }
    touchStartX.current = null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragStartX.current = e.clientX;
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      go(dx < 0 ? 1 : -1);
    }
    dragStartX.current = null;
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={itemName ? `Galeria de ${itemName}` : "Galeria de imagens"}
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
    >
      <button
        type="button"
        aria-label="Fechar galeria"
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 text-white text-3xl leading-none p-2 hover:bg-white/10 rounded-full"
      >
        ×
      </button>

      <div
        data-testid="gallery-slider"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        className="relative w-full h-full flex items-center justify-center select-none"
      >
        {images.map((img, idx) => (
          <img
            key={img.id}
            src={img.url}
            alt={`Imagem ${idx + 1}`}
            draggable={false}
            className={
              idx === currentIndex
                ? "max-w-full max-h-full object-contain"
                : "hidden"
            }
          />
        ))}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {images.map((img, idx) => (
          <button
            key={img.id}
            type="button"
            aria-label={`Ir para imagem ${idx + 1}`}
            aria-current={idx === currentIndex}
            onClick={() => setCurrentIndex(idx)}
            className={
              idx === currentIndex
                ? "w-3 h-3 rounded-full bg-white"
                : "w-3 h-3 rounded-full bg-white/40 hover:bg-white/60"
            }
          />
        ))}
      </div>
    </div>
  );
}
