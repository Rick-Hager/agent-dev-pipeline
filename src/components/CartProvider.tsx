"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  CartItem,
  loadCart,
  saveCart,
  addItemToCart,
  updateItemQuantity,
  getTotalItems,
  getTotalInCents,
} from "@/lib/cart";

interface CartContextValue {
  items: CartItem[];
  slug: string;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalInCents: number;
}

const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  slug: string;
  children: React.ReactNode;
}

export default function CartProvider({ slug, children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    return loadCart(slug);
  });

  useEffect(() => {
    saveCart(slug, items);
  }, [slug, items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => addItemToCart(prev, item));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => updateItemQuantity(prev, id, quantity));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value: CartContextValue = {
    items,
    slug,
    addItem,
    updateQuantity,
    clearCart,
    totalItems: getTotalItems(items),
    totalInCents: getTotalInCents(items),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
