export interface CartItem {
  id: string;
  name: string;
  priceInCents: number;
  quantity: number;
}

export function getCartKey(slug: string): string {
  return `cart:${slug}`;
}

export function loadCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCartKey(slug));
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(slug: string, items: CartItem[]): void {
  localStorage.setItem(getCartKey(slug), JSON.stringify(items));
}

export function addItemToCart(
  items: CartItem[],
  item: Omit<CartItem, "quantity">
): CartItem[] {
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    return items.map((i) =>
      i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
    );
  }
  return [...items, { ...item, quantity: 1 }];
}

export function updateItemQuantity(
  items: CartItem[],
  id: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((i) => i.id !== id);
  }
  return items.map((i) => (i.id === id ? { ...i, quantity } : i));
}

export function getTotalItems(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function getTotalInCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.priceInCents * i.quantity, 0);
}
