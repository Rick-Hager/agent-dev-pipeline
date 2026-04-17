"use client";

import { useState, useRef } from "react";
import { MAX_IMAGES_PER_ITEM } from "@/lib/imageValidation";

export interface UploaderImage {
  id: string;
  url: string;
  sortOrder: number;
}

interface ImageUploaderProps {
  slug: string;
  itemId: string;
  initialImages: UploaderImage[];
  onChange?: (images: UploaderImage[]) => void;
}

export function ImageUploader({
  slug,
  itemId,
  initialImages,
  onChange,
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploaderImage[]>(
    [...initialImages].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateImages(next: UploaderImage[]) {
    setImages(next);
    onChange?.(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch(
        `/api/restaurants/${slug}/menu-items/${itemId}/images`,
        { method: "POST", body: fd }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Falha no upload");
      }
      const created = (await response.json()) as UploaderImage;
      updateImages([...images, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: string) {
    setError(null);
    try {
      const response = await fetch(
        `/api/restaurants/${slug}/menu-items/${itemId}/images/${imageId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Falha ao remover");
      }
      updateImages(images.filter((i) => i.id !== imageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  async function persistReorder(nextOrder: UploaderImage[]) {
    setError(null);
    try {
      const response = await fetch(
        `/api/restaurants/${slug}/menu-items/${itemId}/images/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: nextOrder.map((i) => i.id) }),
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Falha ao reordenar");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  function handleDragStart(idx: number) {
    setDragIndex(idx);
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setDragIndex(idx);
    updateImages(next.map((img, i) => ({ ...img, sortOrder: i })));
  }
  function handleDragEnd() {
    setDragIndex(null);
    persistReorder(images);
  }

  const atLimit = images.length >= MAX_IMAGES_PER_ITEM;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Imagens
        </label>
        <span
          className="text-xs text-gray-500"
          data-testid="image-count"
        >
          {images.length} / {MAX_IMAGES_PER_ITEM}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden cursor-move group"
              data-testid={`uploader-thumb-${img.id}`}
            >
              <img
                src={img.url}
                alt={`Imagem ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label="Remover imagem"
                onClick={() => handleDelete(img.id)}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
        <div>
          <label
            htmlFor={`image-upload-${itemId}`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 border border-dashed border-blue-300 px-3 py-2 rounded cursor-pointer hover:bg-blue-50"
          >
            {uploading ? "Enviando..." : "+ Adicionar imagem"}
          </label>
          <input
            id={`image-upload-${itemId}`}
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
            aria-label="Adicionar imagem"
          />
        </div>
      )}
    </div>
  );
}
